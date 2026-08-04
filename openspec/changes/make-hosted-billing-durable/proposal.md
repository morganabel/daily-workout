## Why

The hosted billing path currently keeps entitlements, RevenueCat customer mappings, and quota counters in process-local `Map` instances. A restart erases paid access and usage, and multiple server instances can grant quota independently. The webhook model also drops the RevenueCat event ID, event timestamp, app, and environment, so it cannot reject duplicates or stale events. It treats `CANCELLATION` like `EXPIRATION`, revoking access before the paid period ends.

There are no production users or billing records to preserve. We can replace the current runtime directly instead of adding compatibility reads, backfills, dual writes, feature flags, or a staged rollout.

## What Changes

- Replace the loose RevenueCat webhook shape with a bounded, normalized event contract that retains identity, ordering, application, environment, product, entitlement, purchase, and expiration data.
- Authenticate webhooks and validate the configured RevenueCat app, environment, entitlement, and product before any account or billing state changes.
- Establish RevenueCat-to-account mappings only from an authenticated hosted billing bootstrap; webhooks may resolve or reconcile existing mappings but may not create arbitrary account ownership.
- Make webhook processing idempotent by event ID and order-aware by vendor event time. Store duplicates and stale deliveries as non-mutating outcomes.
- Correct subscription lifecycle semantics: cancellation disables renewal but preserves paid access through the current period; expiration ends access; later renewals and uncancellations cannot be overwritten by older deliveries.
- Replace generic quota increments with durable, account-scoped included-generation reservations: atomic reserve against the active window, commit on success, rollback on failure, and TTL expiry for abandoned pending reservations. A crash between provider success and commit may miscount a single generation; that is accepted until launch scale justifies atomic finalization.
- Separate included-generation allowance from managed-provider spend. Actual provider cost for every upstream attempt is already metered durably; deny managed generation before provider invocation when configured per-account or global daily spend ceilings are reached, and fail closed when pricing or the spend query is unavailable. No pre-invocation cost reservation; ceilings are set with headroom for bounded in-flight overshoot.
- Add in-process per-account request-rate and active-generation concurrency admission at the generation route. The deployment is a single server instance; better-auth's built-in rate limiter already covers auth endpoints, and no durable admission state is introduced. BYOK bypasses included-generation allowance and spend ceilings only; it does not bypass admission.
- Make `packages/quotas` and `packages/metering` the single provider-neutral entitlement/reservation and usage-event contracts; remove or repurpose the overlapping check-only, process-array, `UsagePolicy`, and app-local production abstractions.
- Implement the PostgreSQL event ledger, entitlement projection, customer mapping, and included-generation quota windows/reservations in this repository through the existing `packages/server-db` migration lineage. Spend ceilings read the existing durable `ai_usage_event` cost data; no admission or spend tables are added.
- Wire the single `apps/server` directly to durable billing in hosted RevenueCat mode, extending its existing boot validation and readiness checks.
- **BREAKING** Remove the process-local hosted billing runtime, deprecated deployment aliases, and every production memory fallback. Origin already rejects unsigned production webhooks; preserve and test that invariant rather than reimplementing it.

## Capabilities

### Modified Capabilities

- `billing-entitlements`: Corrects RevenueCat lifecycle behavior and requires durable, idempotent entitlement and quota enforcement.
- `open-core-architecture`: Updates the boundary to the consolidated product repository, single server, one database lineage, and private image-publishing deployment repository.

## Dependencies

- Before syncing or archiving older changes, their private-app, private-overlay, permissive-fallback, and progressive-rollout requirements must be revised or superseded by the consolidated architecture now present on origin. The consolidation change named by origin is absent from the OpenSpec tree, so the current architecture must first be captured as a canonical prerequisite.
- Package-and-CI PR 1 must complete npm 12 and explicit typecheck gates before these implementation PRs merge. Native ESM repair is independent repository hardening, not a billing adapter prerequisite in the single-server image.
- Hosted quota enforcement must use generation G1's provider-selected credential attribution. This change no longer depends on generation G5; atomic result/quota finalization and idempotent result replay are deferred until launch scale justifies them.
- This change supersedes the in-memory hosted enforcement described by `add-app-store-billing-upgrade-features`; it does not replace that change's mobile purchase or capability-discovery work.

## Impact

- Affected code: `packages/shared`, `packages/server-core`, `packages/quotas`, `packages/metering`, `packages/server-db`, `apps/server` composition/boot/readiness, and the existing billing routes.
- Private deployment repository: no source adapter change. It continues publishing the standalone images built from this repository.
- Affected APIs: RevenueCat webhook responses become explicitly `applied`, `duplicate`, `stale`, `ignored`, or rejected; entitlement responses expose renewal and paid-period boundaries; generation may return stable rate, concurrency, spend-ceiling, or dependency-unavailable errors before provider invocation.
- Self-host: billing remains disabled and unrestricted by default; durable billing code exists in the product image but is not initialized or required when `BILLING_PROVIDER=none`.
- Hosted: managed-key generation is unavailable when the durable billing dependency is absent or unhealthy; BYOK behavior is governed by the selected credential source.
- Data migration: none. Development billing tables and state may be dropped and recreated.
