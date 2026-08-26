## Why

The current anonymous-account upgrade work preserves the anonymous Better Auth user ID through custom credential and session reassignment, duplicating identity behavior that stable Better Auth 1.7 now handles across mobile OAuth callbacks. We should adopt its standard anonymous account transition and make Workout Agent explicitly migrate application-owned state from the anonymous user to the canonical credentialed user.

## What Changes

- Upgrade `better-auth`, `@better-auth/expo`, and the renamed `auth` CLI together to one exact stable Better Auth 1.7 patch, backfill the new issuer-scoped account identity, regenerate the auth schema, and review the generated database migration before deploying account transition.
- Replace custom anonymous-user promotion and provider-profile persistence with Better Auth's supported anonymous plugin transition: Better Auth creates or resolves credentialed user B, invokes `onLinkAccount({ anonymousUser: A, newUser: B })`, and deletes A only after the callback succeeds.
- **BREAKING** Stop promising that anonymous registration preserves `userId`. Treat A to B as an explicit ownership transition and migrate only Workout Agent-owned rows in an idempotent PostgreSQL transaction; Better Auth remains solely responsible for auth users, accounts, and sessions.
- Support fresh email registration and Google OAuth transition first. Define deterministic recovery for callback failure and retry, and do not enable transition into an existing credentialed account until its collision/merge policy is implemented and tested.
- Verify mobile OAuth completion by refreshing the session and confirming the expected non-anonymous account before reporting success or handing off local data.
- Add a durable, idempotent mobile data-scope handoff from A to B for the same backend and user-initiated transition. Never infer a handoff from two sequential sessions or expose A's local database/BYOK data during an unrelated sign-in.
- Give every hosted Workout Agent account a server-generated opaque RevenueCat identity C. Mobile MUST obtain C from an authenticated bootstrap that accepts no client-selected owner or customer ID, reconcile the SDK to C before exposing billing, and keep C stable while application ownership moves from anonymous A to credentialed B without any RevenueCat call in the auth callback.
- Keep CE behavior billing-neutral: self-hosted Better Auth deployments may use the same transition behavior, while auth-disabled CE deployments have no account transition.
- Treat account transition as an inherent Better Auth capability rather than an independently configurable feature; keep Google client credentials server-only in deployment or ignored local environment files.

## Capabilities

### New Capabilities

- `account-transition`: Defines the A-to-B ownership transition, application-data migration boundary, retry/recovery semantics, local mobile scope handoff, and existing-account safety gate.

### Modified Capabilities

- `authentication`: Replaces same-user-ID anonymous promotion with Better Auth 1.7's standard anonymous account transition for email and Google, including verified mobile OAuth completion.
- `billing-entitlements`: Establishes a server-owned canonical RevenueCat identity, keeps entitlement and usage reads free of ownership side effects, and moves that identity from anonymous A to canonical account B with application state.

## Impact

- Dependencies and tooling: root package manifest/lockfile, Better Auth server, Expo, and CLI packages, generated auth schema, and PostgreSQL migrations.
- Server: `packages/server-auth`, `packages/server-db`, auth route wiring, migration/reconciliation diagnostics, and integration tests against PostgreSQL.
- Mobile: auth client and screens, session verification, principal/data-scope lifecycle, scoped SQLite and BYOK ownership work, and billing entry points.
- Hosted billing: RevenueCat SDK initialization/login timing and billing bootstrap authorization; webhook identity mapping remains server-owned.
- OpenSpec: supersedes the same-`userId` assumptions in the active `isolate-mobile-account-data` change before that unimplemented change may proceed.
