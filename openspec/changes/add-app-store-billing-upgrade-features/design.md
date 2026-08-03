## Context

The current mobile app can detect backend auth capabilities through `/api/meta`, but it has no equivalent contract for billing capabilities or upgrade flows. When hosted users exceed allowance, generation failures are surfaced as generic errors, and there is no intentional path to purchase or restore access. At the same time, the CE product promise requires self-hosting to remain fully functional with no artificial paywalls.

This change introduces billing-aware UX and entitlement enforcement for hosted deployments while preserving open-core boundaries: self-host remains no-op for billing policy/metering, and the canonical `apps/server` composes commercial behavior in hosted mode.

## Goals / Non-Goals

**Goals:**

- Add runtime capability signaling so mobile can deterministically decide whether to show upgrade/paywall UI.
- Keep server-side enforcement authoritative for hosted quotas/entitlements.
- Provide a store-compliant mobile purchase and restore flow for iOS/Android hosted deployments.
- Preserve CE/self-host behavior (no mandatory upgrades, no forced paywall screens, BYOK still available).
- Keep capability discovery tolerant of a missing billing block while cutting the server directly to the consolidated architecture.

**Non-Goals:**

- Implementing proprietary hosted billing storage/providers in CE.
- Removing BYOK or changing existing BYOK header semantics.
- Introducing web checkout in this change (mobile store purchases are the initial path).
- Platform admission, spend ceilings, and circuit breaking are specified by the successor generation-hardening and durable-billing changes rather than this purchase-UX change.
- Reworking unrelated generation/auth architecture.

## Decisions

### 1) Use `/api/meta` as the top-level billing UX gate

**Decision:** Extend shared `MetaResponse` with an optional `billing` capability block that indicates whether upgrade UI should be shown for the connected backend.

Proposed shape (conceptual):

- `billing.enabled: boolean`
- `billing.purchaseMethod: 'none' | 'iap'`
- `billing.showUpgradeUi: boolean`
- `billing.allowByok: boolean`

`billing` defaults to disabled when missing so new clients remain compatible with older servers.

**Alternatives considered:**

- Infer billing from `edition === HOSTED` only. Rejected because not every hosted environment enables paid upgrades at the same time.
- Infer billing only from generation errors. Rejected because clients still need backend capabilities for profile/settings plan surfaces and safe quota-error routing.

### 2) Separate "capability discovery" from "current entitlement state"

**Decision:** Keep `/api/meta` as coarse capability discovery, and expose authenticated entitlement state via a billing endpoint in hosted mode (for example `GET /api/billing/entitlements`) so paywall and badges can reflect current plan/quota.

**Alternatives considered:**

- Put full entitlement/quota state in `/api/meta`. Rejected because `/api/meta` is unauthenticated and intended for lightweight capability detection.
- Put all logic client-side. Rejected because entitlement checks must be authoritative on the server.

### 3) Keep generation denial contract stable and machine-actionable

**Decision:** Continue using structured server errors for routing:

- `QUOTA_EXCEEDED` -> upgrade/paywall path
- `BYOK_REQUIRED` -> BYOK setup path

If additional detail is needed, include optional metadata fields while preserving existing top-level error codes for compatibility.

**Alternatives considered:**

- Add a brand-new top-level error code immediately. Rejected to reduce migration risk across existing clients.

### 4) Use RevenueCat as the mobile billing abstraction

**Decision:** Use RevenueCat SDK as the mobile billing abstraction layer, with a thin adapter wrapping it:

- `NoOpBillingClient` (default/CE) — returns no-op results for all billing operations
- `RevenueCatBillingClient` (hosted-capable) — delegates to RevenueCat SDK for purchases, restores, and entitlement queries

RevenueCat provides cross-platform StoreKit/Play Billing abstraction, server-side receipt validation, and webhook-driven entitlement management. This eliminates the need to build custom receipt verification and subscription lifecycle management. The app selects the billing client from meta capabilities, not build flavor alone. Purchase flow, restore purchases, and entitlement refresh are routed through this adapter.

**Alternatives considered:**

- Direct StoreKit/Play Billing integration. Rejected because it requires building cross-platform receipt validation, entitlement reconciliation, and subscription management from scratch.
- Inline billing SDK calls directly in screens. Rejected because it couples UI to vendor SDK and complicates testing.
- Compile separate CE/hosted apps. Rejected because runtime backend switching is a core use case.

### 5) Treat purchases as account-bound entitlements

**Decision:** Hosted entitlements are mapped to `auth.userId` server-side. Mobile purchase confirmation is not sufficient by itself; backend verification/reconciliation remains source of truth before elevated access is granted.

**Alternatives considered:**

- Trust local device purchase state alone. Rejected because it is vulnerable to desync and does not support server-enforced quotas.

### 6) Preserve self-host billing-neutral behavior by default

**Decision:** In CE wiring and default contracts:

- `billing.enabled = false`
- No upgrade UI entry points rendered when billing is disabled/missing
- Existing generation behavior remains unchanged except improved client routing for known error codes

Hosted mode opts into billing through `apps/server` deployment composition and durable repository-owned implementations. Production does not use a permissive billing fallback.

**Alternatives considered:**

- Enable upgrade UI by default and hide only when disabled explicitly. Rejected because older/self-host servers would show incorrect paywall affordances.

## Risks / Trade-offs

- [Capability drift between `/api/meta` and entitlement endpoint] -> Add contract tests that validate consistent hosted responses and safe defaults when fields are missing.
- [Purchase succeeds but entitlement grant is delayed] -> Surface a "processing purchase" state and poll/refresh entitlements with clear retry guidance.
- [Anonymous users hit paywall without account linkage] -> Require account upgrade/sign-in before final entitlement grant, with explicit copy in paywall flow.
- [Store SDK complexity in Expo] -> Use RevenueCat's React Native SDK (Expo-compatible) behind the billing adapter; cover with integration tests on both iOS and Android build pipelines.
- [Hosted rollout accidentally affects CE UX] -> Default all new billing fields to disabled and gate every upgrade surface behind capability checks.

## Migration Plan

1. **Contracts first**

   - Extend shared meta and error response typing with optional billing metadata/defaults.
   - Ensure new client parses old server responses safely (billing absent => disabled).

2. **Server capability wiring**

   - CE/open-core returns billing-disabled capabilities.
   - Hosted overlay adds billing capability and entitlement endpoints.

3. **Mobile gating and routing**

   - Add billing adapter and capability cache integration.
   - Gate upgrade UI in Launch/Profile based on billing capabilities.
   - Route `QUOTA_EXCEEDED` to paywall and `BYOK_REQUIRED` to BYOK setup.

4. **Hosted enforcement and verification**

   - Implement hosted policy entitlement checks in the canonical server.
   - Add purchase verification/reconciliation path that updates entitlements by `userId`.

5. **Direct cutover and rollback**

   - Validate entitlement, purchase, restore, and capability flows before enabling hosted production.
   - Roll back by reverting the deployment; managed generation fails closed when its durable billing dependency is unhealthy rather than using a permissive fallback.

## Open Questions

- ~~Should the initial IAP implementation use a direct StoreKit/Play Billing integration or an abstraction provider (for example RevenueCat) for faster cross-platform parity?~~ **Resolved:** Use RevenueCat for cross-platform billing, server-side receipt validation, and webhook-driven entitlement management. See Decision #4.
- ~~Must users always sign in before purchasing, or can anonymous sessions purchase and then link later without entitlement confusion?~~ **Resolved:** No sign-in gate needed. Better Auth anonymous plugin gives every user a stable `userId` from first launch, and `userId` is preserved when upgrading from anonymous to email (account linking). RevenueCat customer ID maps to `userId` immediately with no deferred linking or merge required.
- ~~What hosted entitlement model is first (fixed monthly generations, tiered model access, or both)?~~ **Resolved:** Out of scope for this change. The entitlement model remains abstract (`plan status`, `quota window`, `remaining allowance`) so hosted composition can evolve it without changing self-host behavior.
- ~~Should BYOK usage bypass hosted quota checks entirely, or still count toward some platform limits?~~ **Resolved:** only a credential actually selected from the chosen provider's matching BYOK header bypasses included-generation and managed-provider-spend quota. BYOK remains subject to account/source request-rate, concurrency, and infrastructure controls specified by the successor hardening and durable-billing changes.
