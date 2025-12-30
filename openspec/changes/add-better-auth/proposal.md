## Why

The current authentication uses a stub provider that accepts any bearer token. To enable subscriptions, metering, and billing, we need real user identity tied to authenticated accounts. Better Auth provides a modern, TypeScript-first authentication library that integrates well with the existing `AuthProvider` interface established in the open-core refactor.

## What Changes

- **Add Drizzle ORM package:** Create `packages/server-db` with PostgreSQL support for platform data (auth, future billing/usage tables).
- **Integrate Better Auth:** Configure Better Auth in `apps/server` using the Drizzle adapter, with **anonymous sessions** (default) and **email/password** as an upgrade path.
- **Bearer-session transport:** Standardize all authenticated API calls on `Authorization: Bearer <token>` (no cookie-based auth for mobile).
- **Implement BetterAuthProvider:** Create a new `AuthProvider` implementation in `packages/server-core` that validates bearer sessions via Better Auth and extracts user identity.
- **Fail-closed hosted auth:** When `EDITION=HOSTED`, the server MUST NOT silently fall back to stub auth if Better Auth is misconfigured.
- **Backward-compatible stub auth (CE/dev):** Preserve the current stub behavior for DB-less development/self-hosting (still using bearer tokens).
- **Add mobile auth client:** Integrate `@better-auth/expo` with SecureStore for session persistence and per-backend session isolation (`storagePrefix`).
- **Create auth UI:** Add optional sign-in and sign-up screens to the mobile app for users who want to upgrade from anonymous to email/password.
- **Prevent token leakage:** Add explicit requirements and implementation tasks to ensure passwords, bearer tokens, and session secrets are never logged or returned in errors.

## Impact

- **Affected specs:** Creates new `authentication` capability; builds on `open-core-architecture` (uses `AuthProvider` interface).
- **Affected code:** `packages/server-db` (new), `apps/server`, `packages/server-core`, `apps/mobile`.
- **Local-first preserved:** User preferences and workout data remain on-device (WatermelonDB); only auth/billing data lives on server.
