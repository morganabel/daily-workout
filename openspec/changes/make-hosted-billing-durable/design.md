## Context

`apps/server/src/lib/hosted-billing.ts` currently combines RevenueCat interpretation, account mapping, entitlement reads, and quota mutation in one synchronous process-local runtime. `apps/server/src/app/api/billing/revenuecat/webhook/route.ts` parses only a small subset of the webhook and passes it directly to that runtime. Event ID and ordering metadata are discarded, and cancellation is treated as immediate expiration. Origin's boot validator already rejects unsigned webhooks in production; this change preserves that invariant and removes the unsigned mode entirely. `apps/server/src/lib/wiring.ts` selects the memory runtime whenever hosted billing is enabled.

The server core already exposes `UsagePolicy`, but `canGenerate` returns only a decision and rollback identifies no exact reservation. That contract cannot safely coordinate concurrent processes or recover abandoned reservations. Origin also added separate process-local `packages/quotas` and `packages/metering` prototypes. The consolidated architecture makes this repository the canonical product, `apps/server` the single server, and `packages/server-db` the owner of one migration lineage; the private deployment repository publishes images rather than injecting source code.

No real users or billing history exist. Correct final-state architecture is more valuable than preserving the current in-memory behavior.

## Goals / Non-Goals

**Goals:**

- Preserve sufficient RevenueCat metadata to validate, deduplicate, and order every state-changing delivery.
- Model cancellation, expiration, renewal, billing issues, and uncancellation without shortening already-paid access.
- Make entitlements and managed-key quota reservations durable across restarts and consistent across instances.
- Ensure every quota rollback or commit addresses one exact reservation.
- Keep self-host unrestricted and free of mandatory billing configuration or runtime dependencies when billing is disabled.
- Refuse to run hosted production billing without authenticated webhooks and a durable adapter.

**Non-Goals:**

- Migrating or backfilling the current in-memory state.
- Dual writes, shadow evaluation, feature flags, canaries, or compatibility with the current hosted runtime.
- Changing store purchase UI, RevenueCat SDK purchase flows, pricing, plan limits, or product catalog strategy.
- Counting BYOK provider spend as included hosted usage.
- Splitting hosted behavior into a second application or code-bearing private overlay.

## Decisions

### 1) Normalize the vendor event before domain processing

**Decision:** The RevenueCat route in `apps/server` owns the bounded vendor envelope and converts it to an immutable provider-neutral `EntitlementLifecycleEvent` exported by `packages/quotas` before calling the processor. The normalized event retains at least:

- source and vendor event ID
- provider-neutral lifecycle kind, original vendor event type, and vendor event timestamp
- app ID and environment
- app user ID, original app user ID, and bounded aliases
- entitlement IDs and product ID
- purchase, expiration, and grace-period timestamps when supplied
- cancellation reason and renewal state when supplied
- a hash of the normalized state-affecting fields

The parser may ignore unknown vendor fields, but relevant known fields are conditionally required for state-changing event types. IDs and arrays have explicit length/count limits. Configuration supplies allowed app IDs, environments, entitlement IDs, and product IDs. Supported RevenueCat event types are a code-owned allowlist and normalize to domain kinds such as `grant`, `renew`, `cancel_renewal`, `restore_renewal`, `expire`, `billing_issue`, `product_change`, or `unsupported`.

Webhook authentication is mandatory whenever RevenueCat mode is enabled, including development. Tests and local development use a dummy secret rather than an unsigned mode.

**Rationale:** Keeping the vendor boundary explicit prevents loose payloads from becoming billing state and makes event behavior testable without a database.

### 2) Use a deterministic lifecycle reducer

**Decision:** `packages/quotas` owns a pure reducer from `(current entitlement projection, EntitlementLifecycleEvent, now)` to a proposed projection and a lifecycle decision such as `apply`, `stale`, `ignored`, or `no_change`. It does not parse RevenueCat fields. The projection includes plan/entitlement identity, status, `willRenew`, current-period end, grace-period end when applicable, and the last applied event ordering key.

Lifecycle rules include:

- `grant` and `renew` grant or extend access using source timestamps.
- `cancel_renewal` sets `willRenew=false` but leaves the entitlement active until its recorded expiration. It never shortens the current paid period.
- `restore_renewal` restores renewal without shortening the period.
- `expire` makes the entitlement inactive only when it is not older than the projection it would replace.
- `billing_issue` records `past_due` or `grace_period` according to the supplied validity boundaries; it does not invent unlimited access.
- Product changes never reduce an already-known paid-through timestamp because of an older delivery.
- Unsupported but well-formed event types are recorded as ignored and cannot mutate state.
- Entitlement reads derive inactive access when the paid-through/grace boundary has elapsed even if a final expiration webhook is delayed.

The reducer orders events by `(eventTimestamp, eventId)`. A delivery older than the last applied ordering key is recorded as stale and cannot mutate the projection. The ID is only a deterministic tie-breaker; it does not replace vendor time.

Duplicate, conflict, and unmapped outcomes are not reducer decisions: they require event-ledger uniqueness and durable customer mapping. The injected event processor combines those repository outcomes with the reducer's lifecycle decision to produce the public processing outcome.

**Rationale:** A pure reducer gives memory tests and the PostgreSQL repository one tested interpretation of subscription semantics.

### 3) Persist an inbox ledger and projection transactionally

**Decision:** `packages/server-db` owns these records in its existing schema and migration lineage:

- `billing_webhook_events`: source, event ID, normalized hash, received time, vendor time, type, app/environment, resolved account, processing outcome, and failure detail safe for logs
- `billing_customers`: external RevenueCat customer/alias to internal user mapping
- `billing_entitlements`: current account entitlement projection and last applied ordering key
- `billing_quota_windows`: account, operation/metric, time bounds, limit, committed count, and reserved count
- `billing_quota_reservations`: immutable reservation ID, operation key, window, state, timestamps, and expiry
- `billing_usage_events`: account, operation key, event kind, provider, credential source, result, logical phase counts, upstream attempt count, timestamps, and only bounded non-secret metadata

One database transaction inserts the event ledger row, locks the affected projection, applies the reducer, and updates the outcome. A unique `(source, eventId)` constraint provides idempotency:

- same ID and same normalized hash: return `duplicate` without mutation
- same ID and different hash: reject as a conflict and emit a security/operations signal
- older ordering key: persist `stale` without projection mutation
- unknown/unmapped account: persist `ignored` or `unmapped` without creating an arbitrary user

The app user ID must resolve to a real hosted account. RevenueCat anonymous IDs and aliases are never treated directly as internal user IDs; aliases only resolve through the durable mapping table.

The mapping table is populated through an authenticated hosted billing bootstrap, such as the entitlement read performed before purchase UI is shown. The server derives the expected RevenueCat customer identity from the authenticated account and creates or returns that account's mapping; the client cannot submit an arbitrary internal account owner. Signed webhooks may attach verified aliases only to an already owned mapping. An event that arrives before mapping exists is persisted as `unmapped`, and establishing the authenticated mapping triggers idempotent reconciliation of those ledger rows.

**Rationale:** Persisting the inbox as well as the projection makes duplicate, stale, and rejected processing observable and reproducible.

### 4) Replace implicit increments with reservation tokens

**Decision:** The core billing policy contract changes directly to a reservation lifecycle:

1. `reserveGenerate` receives the authenticated user, generation request, and operation key.
2. It returns a denial or an allowed result containing a unique reservation ID.
3. The generation handler produces a semantically validated result and records it through the durable hosted `GenerationAttemptStore` defined by `harden-workout-generation` G5.
4. The durable `server-db` finalizer makes the attempt's successful result and the exact reservation commit durable in one PostgreSQL transaction before returning the result.
5. It rolls back that exact reservation on every failure or abort before the atomic finalization point.

The durable quota repository reserves in a transaction that locks the active quota window and checks `committed + active reserved < limit` before inserting. `(account_id, operation_key)` is unique so an internal retry for one account cannot reserve twice while another account may use the same client key independently. Commit and rollback are idempotent state transitions. Durable metering uses an idempotent `(account_id, operation_key, event_kind)` key. B4 writes the successful usage summary in the same finalization transaction as attempt success and reservation commit; failure summaries are durable independent outcomes and never change committed quota.

Pending reservations have a configured TTL. B2 persists the expiry metadata but does not enable autonomous reclaim because it does not yet depend on the durable generation-attempt store. B4 enables reclaim only after it can consult that store: a reservation with no durable validated result may expire and roll back, while a result-ready attempt may never be reclaimed as unused. If atomic finalization is implemented through a transactional outbox rather than one transaction, reconciliation must commit the reservation before the result can be replayed. Crash-point tests must cover both sides of finalization.

Entitlement and quota lookup, reservation, commit, and rollback are asynchronous. A durable-adapter error is not interpreted as available quota.

**Rationale:** A token prevents one request from rolling back another request's usage and makes concurrency behavior explicit.

### 5) Use one repository, one server, and one canonical policy model

**Decision:** `packages/quotas` owns entitlement projection and exact reservation policy contracts. `packages/metering` owns the non-secret usage-event and sink contract. `server-core` consumes those contracts instead of defining a competing production policy. `packages/server-db` owns their durable PostgreSQL repositories, and `apps/server` owns deployment-mode composition. A bounded memory implementation exists only for tests and explicitly selected local development; self-hosted production defaults to billing disabled.

The current check-only quota service, process-array metering service, `server-core` policy shape, and app-local hosted runtime must be removed, repurposed, or reduced to adapters over these canonical contracts. The private deployment repository does not contain a billing adapter or alter the standalone image.

Native ESM repair remains a package-quality goal, but it is not a prerequisite for code compiled into the consolidated application. Managed-key policy still depends on generation G1 attributing the actually selected credential as `byok`, `managed`, or `vertex`; an unrelated key header must not bypass quota.

**Rationale:** One contract and one schema avoid divergent billing semantics while matching origin's actual deployment model.

### 6) Fail closed in hosted production

**Decision:** When `DEPLOYMENT_MODE=hosted` and `BILLING_PROVIDER=revenuecat`, the composition root requires the durable billing event processor and reservation policy. `validateBootConfig` remains environment-only: missing or invalid configuration and failure to construct the configured adapter prevent startup. Database connectivity and schema availability are checked by `/api/ready`; an unhealthy repository keeps readiness false and makes entitlement or managed-generation requests return service unavailable before provider invocation, but does not turn boot validation into an I/O check.

RevenueCat mode uses these exact settings:

- `DEPLOYMENT_MODE=hosted`, `BILLING_PROVIDER=revenuecat`, and the existing database settings;
- required `REVENUECAT_WEBHOOK_SECRET`, accepted only as `Authorization: Bearer <secret>` and compared without logging it;
- required comma-separated `REVENUECAT_ALLOWED_APP_IDS`, `REVENUECAT_ALLOWED_ENVIRONMENTS`, `REVENUECAT_ENTITLEMENT_IDS`, and `REVENUECAT_PRODUCT_IDS` lists, trimmed, length/count bounded, non-empty, and rejected when they contain duplicates;
- environments restricted to the code-owned `SANDBOX` and `PRODUCTION` enum and event types restricted to a code-owned allowlist rather than arbitrary environment input;
- `BILLING_FREE_GENERATION_LIMIT` and `BILLING_PRO_GENERATION_LIMIT` as bounded non-negative safe integers, and `BILLING_QUOTA_WINDOW_DAYS` as a positive bounded integer;
- optional `REVENUECAT_DEFAULT_OFFERING_ID` for capability discovery.

The deprecated `EDITION`, `HOSTED_BILLING_ENABLED`, `HOSTED_*_GENERATION_LIMIT`, `HOSTED_QUOTA_WINDOW_DAYS`, `REVENUECAT_ALLOW_UNSIGNED_WEBHOOKS`, and `x-revenuecat-signature` forms are deleted directly. No aliases or fallback defaults are retained for hosted RevenueCat mode.

Self-host and local development remain usable:

- `BILLING_PROVIDER=none` uses the no-op policy and advertises billing disabled.
- Tests/local development may select an explicit memory adapter while using a dummy authenticated webhook secret.
- The memory adapter is rejected in hosted production.
- RevenueCat mode never accepts unsigned webhooks.

**Rationale:** Granting paid service when billing state is unavailable creates unbounded cost and inconsistent access.

## Direct Cutover Plan

1. Capture the consolidated architecture and revise or supersede stale private-app specifications before archiving them.
2. Merge B1 to establish normalized events, lifecycle reduction, and one quota/metering contract.
3. Merge B2 to add PostgreSQL billing repositories to `packages/server-db` without changing production composition.
4. After generation G1, merge B3 to cut the single server directly to durable billing, remove process-memory production state, and extend existing boot/readiness checks.
5. After generation G1 and G5, merge B4 to make attempt result and exact reservation commit atomic.
6. Reset non-production billing data, deploy schema and server together, and run crash/restart/multi-instance acceptance tests.

There are no backfills, compatibility adapters, dual reads/writes, or gradual flags. Rollback before launch means reverting the deployment and resetting the non-production billing tables; the in-memory hosted runtime is not restored as a production fallback.

## Risks / Trade-offs

- [A database outage blocks managed generation] -> Intentional fail-closed behavior; expose dependency health and return a structured service-unavailable response before provider invocation.
- [A crash occurs between validated result creation and quota commit] -> Persist attempt success and reservation commit atomically in the hosted PostgreSQL transaction, or use a transactional outbox whose reconciliation commits result-ready attempts before replay; never TTL-reclaim a result-ready attempt as unused.
- [Clock disagreement affects expiry] -> Use database/server time for reservation windows and vendor timestamps for RevenueCat ordering; do not order events by receipt time.
- [Unknown RevenueCat lifecycle event changes vendor behavior] -> Record it as ignored, alert on it, and add reducer support deliberately before it can mutate access.
- [Memory and PostgreSQL reducer behavior drift] -> Export reusable contract tests from B1 and require the `server-db` repositories to pass them against PostgreSQL.
- [Parallel quota/metering APIs survive] -> Make removal or adaptation of every existing production abstraction an explicit B1 acceptance criterion before generation G2 or G5 integrates.

## Open Questions

None for implementation. All four PRs target projects that already exist in this repository; B1 may add missing test targets, and B2/B4 add migrations to the existing `server-db` lineage.
