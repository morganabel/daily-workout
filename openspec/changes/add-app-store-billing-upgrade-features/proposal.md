## Why

The app currently has no first-class upgrade flow, so hosted users who hit usage limits get generic errors instead of a clear path to upgrade. We need a capability-driven billing UX that supports App Store / Play purchases for hosted deployments while keeping Community Edition self-hosting fully functional and free of paywall UI.

## What Changes

- Extend backend capability discovery (`/api/meta`) with billing fields so the mobile app can decide at runtime whether to show upgrade/paywall UI.
- Add hosted billing entitlement checks around generation limits, with structured responses that let clients route users to upgrade or BYOK flows.
- Introduce a mobile in-app purchase flow (purchase, restore, entitlement refresh) for hosted deployments using store-compliant billing.
- Add conditional upgrade entry points in mobile (for example Home/Profile) that appear only when billing is enabled by backend capabilities.
- Add explicit mobile error handling rules: `QUOTA_EXCEEDED` routes to upgrade/paywall, while `BYOK_REQUIRED` routes to BYOK setup.
- Preserve CE/self-host behavior: no billing enforcement, no forced upgrade screens, and BYOK remains available as an advanced option.
- Keep hosted routes and billing composition in the canonical `apps/server`; private deployment automation publishes images rather than supplying a source overlay.

## Capabilities

### New Capabilities

- `billing-entitlements`: Defines hosted entitlement states, usage-limit enforcement, and purchase/restore synchronization between mobile and backend policy checks.
- `mobile-upgrade-experience`: Defines runtime-gated upgrade UX, paywall triggers, and store purchase lifecycle handling in the mobile app.

### Modified Capabilities

- `authentication`: Expands `/api/meta` capability discovery requirements to include billing capability fields used for client-side UX gating.
- `home-data`: Updates generation endpoint behavior requirements for entitlement-denied upgrade paths in hosted mode alongside existing BYOK handling.
- `mobile-ui`: Updates screen-level requirements so upgrade UI appears only when backend capabilities enable billing, while self-host UX remains paywall-free.

## Impact

- Affected specs: `authentication` (modified), `home-data` (modified), `mobile-ui` (modified), plus new `billing-entitlements` and `mobile-upgrade-experience` specs.
- Affected code (CE/open core): `packages/shared` (meta + error contracts), `packages/server-core` (policy result semantics/hooks), `apps/mobile` (capability-aware upgrade/paywall routing), and optionally shared client service modules for purchase state.
- Affected code (hosted mode): repository-owned policy, metering, entitlement persistence, and store-purchase verification wiring composed by `apps/server`.
- APIs/contracts: `/api/meta` response shape and generation error handling contract for upgrade-related denials.
- Dependencies/systems: RevenueCat SDK for cross-platform in-app purchase (App Store / Play Store compliant), RevenueCat backend for receipt validation and entitlement management, and hosted entitlement synchronization via RevenueCat webhooks.
- CE vs Hosted: CE remains self-hostable with no artificial limits and no mandatory paywall UX; hosted gains metering-based limits and optional paid upgrades, with BYOK still supported.
