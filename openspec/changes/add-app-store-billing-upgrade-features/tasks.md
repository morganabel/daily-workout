## 1. Shared Contracts and Compatibility

- [x] 1.1 Extend shared `MetaResponse` with optional `billing` capability fields (`enabled`, `showUpgradeUi`, `purchaseMethod`, `allowByok`).
- [x] 1.2 Add/align shared billing + entitlement response schemas needed by mobile and hosted overlays (including optional upgrade metadata on quota denials).
- [x] 1.3 Add contract tests for backward compatibility (missing `billing` fields must parse as billing-disabled behavior).

## 2. Server Capability Wiring (Open Core / CE)

- [x] 2.1 Update `/api/meta` response creation to include billing capability defaults for CE/self-host (`billing` disabled or omitted safely).
- [x] 2.2 Keep generation denial contract machine-actionable (`QUOTA_EXCEEDED` and `BYOK_REQUIRED`) with no provider invocation on policy deny. Ensure BYOK detection runs before `UsagePolicy` check so BYOK requests bypass entitlement quota.
- [x] 2.3 Add server tests for CE behavior to verify no forced paywall state is advertised and existing generation flows remain intact.

## 3. Hosted Entitlements and Billing Enforcement (Overlay)

- [x] 3.1 Implement hosted entitlement read endpoint (authenticated, account-bound) returning plan status, quota window, and remaining allowance.
- [x] 3.2 Implement hosted `UsagePolicy` checks that enforce entitlements before model calls and return `QUOTA_EXCEEDED` when over limit.
- [x] 3.3 Integrate RevenueCat webhooks for purchase verification and entitlement grant; map RevenueCat customer ID to `userId` for account-bound entitlement synchronization.

## 4. Mobile Billing Infrastructure

- [x] 4.1 Add a mobile billing adapter abstraction (`NoOpBillingClient` + `RevenueCatBillingClient`) using RevenueCat React Native SDK, selected from runtime capabilities.
- [x] 4.2 Add entitlement refresh/query client flow for hosted billing (initial load, post-purchase refresh, restore refresh).
- [x] 4.3 Ensure purchase tokens/receipts are treated as secrets in client logging paths (no raw token logging).

## 5. Mobile Upgrade UX and Error Routing

- [x] 5.1 Add capability-gated upgrade entry points in Home/Profile surfaces (visible only when `billing.showUpgradeUi=true`).
- [x] 5.2 Add paywall flow with purchase, restore, and processing states for `purchaseMethod='iap'`.
- [x] 5.3 Route generation errors by code: `QUOTA_EXCEEDED` -> upgrade flow (when enabled), `BYOK_REQUIRED` -> BYOK setup flow.
- [x] 5.4 Preserve CE/self-host UX by hiding paywall surfaces when billing is disabled/unknown and keeping existing BYOK-first advanced path.

## 6. Validation and Release Safety

- [x] 6.1 Add/update automated tests for shared contracts, `/api/meta` capability gating, generation error routing, and billing adapter behavior.
- [x] 6.2 Run affected Nx targets and fix failures (`nx test shared`, `nx test server`, `nx test mobile`, plus relevant lint/typecheck targets).
- [x] 6.3 Execute manual matrix checks: CE self-host (no paywall), hosted free over-limit (upgrade shown), hosted BYOK-required (BYOK route), and post-purchase/restore entitlement recovery.
