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
- Keep user-facing included-generation allowance separate from platform provider spend so failed billable attempts remain visible to spend ceilings.
- Bound authenticated request rate, concurrent generation, and per-account/global daily managed spend before provider invocation, failing closed when pricing or durable spend data is unavailable.
- Keep self-host unrestricted and free of mandatory billing configuration or runtime dependencies when billing is disabled.
- Refuse to run hosted production billing without authenticated webhooks and a durable adapter.

**Non-Goals:**

- Migrating or backfilling the current in-memory state.
- Dual writes, shadow evaluation, feature flags, canaries, or compatibility with the current hosted runtime.
- Exactly-once quota accounting across process crashes. Reservation commit/rollback is transactional in normal operation; a crash at the wrong instant may miscount one generation. Atomic result-and-quota finalization is deferred until launch scale justifies it.
- Durable or distributed request-rate and concurrency limiting. Admission state is in-process for the single-instance deployment; better-auth's built-in limiter covers auth endpoints. Redis-backed admission is a scale-out follow-up, not part of this change.
- Client `Idempotency-Key` replay semantics. A retried request may perform duplicate work and consume duplicate allowance pre-launch.
- Pre-invocation cost reservation. Spend ceilings are enforced against settled metered cost with configured headroom.
- Changing store purchase UI, RevenueCat SDK purchase flows, pricing, plan limits, or product catalog strategy.
- Counting BYOK provider spend as included hosted usage.
- Replacing upstream edge/WAF volumetric DDoS protection; application admission complements it and remains authoritative for authenticated account, concurrency, and provider-spend limits.
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

- `billing_webhook_event`: source, event ID, normalized hash, received time, vendor time, type, app/environment, resolved account, processing outcome, and failure detail safe for logs
- `billing_customer_mapping`: external RevenueCat customer/alias to internal user mapping
- `billing_entitlement_projection`: current account entitlement projection and last applied ordering key
- `included_generation_window`: account, time bounds, and committed count. The limit comes from configuration at evaluation time and the reserved count is derived from active reservation rows, so the window row stores only what must survive restarts.
- `included_generation_reservation`: immutable reservation ID, account, operation key, window, state, timestamps, and expiry

Durable usage events and per-attempt provider costs already live in the existing `ai_usage_event`/`ai_model_call` lineage; billing reuses them rather than adding a parallel usage table. No admission or spend tables are added: request-rate and concurrency admission is in-process (Decision 5), and spend ceilings are evaluated against settled metered cost.

Quota-window boundaries are derived from account creation and the configured fixed window length, then persisted on first read or reservation. A first usage read therefore has the same durable boundary as a later managed reservation and does not hide earlier BYOK usage behind a synthetic `now` boundary.

Every nano-USD database column uses PostgreSQL `bigint`. Provider-neutral and JSON-facing application contracts retain decimal strings and repositories convert only at the persistence boundary, avoiding both floating-point loss and JSON `bigint` serialization failures.

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

1. `reserveGenerate` receives the authenticated user, generation operation, and server operation ID.
2. It returns a denial or an allowed result containing an exact included-generation reservation when managed allowance applies.
3. The generation handler produces a semantically validated result, commits that exact reservation on success, and rolls it back on failure or abort.

The durable quota repository reserves in a transaction that locks the active quota window and checks `committed + active reserved < limit` before inserting. `(account_id, operation_key)` is unique so an internal retry for one account cannot reserve twice while another account may use the same operation key independently. Commit and rollback are idempotent state transitions addressing only their own reservation. Durable metering keeps its existing idempotent `(account_id, operation_id, event_id)` key; usage events are written independently of quota commit.

Pending reservations have a configured TTL. An expired pending reservation simply stops counting toward the active-reservation check; no reclaim job, generation-attempt store, or result-aware reconciliation is required. If validated work from the owning in-flight operation later completes, committing the exact reservation still charges its original window. This can produce bounded overshoot from work already in flight, while abandoned reservations remain reclaimable without cleanup.

Commit is not atomic with result persistence. A crash between provider success and commit (or between rollback and response) may miscount a single generation for one account. This is an accepted pre-launch trade-off recorded in Non-Goals; atomic result-and-quota finalization via `harden-workout-generation` G5 is a deliberate post-launch follow-up, not part of this change.

Entitlement and quota lookup, reservation, commit, and rollback are asynchronous. A durable-adapter error is not interpreted as available quota.

**Rationale:** A token prevents one request from rolling back another request's usage and makes concurrency behavior explicit, without building crash-exactness machinery whose failure cost is one included generation.

### 5) Keep admission in-process and enforce spend as settle-only ceilings

**Decision:** `x-request-id` remains an untrusted correlation value only. It MUST NOT provide ledger uniqueness, quota deduplication, or spend deduplication. Every accepted request receives a server-generated operation ID that keys reservations and metering. Client `Idempotency-Key` handling is out of scope for this change; a retried request is a new operation.

Every provider-backed request, including BYOK, passes per-account request-rate and active-generation concurrency admission implemented in process memory at the generation route. The deployment is one server instance; better-auth's built-in rate limiter already protects auth endpoints, and ingress/WAF remains responsible for volumetric unauthenticated traffic. Admission state is intentionally not durable: losing it on restart resets counters, which costs nothing. If the deployment ever scales to multiple instances, shared admission moves to Redis, not to billing tables.

Managed/Vertex requests are additionally checked against per-account and global daily spend ceilings before invocation. The check sums settled nano-USD cost from the durable metering data for the current day and denies when a ceiling is reached. There is no pre-invocation cost reservation: concurrent in-flight requests can overshoot a ceiling by at most (max concurrent generations × maximum single-request cost), so ceilings are configured with that headroom. Actual provider cost is settled through the existing metering sink for every upstream attempt, including attempts that time out, fail validation, or return no workout.

Managed generation fails closed before provider work when pricing for the selected provider/model is unknown, the spend query fails, or the quota repository is unavailable. BYOK bypasses allowance and spend ceilings but never request-rate, concurrency, payload, timeout, or retry controls.

**Rationale:** Per-account admission plus daily ceilings bound both a hot loop and a stolen-token attack. The settle-only model reuses cost data the metering path already persists, replacing four tables and a reservation state machine with one bounded query.

### 6) Use one repository, one server, and one canonical policy model

**Decision:** `packages/quotas` owns entitlement projection and exact reservation policy contracts. `packages/metering` owns the non-secret usage-event and sink contract. `server-core` consumes those contracts instead of defining a competing production policy. `packages/server-db` owns their durable PostgreSQL repositories, and `apps/server` owns deployment-mode composition. A bounded memory implementation exists only for tests and explicitly selected local development; self-hosted production defaults to billing disabled.

The current check-only quota service, process-array metering service, `server-core` policy shape, and app-local hosted runtime must be removed, repurposed, or reduced to adapters over these canonical contracts. The private deployment repository does not contain a billing adapter or alter the standalone image.

Native ESM repair remains a package-quality goal, but it is not a prerequisite for code compiled into the consolidated application. Managed-key policy still depends on generation G1 attributing the actually selected credential as `byok`, `managed`, or `vertex`; an unrelated key header must not bypass quota.

**Rationale:** One contract and one schema avoid divergent billing semantics while matching origin's actual deployment model.

### 7) Fail closed in hosted production

**Decision:** When `DEPLOYMENT_MODE=hosted` and `BILLING_PROVIDER=revenuecat`, the composition root requires the durable billing event processor and reservation policy. `validateBootConfig` remains environment-only: missing or invalid configuration and failure to construct the configured adapter prevent startup. Database connectivity and schema availability are checked by `/api/ready`; an unhealthy repository keeps readiness false and makes entitlement or managed-generation requests return service unavailable before provider invocation, but does not turn boot validation into an I/O check.

This public repository owns a strict versioned schema for the non-secret billing configuration, but no deployment-specific app, catalog, quota, or guardrail values. The deployment owner supplies those values in `BILLING_CONFIG_JSON`. The private deployment repository may represent them as a typed Pulumi object and serialize them for Cloud Run, but it does not define a competing schema or inject product code. Because it pins the product commit used to build the image, its configuration and the server parser can be advanced together through the existing candidate/readiness promotion gate.

RevenueCat mode uses these exact settings and ownership boundaries:

- `DEPLOYMENT_MODE=hosted`, `BILLING_PROVIDER=revenuecat`, and the existing database settings;
- required `REVENUECAT_WEBHOOK_SECRET`, accepted only as `Authorization: Bearer <secret>` and compared without logging it;
- required `BILLING_CONFIG_JSON`, bounded before parsing and validated as one strict document with `schemaVersion: 1`; unknown versions, malformed JSON, unknown properties, missing properties, invalid types, and out-of-bound values fail startup without logging the document;
- a `revenueCat` section containing non-empty, bounded, duplicate-free app, environment, entitlement, and product ID arrays plus an optional default offering ID; environments remain restricted to the code-owned `SANDBOX` and `PRODUCTION` enum and event types remain a code-owned allowlist;
- a `plans` section containing bounded non-negative free/pro generation limits and a positive bounded quota-window duration;
- a `guardrails` section containing bounded per-account request-rate and maximum-active-generation values, decimal-string per-account/global daily nano-USD ceilings, and a bounded pending-reservation TTL;
- a `capabilities` section containing the hosted upgrade-UI discovery setting.

The webhook secret is intentionally excluded from the serialized document so deployment secret handling and rotation remain independent. `BILLING_PROVIDER=none` does not parse or require either RevenueCat setting. Self-hosters who enable RevenueCat use the same public schema with their own values; this repository ships documentation and validation tests, not Leveza-specific profiles.

The deprecated `EDITION`, `HOSTED_BILLING_ENABLED`, per-setting `HOSTED_*` and `BILLING_*` policy variables, `REVENUECAT_ALLOWED_*`, `REVENUECAT_ENTITLEMENT_IDS`, `REVENUECAT_PRODUCT_IDS`, `REVENUECAT_DEFAULT_OFFERING_ID`, `REVENUECAT_ALLOW_UNSIGNED_WEBHOOKS`, and `x-revenuecat-signature` forms are deleted directly. No aliases or fallback defaults are retained for hosted RevenueCat mode.

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
4. After generation G1, merge B3 to cut the single server directly to durable billing, remove process-memory production state, wire admission and spend ceilings, and extend existing boot/readiness checks.
5. Reset non-production billing data, deploy schema and server together, and run restart and concurrent-reservation acceptance tests.

There are no backfills, compatibility adapters, dual reads/writes, or gradual flags. Rollback before launch means reverting the deployment and resetting the non-production billing tables; the in-memory hosted runtime is not restored as a production fallback.

## Risks / Trade-offs

- [A database outage blocks managed generation] -> Intentional fail-closed behavior; expose dependency health and return a structured service-unavailable response before provider invocation.
- [A crash occurs between validated result creation and quota commit] -> Accepted: the miscount is bounded to one generation for one account, and pending reservations expire by TTL. Atomic finalization is a deliberate post-launch follow-up once real usage justifies it.
- [Clock disagreement affects expiry] -> Use database/server time for reservation windows and vendor timestamps for RevenueCat ordering; do not order events by receipt time.
- [Unknown RevenueCat lifecycle event changes vendor behavior] -> Record it as ignored, alert on it, and add reducer support deliberately before it can mutate access.
- [Memory and PostgreSQL reducer behavior drift] -> Export reusable contract tests from B1 and require the `server-db` repositories to pass them against PostgreSQL.
- [Parallel quota/metering APIs survive] -> Make removal or adaptation of every existing production abstraction an explicit B1 acceptance criterion before generation G2 integrates.
- [A failed provider call consumes money but returns no workout] -> Its actual cost is still settled through the metering sink and counts toward spend ceilings; never infer zero cost from an application-level failure. The included-generation reservation may still roll back.
- [An attacker floods the generation route] -> Per-account request-rate and concurrency admission denies before provider work, and daily account/global spend ceilings cap the total money at risk even if admission is bypassed or reset by a restart.
- [Concurrent calls overshoot a spend ceiling] -> Overshoot is bounded by max concurrency times maximum single-request cost; configure ceilings with that headroom and fail closed when pricing or the spend query is unavailable.
- [Admission counters reset on restart] -> Accepted: a restart briefly forgets rate counts, while spend ceilings remain durable because they derive from metered cost. This is the intended durability split.
- [Deployment configuration and image schema drift] -> The document carries an explicit schema version, the server rejects unknown versions at boot, the deployment repository pins the product commit it builds, and candidate readiness prevents an incompatible revision from receiving traffic.

## Open Questions

None for implementation. All three implementation PRs target projects that already exist in this repository; B1 may add missing test targets, and B2 adds one migration to the existing `server-db` lineage.
