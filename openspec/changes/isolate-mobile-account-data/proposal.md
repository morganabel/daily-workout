## Why

The mobile app currently treats a route-provided workout plan, today's selected workout, all planned workouts, the current auth cookie, the local SQLite database, and the device-wide BYOK keys as if they describe one identity. Those assumptions can make a future-dated preview silently switch to today's workout, make Discard delete every planned workout while leaving child rows behind, let an unverified cookie bypass the launch gate, and expose one account's local data or AI key after an account or backend change.

No production users or durable mobile data need to be preserved. This change can replace the unsafe contracts directly and intentionally reset the existing unscoped local database and legacy SecureStore keys instead of carrying migration, quarantine, compatibility, or staged-rollout machinery.

## What Changes

- Route workout previews by a stable local workout ID and always reload that exact record.
- Preserve the selected workout's scheduled date and baseline identity during regeneration.
- Replace the unscoped planned-workout discard operation with an ID-scoped graph deletion that removes exercises and sets, clears planned-event links, and preserves unrelated workouts.
- Introduce explicit auth-capability and session states so an unavailable `/api/meta` response is never interpreted as auth-disabled and a stored cookie is never treated as a verified session.
- Centralize `401 UNAUTHORIZED` recovery so protected API failures invalidate the active principal, unmount its data, and reset navigation to Launch.
- Resolve a stable mobile principal from the canonical backend plus either verified Better Auth `userId` or the auth-disabled stub install ID, then bind that subject to an opaque install-local storage scope; never derive data ownership from a cookie, bearer token, session-scoped `principalId`, deployment mode, or edition.
- Mount a separate SQLite/WatermelonDB partition for each resolved principal and construct repositories from that scoped database rather than module-level global singletons.
- Namespace BYOK credentials by the same data scope so keys cannot cross account or backend boundaries.
- Destructively discard the existing unscoped schema and unscoped BYOK keys on upgrade.

## Capabilities

### New Capabilities

- `mobile-data-isolation`: Defines principal-owned SQLite partitions, repository lifecycle, scoped secure settings, and the intentional destructive reset from the current unscoped storage model.

### Modified Capabilities

- `authentication`: Defines authoritative mobile auth resolution, stable principal derivation, and centralized unauthorized recovery.
- `home-data`: Requires exact workout lookup, date-preserving regeneration, and ID-scoped planned-workout graph deletion.
- `mobile-ui`: Requires preview and discard actions to remain bound to the exact workout the user selected.

## Impact

- Affected app: `apps/mobile` navigation, launch/auth state, API client, local database bootstrap, repositories, SecureStore helpers, debug tooling, and tests.
- Affected contracts: internal mobile route parameters, auth-resolution state, repository construction, and BYOK storage keys. No public server API change is required.
- Auth-disabled impact: self-hosted stub backends use a stable per-install subject within the canonical backend scope; hosted mode remains fail-closed on Better Auth.
- Better Auth impact: self-hosted or hosted Better Auth backends use the verified account `userId` as a binding subject. Better Auth 1.7 anonymous transition changes A to B, so a server-verified transition atomically reassigns A's opaque storage binding to B. Session `principalId`, tokens, and cookies remain session/credential data, not ownership identifiers.
- Billing impact: no entitlement or quota semantics change; RevenueCat logout/reset hooks consume the same centralized principal lifecycle.
- Data impact: the existing unscoped mobile database and legacy unscoped BYOK entries are deleted. This is intentional because there are no users to migrate.
- Cross-change dependency: origin's workflow is an existing partial baseline. M1 and M2 may be developed now, but package-and-CI PR 1 must add npm 12 and explicit typecheck before mobile implementation PRs merge. The Better Auth 1.7 account-transition change must land before M2 so principal resolution implements opaque A-to-B binding handoff instead of the superseded same-user assumption. Native ESM repair is not a prerequisite.
