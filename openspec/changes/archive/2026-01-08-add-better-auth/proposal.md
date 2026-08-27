## Why

The current authentication uses a stub provider that accepts any bearer token. To enable subscriptions, metering, and billing, we need real user identity tied to authenticated accounts. Better Auth provides a modern, TypeScript-first authentication library that integrates well with the existing `AuthProvider` interface established in the open-core refactor.

## What Changes

- **Add Drizzle ORM package (`packages/server-db`):** PostgreSQL support for platform data (auth, future billing/usage tables). Exports factory functions (no side effects at import) so EE can initialize at runtime.
- **Add auth package (`packages/server-auth`):** Better Auth configuration and Next.js route handlers, separate from `server-core` to keep core framework-agnostic. Exports factories for auth instance creation.
- **Integrate Better Auth:** Configure with **anonymous sessions** (default) and **email/password** as an upgrade path, using bearer token transport.
- **Introduce stable `principalId`:** Replace "deviceToken" semantics with a stable `principalId` (derived from session ID, unique per device) for server-side state storage (generation status, last plan). Bearer tokens rotate; `principalId` does not. `principalId` is distinct from `userId`: use `userId` for billing/account-level data, `principalId` for session/device-scoped state like GenerationStore.
- **Implement BetterAuthProvider:** New `AuthProvider` implementation in `packages/server-auth` that validates bearer sessions and returns `AuthResult` with `userId` and `principalId`.
- **Auth-mode selection algorithm:** Deterministic resolution of auth mode based on `AUTH_MODE` env var and `DATABASE_URL` presence, reusable by EE verbatim.
- **Fail-closed hosted auth:** When `EDITION=HOSTED`, the server MUST crash at startup if Better Auth is not configured (no silent stub fallback).
- **No identity from arbitrary headers:** In Better Auth mode, identity MUST come from validating the bearer session, not from `x-user-id` or similar headers.
- **Add `/api/meta` endpoint:** Capabilities discovery endpoint returning auth methods available, protocol version, and feature flags. Enables clients to detect backend capabilities before auth. Response schema (`MetaResponse`) exported from `@leveza/shared` for type-safe client consumption.
- **Backward-compatible stub auth (CE/dev):** Preserve stub behavior for DB-less development/self-hosting.
- **Add mobile auth client:** Integrate `@better-auth/expo` with SecureStore, using `storagePrefix` derived from canonical backend URL for per-backend session isolation.
- **Anonymous-to-email linking:** When upgrading from anonymous to email/password, the system preserves the same `userId` for metering/billing continuity.
- **Create auth UI:** Optional sign-in and sign-up screens for users upgrading from anonymous.
- **Add Launch onboarding:** A Launch screen guides first-run users to `Explore` (explicit anonymous session) or sign up/sign in; BYOK is available as an advanced option.
- **Prevent token leakage:** Explicit "never log" list: `Authorization` header, request bodies for auth routes, session tokens, Better Auth secrets. Add redaction tests.
- **Avoid Edge middleware for auth:** DB-backed session validation and quota lookup MUST happen in Node route handlers / `UsagePolicy`, not Next.js Edge middleware.

## Impact

- **Affected specs:** Creates new `authentication` capability; builds on `open-core-architecture` (uses `AuthProvider` interface).
- **Affected code:** `packages/server-db` (new), `packages/server-auth` (new), `apps/server`, `packages/server-core`, `packages/shared`, `apps/mobile`.
- **EE compatibility:** New packages follow same conventions (ESM, exports, Nx buildable) so `apps/api-hosted` can import without special-casing.
- **Local-first preserved:** User preferences and workout data remain on-device (WatermelonDB); only auth/billing data lives on server.
