## Specification-Only PR S0 - Reconcile Canonical Capabilities

- [x] S0.1 Create a specification-only PR with no application code that captures origin's consolidated architecture: this repository is the canonical product, `apps/server` is the single deployment-mode-aware server, `packages/server-db` owns one migration lineage, and the private deployment repository publishes images rather than supplying a code overlay.
- [x] S0.2 Revise or supersede the stale private-Next-app requirements in `refactor-open-core-server` and the private-overlay/progressive-rollout requirements in `add-app-store-billing-upgrade-features` before syncing or archiving either change.
- [x] S0.3 Preserve the valid mobile purchase and capability-discovery behavior from the earlier billing change while removing its permissive fallback and staged-rollout assumptions.
- [x] S0.4 Sync the corrected predecessors so canonical `billing-entitlements` and `open-core-architecture` base specs exist. Preserve the exact `CE/Self-Host Neutral Billing Defaults` requirement name for this delta's `MODIFIED` section.
- [x] S0.5 Rebase this delta on those canonical bases, merge package-and-CI PR 1, and run the repo-owned strict OpenSpec validator before B1.

## PR Map

| PR  | Repository      | Depends On                                         | Purpose                                                                                                                                                 |
| --- | --------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S0  | Specs only      | Current origin; package-and-CI PR 1 before merge   | Reconcile stale predecessors, establish canonical base specs, and rebase this delta without application-code changes                                    |
| B1  | This repository | Specification prerequisite S0; package-and-CI PR 1 | Normalize RevenueCat events, correct lifecycle reduction, and make `quotas`/`metering` the canonical exact-reservation contracts                        |
| B2  | This repository | B1                                                 | Add PostgreSQL schema and repositories to the `server-db` migration lineage                                                                             |
| B3  | This repository | B2; generation G1                                  | Cut the single server's billing routes, wiring, and generation flow directly to durable storage; remove process memory and extend boot/readiness checks |

B1 can proceed alongside generation G1 and G3. Generation G2 depends on B1's canonical contracts. B2 may proceed while generation G2-G4 are developed. No PR adds a feature flag, dual write, backfill, compatibility read, or production memory fallback.

### S0 Acceptance Criteria

- [x] S0.A1 Canonical `openspec/specs/billing-entitlements/spec.md` and `openspec/specs/open-core-architecture/spec.md` exist and express the consolidated server/image-publisher architecture.
- [x] S0.A2 Corrected predecessor deltas validate before archive/sync, and this change validates against the resulting exact requirement names.
- [x] S0.A3 The S0 diff contains only OpenSpec artifacts and no application, package, lockfile, workflow, or environment-example changes.

### S0 Verification Commands

```bash
npm run validate:openspec -- add-app-store-billing-upgrade-features
npm run validate:openspec -- refactor-open-core-server
npm run validate:openspec -- make-hosted-billing-durable
git diff --name-only origin/main...HEAD
```

## PR B1 - Billing Domain And Canonical Reservation Contracts

### Implementation Tasks

- [x] B1.1 Keep the bounded RevenueCat envelope/schema and vendor-to-domain normalizer in `apps/server`; retain event ID, vendor timestamp, app ID, environment, customer identifiers, entitlements, product, and lifecycle timestamps while mapping vendor event names to a provider-neutral entitlement lifecycle event exported by `packages/quotas`.
- [x] B1.2 Add an explicit domain configuration object for allowed app, environment, entitlement, and product values; keep supported environments/event types as bounded code-owned enums and reject conditionally incomplete state-changing events.
- [x] B1.3 Add a pure provider-neutral entitlement reducer in `packages/quotas` with deterministic ordering and lifecycle outcomes limited to `apply`, `stale`, `ignored`, or `no_change`; it must not parse RevenueCat envelopes or depend on RevenueCat field names.
- [x] B1.4 Define processor/repository outcomes (`applied`, `duplicate`, `stale`, `ignored`, `unmapped`, `conflict`) separately from reducer decisions.
- [x] B1.5 Make `packages/quotas` the canonical entitlement and reserve/commit/rollback contract, and make `packages/metering` the canonical non-secret usage-event/sink contract. Replace or remove the current check-only quota service, process-array metering service, duplicate `server-core` policy shape, and app-local variants so one model remains.
- [x] B1.6 Define an authenticated billing-customer bootstrap contract that derives the current account's RevenueCat identity without accepting arbitrary account ownership from webhook or client input.
- [x] B1.7 Model `willRenew`, paid-through, and grace boundaries in entitlement contracts and responses.
- [x] B1.8 Define the exact reservation-token contract that correlates stable `auth.userId`, operation key, and reservation without importing database code into `server-core`.
- [x] B1.8a Define separate contracts for included-generation allowance, in-process provider-work admission (per-account rate and concurrency), and the settle-only daily spend-ceiling check. `x-request-id` is correlation only; operation ID is server-owned.
- [x] B1.9 Adapt the temporary development/test memory implementation to the canonical contracts so B1 remains buildable; production wiring is removed in B3.
- [x] B1.10 Export reusable reducer, event-processor, customer-mapping, reservation, and metering contract tests.
- [x] B1.10a Export reusable admission/spend-ceiling tests covering account rate and concurrency denial, matching server-operation replay, independently keyed operations exhausting the same account limits, ceiling denial at the configured daily limit with failed billable attempts counting toward it, and per-account independence of ceilings.
- [x] B1.11 Add real Jest configuration and test targets to `quotas` and `metering`; neither target may pass with an empty suite.

### Acceptance Criteria

- [x] B1.A1 Cancellation keeps paid access active through expiration while setting `willRenew=false`; expiration ends access and older events cannot regress a newer period.
- [x] B1.A2 Duplicate event IDs do not mutate a projection; the same ID with different normalized content is a conflict.
- [x] B1.A3 Generation failures roll back only their returned reservation; commit and rollback are idempotent and address only their exact reservation.
- [x] B1.A4 Schemas reject missing IDs/timestamps and unbounded identifier or alias collections without logging secret headers or complete payloads.
- [x] B1.A5 No webhook or unauthenticated request can map a RevenueCat customer to an arbitrary account.
- [x] B1.A6 Exactly one quota policy and one metering contract remain; `server-core`, `apps/server`, `quotas`, and `metering` do not expose competing production abstractions.
- [x] B1.A7 Metering contracts support an idempotent account/operation/event identity and bounded non-secret provider, credential-source, result, logical-phase, and upstream-attempt fields.
- [x] B1.A8 Included-generation allowance and managed-provider spend are independent: a failed billable attempt may release customer allowance but must settle actual platform cost.
- [x] B1.A9 BYOK bypasses included allowance and spend ceilings only; it remains subject to account rate, concurrency, and execution-budget admission.

### Verification Commands

```bash
nx test @leveza/shared
nx test @leveza/server-core
nx test quotas
nx test metering
nx run-many -t typecheck,lint,build --projects=@leveza/shared,@leveza/server-core,quotas,metering
```

## PR B2 - PostgreSQL Billing Schema And Repositories

### Implementation Tasks

- [x] B2.1 Add Drizzle tables and one migration under `packages/server-db` for webhook events, customer mappings, entitlement projections, and included-generation windows/reservations. Nano-USD columns use PostgreSQL `bigint`.
- [x] B2.2 Enforce unique source/event IDs, unique external customer mappings, account-scoped `(account_id, operation_key)` reservations, user foreign keys, and indexes for active window/reservation lookup and the daily spend-ceiling query. Fix the metering event key: replace the `(user, operation)` unique index with `(user, operation, event)` so one operation can record distinct event kinds, and persist the event ID column the sink already carries.
- [x] B2.3 Implement authenticated customer bootstrap and idempotent reconciliation of previously unmapped ledger events.
- [x] B2.4 Implement one-transaction webhook ledger/projection processing with row locking and the B1 normalizer/reducer; webhook data alone cannot create account ownership.
- [x] B2.5 Implement account-scoped entitlement reads that derive expiry from paid/grace boundaries when a final expiration webhook is delayed.
- [x] B2.6 Implement atomic included-generation reserve/commit/rollback with row locking and idempotent transitions. Expired pending reservations stop counting toward the active check, while exact late commits still charge completed in-flight work. No reclaim job or result-aware reconciliation.
- [x] B2.7 Add a `server-db` PostgreSQL integration target that applies the repository migration and runs B1's contract suites against two independent repository instances sharing one database.
- [x] B2.8 Add redacted structured outcomes for applied, duplicate, stale, ignored, unmapped, conflict, mapping, reserve, commit, rollback, and reconciliation operations.
- [x] B2.9 Implement the daily account/global spend-ceiling check as a bounded query over the existing durable `ai_usage_event` cost data; it fails closed (deny) on query error and does not require new tables.

### Acceptance Criteria

- [x] B2.A1 Entitlements, mappings, ledger outcomes, reservations, and committed usage survive repository/server recreation.
- [x] B2.A2 Duplicate and stale deliveries are persisted but never mutate the current projection.
- [x] B2.A3 Concurrent reservations from separate repository instances never exceed the window limit.
- [x] B2.A4 Commit and rollback are idempotent and address only their exact reservation; an expired pending reservation frees its slot and rejects a late commit.
- [x] B2.A5 Unknown accounts, apps, environments, products, and entitlements cannot grant access.
- [x] B2.A6 The schema and repositories use the existing `packages/server-db` client, Cloud SQL support, and single migration lineage rather than a parallel database package.
- [x] B2.A7 Replaying one operation cannot duplicate its usage event, while two accounts may independently use the same operation-key string.
- [x] B2.A8 The spend-ceiling check denies at or over a configured account or global daily ceiling, counts failed billable attempts, and denies when the query fails or pricing is unknown.

### Verification Commands

```bash
nx test server-db
nx run server-db:typecheck
nx build server-db
nx run server-db:integration
```

## PR B3 - Single-Server Durable Billing Cutover

**Depends on:** B2 and `harden-workout-generation` G1.

### Implementation Tasks

- [x] B3.1 Keep the entitlement and RevenueCat webhook routes in `apps/server` as thin adapters over the B2 repositories; gate both routes on `BILLING_PROVIDER=revenuecat`.
- [x] B3.2 Replace direct `HostedBillingRuntime` construction in `wiring.ts` with the durable repositories and canonical B1 policy/metering contracts.
- [x] B3.3 Delete the process-local hosted entitlement, customer, quota, and metering maps from production code. Retain a memory billing adapter only through an explicit test/development entry point. The in-process admission limiter is intentionally process-local and remains.
- [x] B3.4 Make the public product own a strict, versioned `BILLING_CONFIG_JSON` schema containing RevenueCat scope, plan allowance, admission, spend-ceiling, reservation-TTL, and upgrade-capability sections. Keep `REVENUECAT_WEBHOOK_SECRET` separate; bound the raw document before parsing and reject malformed JSON, unknown schema versions/properties, missing values, duplicate identifiers, invalid enums/types/numbers, and out-of-bound values without logging document contents or performing database I/O.
- [x] B3.5 Use `DEPLOYMENT_MODE=hosted` plus `BILLING_PROVIDER=revenuecat`, `BILLING_CONFIG_JSON`, and `REVENUECAT_WEBHOOK_SECRET`; delete `EDITION`, `HOSTED_BILLING_ENABLED`, the per-setting hosted/billing/RevenueCat configuration variables, and `REVENUECAT_ALLOW_UNSIGNED_WEBHOOKS` from code, tests, root/app env examples, README, and AGENTS guidance. Document that deployment repositories own concrete values and may serialize a typed configuration object against the pinned public schema.
- [x] B3.6 Accept only `Authorization: Bearer <REVENUECAT_WEBHOOK_SECRET>` for RevenueCat webhooks, remove `x-revenuecat-signature`, and test that no environment or route path accepts unsigned production or development webhook state.
- [x] B3.7 Extend `/api/ready` with billing schema/repository health when RevenueCat billing is enabled; connectivity/schema failure keeps readiness false and dependent routes return service unavailable before managed provider work, without turning boot validation into an I/O probe.
- [x] B3.8 Wire authenticated customer bootstrap and unmapped-event reconciliation before purchase or restore UI can initiate RevenueCat work.
- [x] B3.9 Wire hosted generation to the full simplified flow: in-process per-account rate/concurrency admission, daily spend-ceiling check, included-generation reserve, provider invocation, metering settlement of every billable attempt, then commit on validated success or rollback on failure. BYOK skips allowance and ceilings only. Persist account-anchored quota windows on first read so BYOK-only usage remains in the reported window. Remove every permissive or process-memory hosted billing fallback.
- [x] B3.10 Reset non-production billing data and apply the new schema without a backfill or compatibility transform.
- [x] B3.11 Add boot/route/composition cases for self-hosted billing-disabled, valid schema version, malformed/oversized configuration, unknown schema version/property, duplicate identifiers, hosted durable, provider-disabled webhook, malformed/scope-invalid event, cancellation-before-expiry, duplicate, stale, mapping conflict, unavailable repository, account rate denial, concurrency denial, BYOK admission, spend-ceiling denial, and unknown managed pricing.
- [x] B3.12 Add credential-source cases: matching provider BYOK bypasses entitlement quota and ceilings; unrelated or unused key headers do not; managed and Vertex credentials reserve quota and are ceiling-checked.

### Acceptance Criteria

- [x] B3.A1 Self-hosted mode starts with billing disabled and generation unrestricted by billing services.
- [x] B3.A2 Hosted RevenueCat production cannot start without a supported strictly valid billing configuration document, valid durable-adapter/database configuration, and authenticated-webhook configuration; database connectivity/schema health is enforced through readiness rather than boot I/O.
- [x] B3.A3 No process-local hosted entitlement, customer, quota, or metering state remains in production composition; the only intentional process-local state is the admission limiter.
- [x] B3.A4 Restarting the server does not change entitlement, mapping, ledger, reservation, or quota state; admission counters may reset.
- [x] B3.A5 Billing routes are part of the consolidated server image and do not rely on private source injection or a second application.
- [x] B3.A6 Readiness reflects billing repository/schema health only when billing is enabled, and failures do not invoke a managed model provider.
- [x] B3.A7 `rg` finds no runtime or documentation use of removed deployment, per-setting billing/RevenueCat, unsigned-webhook, or custom-signature aliases outside historical OpenSpec artifacts.
- [x] B3.A8 A quota limit of N permits at most N committed or active reservations; a failed attempt records a durable failure outcome and settles its actual provider cost without committing included allowance.
- [x] B3.A9 The only billing bypass is a credential selected from a matching BYOK header for the chosen provider; managed generation is denied before provider work when pricing, the spend query, or the quota repository is unavailable.

### Verification Commands

```bash
nx test @leveza/server
nx run @leveza/server:typecheck
nx lint @leveza/server
nx build @leveza/server
nx run @leveza/server-e2e:e2e
docker build -f docker/Dockerfile.server -t leveza-server:billing .
docker build -f docker/Dockerfile.migrate -t leveza-migrate:billing .
```

## Deferred Until Launch Scale Justifies It

Deliberately out of scope for this change; revisit when there are real paying users, more than one server instance, or meaningful managed-provider spend:

- Atomic result-and-quota finalization (single transaction or transactional outbox) with result-aware TTL reclaim and crash-point tests; depends on `harden-workout-generation` G5.
- Client `Idempotency-Key` acquisition, request-fingerprint conflict detection, and cross-session result replay.
- Durable or Redis-backed request-rate/concurrency admission and trusted-ingress source-identity configuration.
- Pre-invocation conservative cost reservation, hourly spend windows, and circuit-breaker recovery machinery.

## Final Change Verification

- [x] V1 Run `npm run validate:openspec -- make-hosted-billing-durable` successfully using the repo-owned CLI from package-and-CI PR 1.
- [x] V2 Run `nx sync:check` and the complete applicable lint, typecheck, test, build, server E2E, and Docker image gates.
- [x] V3 Run the PostgreSQL contract, restart, and concurrent last-slot reservation checks from B2-B3.
