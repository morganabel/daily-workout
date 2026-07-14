## Specification-Only PR S0 - Reconcile Canonical Capabilities

- [ ] S0.1 Create a specification-only PR with no application code that captures origin's consolidated architecture: this repository is the canonical product, `apps/server` is the single deployment-mode-aware server, `packages/server-db` owns one migration lineage, and the private deployment repository publishes images rather than supplying a code overlay.
- [ ] S0.2 Revise or supersede the stale private-Next-app requirements in `refactor-open-core-server` and the private-overlay/progressive-rollout requirements in `add-app-store-billing-upgrade-features` before syncing or archiving either change.
- [ ] S0.3 Preserve the valid mobile purchase and capability-discovery behavior from the earlier billing change while removing its permissive fallback and staged-rollout assumptions.
- [ ] S0.4 Sync the corrected predecessors so canonical `billing-entitlements` and `open-core-architecture` base specs exist. Preserve the exact `CE/Self-Host Neutral Billing Defaults` requirement name for this delta's `MODIFIED` section.
- [ ] S0.5 Rebase this delta on those canonical bases, merge package-and-CI PR 1, and run the repo-owned strict OpenSpec validator before B1.

## PR Map

| PR  | Repository      | Depends On                                         | Purpose                                                                                                                               |
| --- | --------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| S0  | Specs only      | Current origin; package-and-CI PR 1 before merge   | Reconcile stale predecessors, establish canonical base specs, and rebase this delta without application-code changes                  |
| B1  | This repository | Specification prerequisite S0; package-and-CI PR 1 | Normalize RevenueCat events, correct lifecycle reduction, and make `quotas`/`metering` the canonical exact-reservation contracts      |
| B2  | This repository | B1                                                 | Add PostgreSQL schema and repositories to the `server-db` migration lineage                                                           |
| B3  | This repository | B2; generation G1                                  | Cut the single server's billing routes and wiring directly to durable storage; remove process memory and extend boot/readiness checks |
| B4  | This repository | B3; generation G1 and G5                           | Persist generation attempt results and exact quota commits atomically, then verify crash/restart/concurrency behavior                 |

B1 can proceed alongside generation G1 and G3. Generation G2 and G5 depend on B1's canonical contracts. B2 may proceed while generation G2-G5 are developed. No PR adds a feature flag, dual write, backfill, compatibility read, or production memory fallback.

### S0 Acceptance Criteria

- [ ] S0.A1 Canonical `openspec/specs/billing-entitlements/spec.md` and `openspec/specs/open-core-architecture/spec.md` exist and express the consolidated server/image-publisher architecture.
- [ ] S0.A2 Corrected predecessor deltas validate before archive/sync, and this change validates against the resulting exact requirement names.
- [ ] S0.A3 The S0 diff contains only OpenSpec artifacts and no application, package, lockfile, workflow, or environment-example changes.

### S0 Verification Commands

```bash
npm run validate:openspec -- add-app-store-billing-upgrade-features
npm run validate:openspec -- refactor-open-core-server
npm run validate:openspec -- make-hosted-billing-durable
git diff --name-only origin/main...HEAD
```

## PR B1 - Billing Domain And Canonical Reservation Contracts

### Implementation Tasks

- [ ] B1.1 Keep the bounded RevenueCat envelope/schema and vendor-to-domain normalizer in `apps/server`; retain event ID, vendor timestamp, app ID, environment, customer identifiers, entitlements, product, and lifecycle timestamps while mapping vendor event names to a provider-neutral entitlement lifecycle event exported by `packages/quotas`.
- [ ] B1.2 Add an explicit domain configuration object for allowed app, environment, entitlement, and product values; keep supported environments/event types as bounded code-owned enums and reject conditionally incomplete state-changing events.
- [ ] B1.3 Add a pure provider-neutral entitlement reducer in `packages/quotas` with deterministic ordering and lifecycle outcomes limited to `apply`, `stale`, `ignored`, or `no_change`; it must not parse RevenueCat envelopes or depend on RevenueCat field names.
- [ ] B1.4 Define processor/repository outcomes (`applied`, `duplicate`, `stale`, `ignored`, `unmapped`, `conflict`) separately from reducer decisions.
- [ ] B1.5 Make `packages/quotas` the canonical entitlement and reserve/commit/rollback contract, and make `packages/metering` the canonical non-secret usage-event/sink contract. Replace or remove the current check-only quota service, process-array metering service, duplicate `server-core` policy shape, and app-local variants so one model remains.
- [ ] B1.6 Define an authenticated billing-customer bootstrap contract that derives the current account's RevenueCat identity without accepting arbitrary account ownership from webhook or client input.
- [ ] B1.7 Model `willRenew`, paid-through, and grace boundaries in entitlement contracts and responses.
- [ ] B1.8 Define exact reservation-token and provider-neutral finalization contracts that correlate stable `auth.userId`, operation key, generation attempt result, and reservation without importing database code into `server-core`.
- [ ] B1.9 Adapt the temporary development/test memory implementation to the canonical contracts so B1 remains buildable; production wiring is removed in B3.
- [ ] B1.10 Export reusable reducer, event-processor, customer-mapping, reservation, metering, and finalization contract tests.
- [ ] B1.11 Add real Jest configuration and test targets to `quotas` and `metering`; neither target may pass with an empty suite.

### Acceptance Criteria

- [ ] B1.A1 Cancellation keeps paid access active through expiration while setting `willRenew=false`; expiration ends access and older events cannot regress a newer period.
- [ ] B1.A2 Duplicate event IDs do not mutate a projection; the same ID with different normalized content is a conflict.
- [ ] B1.A3 Generation failures roll back only their returned reservation, and the finalizer contract can commit one validated result and that exact reservation atomically.
- [ ] B1.A4 Schemas reject missing IDs/timestamps and unbounded identifier or alias collections without logging secret headers or complete payloads.
- [ ] B1.A5 No webhook or unauthenticated request can map a RevenueCat customer to an arbitrary account.
- [ ] B1.A6 Exactly one quota policy and one metering contract remain; `server-core`, `apps/server`, `quotas`, and `metering` do not expose competing production abstractions.
- [ ] B1.A7 Metering contracts support an idempotent account/operation/event identity and bounded non-secret provider, credential-source, result, logical-phase, and upstream-attempt fields.

### Verification Commands

```bash
nx test @workout-agent/shared
nx test @workout-agent-ce/server-core
nx test quotas
nx test metering
nx run-many -t typecheck,lint,build --projects=@workout-agent/shared,@workout-agent-ce/server-core,quotas,metering
```

## PR B2 - PostgreSQL Billing Schema And Repositories

### Implementation Tasks

- [ ] B2.1 Add Drizzle tables and one migration under `packages/server-db` for webhook events, customer mappings, entitlement projections, quota windows, quota reservations, and durable usage events.
- [ ] B2.2 Enforce unique source/event IDs, unique external customer mappings, account-scoped `(account_id, operation_key)` reservations, account-scoped metering event keys, user foreign keys, and indexes for active window/reservation lookup.
- [ ] B2.3 Implement authenticated customer bootstrap and idempotent reconciliation of previously unmapped ledger events.
- [ ] B2.4 Implement one-transaction webhook ledger/projection processing with row locking and the B1 normalizer/reducer; webhook data alone cannot create account ownership.
- [ ] B2.5 Implement account-scoped entitlement reads that derive expiry from paid/grace boundaries when a final expiration webhook is delayed.
- [ ] B2.6 Implement atomic reserve/commit/rollback with row locking, idempotent transitions, and durable pending-reservation TTL metadata. Leave result-aware autonomous reclaim disabled until B4.
- [ ] B2.7 Add a `server-db` PostgreSQL integration target that applies the repository migration and runs B1's contract suites against two independent repository instances sharing one database.
- [ ] B2.8 Add redacted structured outcomes for applied, duplicate, stale, ignored, unmapped, conflict, mapping, reserve, commit, rollback, and reconciliation operations.
- [ ] B2.9 Implement the canonical durable metering sink with idempotent success/failure writes and bounded non-secret fields; do not derive production metering from a process-local array.

### Acceptance Criteria

- [ ] B2.A1 Entitlements, mappings, ledger outcomes, reservations, and committed usage survive repository/server recreation.
- [ ] B2.A2 Duplicate and stale deliveries are persisted but never mutate the current projection.
- [ ] B2.A3 Concurrent reservations from separate instances never exceed the window limit.
- [ ] B2.A4 Commit and rollback are idempotent and address only their exact reservation; automated TTL reclaim remains disabled until B4 can inspect durable attempt state.
- [ ] B2.A5 Unknown accounts, apps, environments, products, and entitlements cannot grant access.
- [ ] B2.A6 The schema and repositories use the existing `packages/server-db` client, Cloud SQL support, and single migration lineage rather than a parallel database package.
- [ ] B2.A7 Replaying one operation cannot duplicate its usage event, while two accounts may independently use the same client operation-key string.

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

- [ ] B3.1 Keep the entitlement and RevenueCat webhook routes in `apps/server` as thin adapters over the B2 repositories; gate both routes on `BILLING_PROVIDER=revenuecat`.
- [ ] B3.2 Replace direct `HostedBillingRuntime` construction in `wiring.ts` with the durable repositories and canonical B1 policy/metering contracts.
- [ ] B3.3 Delete the process-local hosted entitlement, customer, quota, and metering maps from production code. Retain a memory adapter only through an explicit test/development entry point.
- [ ] B3.4 Extend the environment-only `validateBootConfig` path to parse required `REVENUECAT_WEBHOOK_SECRET`, allowed app/environment/entitlement/product lists, `BILLING_FREE_GENERATION_LIMIT`, `BILLING_PRO_GENERATION_LIMIT`, and `BILLING_QUOTA_WINDOW_DAYS`; reject empty, duplicate, unbounded, invalid-enum, and invalid-number values without performing database I/O.
- [ ] B3.5 Use `DEPLOYMENT_MODE=hosted` plus `BILLING_PROVIDER=revenuecat`; delete `EDITION`, `HOSTED_BILLING_ENABLED`, the three `HOSTED_*` quota names, and `REVENUECAT_ALLOW_UNSIGNED_WEBHOOKS` from code, tests, root/app env examples, README, and AGENTS guidance.
- [ ] B3.6 Accept only `Authorization: Bearer <REVENUECAT_WEBHOOK_SECRET>` for RevenueCat webhooks, remove `x-revenuecat-signature`, and test that no environment or route path accepts unsigned production or development webhook state.
- [ ] B3.7 Extend `/api/ready` with billing schema/repository health when RevenueCat billing is enabled; connectivity/schema failure keeps readiness false and dependent routes return service unavailable before managed provider work, without turning boot validation into an I/O probe.
- [ ] B3.8 Wire authenticated customer bootstrap and unmapped-event reconciliation before purchase or restore UI can initiate RevenueCat work.
- [ ] B3.9 Reset non-production billing data and apply the new schema without a backfill or compatibility transform.
- [ ] B3.10 Add route/composition cases for self-hosted billing-disabled, hosted durable, provider-disabled webhook, malformed/scope-invalid event, cancellation-before-expiry, duplicate, stale, mapping conflict, and unavailable repository states.

### Acceptance Criteria

- [ ] B3.A1 Self-hosted mode starts with billing disabled and generation unrestricted by billing services.
- [ ] B3.A2 Hosted RevenueCat production cannot start without valid durable-adapter/database and authenticated-webhook configuration; database connectivity/schema health is enforced through readiness rather than boot I/O.
- [ ] B3.A3 No process-local hosted entitlement, customer, quota, or metering state remains in production composition.
- [ ] B3.A4 Restarting the server does not change entitlement, mapping, ledger, reservation, or quota state.
- [ ] B3.A5 Billing routes are part of the consolidated server image and do not rely on private source injection or a second application.
- [ ] B3.A6 Readiness reflects billing repository/schema health only when billing is enabled, and failures do not invoke a managed model provider.
- [ ] B3.A7 `rg` finds no runtime or documentation use of removed deployment, quota, unsigned-webhook, or custom-signature aliases outside historical OpenSpec artifacts.

### Verification Commands

```bash
nx test @workout-agent-ce/server
nx run @workout-agent-ce/server:typecheck
nx lint @workout-agent-ce/server
nx build @workout-agent-ce/server
nx run @workout-agent-ce/server-e2e:e2e
docker build -f docker/Dockerfile.server -t workout-agent-server:billing .
docker build -f docker/Dockerfile.migrate -t workout-agent-migrate:billing .
```

## PR B4 - Atomic Generation And Quota Finalization

### Prerequisites

- [ ] B4.P1 B3 is merged or stacked beneath this PR.
- [ ] B4.P2 `harden-workout-generation` G1 and G5 are merged so billing bypass uses selected credential provenance and attempts use stable account-scoped idempotency.

### Implementation Tasks

- [ ] B4.1 Add durable generation-attempt/result persistence to `packages/server-db` using the G5 contract and existing migration lineage.
- [ ] B4.2 Persist validated attempt success, its idempotent successful usage summary, and the exact quota reservation commit in one PostgreSQL transaction before returning or replaying the result. If an outbox is necessary, replay waits for reconciliation.
- [ ] B4.3 Enable TTL reclaim only through result-aware reconciliation: roll back reservations with no durable result and commit result-ready outbox entries before replay.
- [ ] B4.4 Wire `apps/server` generation to the durable attempt/finalization implementation for hosted RevenueCat mode; remove every permissive or process-memory hosted fallback.
- [ ] B4.5 Add credential-source cases: matching provider BYOK bypasses entitlement quota; unrelated or unused key headers do not; managed and Vertex credentials reserve quota.
- [ ] B4.6 Add end-to-end cases for concurrent last-slot reservation, duplicate idempotency across sessions, crash before/after finalization, restart, reclaim, replay, and two server instances.
- [ ] B4.7 Document operational inspection for stuck reservations, result reconciliation, unmapped events, and webhook conflicts without rollout flags.

### Acceptance Criteria

- [ ] B4.A1 A quota limit of N permits at most N committed or active reservations across instances.
- [ ] B4.A2 A crash before atomic finalization leaves no replayable result and permits rollback/expiry; a crash after finalization leaves both replayable result and committed usage.
- [ ] B4.A3 No result-ready generation becomes free through TTL reclaim.
- [ ] B4.A4 The only billing bypass is a credential selected from a matching BYOK header for the chosen provider.
- [ ] B4.A5 Two sessions for one `auth.userId` replay the same completed idempotent result, while another user with the same key string has an independent operation.
- [ ] B4.A6 Restarting either server instance preserves attempt, result, entitlement, and quota state.
- [ ] B4.A7 A successful replay does not duplicate metering, and a failed attempt records a durable failure outcome without committing quota.

### Verification Commands

```bash
nx test @workout-agent-ce/server-core
nx test server-db
nx test quotas
nx test metering
nx test @workout-agent-ce/server
nx run-many -t typecheck,lint,build --projects=@workout-agent-ce/server-core,server-db,quotas,metering,@workout-agent-ce/server
nx run @workout-agent-ce/server-e2e:e2e
```

Manual crash/restart/concurrency proof is also required: run two server processes in hosted RevenueCat mode against one migrated PostgreSQL database, reserve the final quota slot concurrently, terminate a process immediately before and after result finalization, restart both processes, and confirm replayable results and quota counters remain consistent.

## Final Change Verification

- [ ] V1 Run `npm run validate:openspec -- make-hosted-billing-durable` successfully using the repo-owned CLI from package-and-CI PR 1.
- [ ] V2 Run `nx sync:check` and the complete applicable lint, typecheck, test, build, server E2E, and Docker image gates.
- [ ] V3 Run the PostgreSQL contract, restart, crash-point, and two-instance quota checks from B2-B4.
