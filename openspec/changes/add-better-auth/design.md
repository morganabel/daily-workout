## Context

This change builds on the `refactor-open-core-server` proposal which established dependency injection patterns and the `AuthProvider` interface. The hosted service needs real authentication to tie subscriptions, metering, and billing to user accounts.

**Stakeholders:**
- CE users: Can continue using `StubAuthProvider` for local development without a database.
- Hosted/EE users: Get real accounts with anonymous bootstrap and optional email/password upgrade.
- Mobile app: Needs seamless session management across app restarts and backend switching.
- EE overlay: Must be able to import CE packages without forking; needs deterministic auth-mode resolution.

## Goals / Non-Goals

**Goals:**
- Replace stub authentication with real user accounts for hosted deployments.
- Maintain backward compatibility: CE mode without `DATABASE_URL` still works with stub auth.
- Preserve local-first architecture: user preferences and workout data stay on device.
- Enable future billing/metering by establishing user identity.
- Provide EE-importable packages with no side effects at import time.
- Define deterministic auth-mode selection algorithm reusable by EE.

**Non-Goals:**
- Social login (Google, Apple) — can be added later as a separate change.
- Email verification — users can sign up and use immediately.
- Password reset flow — out of scope for initial implementation.
- Migrating existing device tokens to user accounts — future work.

## Decisions

### Edition Terminology

**Decision:** Standardize on `EDITION=CE|HOSTED` across docs and code. Temporarily accept `OSS` as an alias for `CE` during transition.

**Rationale:**
- The repo already uses "CE" as the public distribution model, and "HOSTED" as the managed service overlay.
- Reduces ambiguity versus mixing `OSS`/`CE` in different places.
- Explicit alias handling prevents silent breakage for existing configs.

### Package Structure: Framework-Agnostic Core

**Decision:** Split auth into multiple packages:
- `packages/server-db`: Drizzle client and schema (no Better Auth dependency).
- `packages/server-auth`: Better Auth configuration and Next.js route handlers.
- `packages/server-core`: Framework-agnostic `AuthProvider` interface and `BetterAuthProvider` implementation.

**Rationale:**
- Keeps `server-core` framework-agnostic (no Next.js imports).
- EE can import `server-db` and `server-auth` directly without forking.
- Follows same packaging conventions (ESM, exports, Nx buildable) as existing CE packages.

**Key constraint:** No side effects at import. All packages MUST export factory functions that EE can call at runtime, not initialize DB/auth at module top-level.

### Auth Context Factory Pattern (`getAuthContext`)

**Decision:** Create a `getAuthContext()` factory in `apps/server` that initializes auth based on auth-mode and returns the configured `AuthProvider`.

**Pattern:**
```typescript
// apps/server/src/lib/auth-context.ts
import { BetterAuthProvider } from '@workout-agent-ce/server-auth';
import { StubAuthProvider } from '@workout-agent-ce/server-core';
import type { AuthProvider } from '@workout-agent-ce/server-core';

let cachedAuthProvider: AuthProvider | null = null;

export function getAuthContext(): AuthProvider {
  if (cachedAuthProvider) return cachedAuthProvider;

  const authMode = process.env.AUTH_MODE ??
    (process.env.DATABASE_URL ? 'better-auth' : 'stub');

  if (authMode === 'better-auth') {
    // Initialize BetterAuthProvider with db and auth instance
    cachedAuthProvider = new BetterAuthProvider(/* ... */);
  } else {
    cachedAuthProvider = new StubAuthProvider();
  }

  return cachedAuthProvider;
}
```

**Rationale:**
- Single point of auth initialization in `apps/server`.
- Lazy initialization avoids import-time side effects.
- EE can override with its own `getAuthContext()` implementation.
- Cached instance avoids redundant initialization per request.

### Database: PostgreSQL with Drizzle ORM

**Decision:** Use PostgreSQL via Drizzle ORM in `packages/server-db`.

**Rationale:**
- PostgreSQL is production-ready and widely supported by hosting providers.
- Drizzle ORM is lightweight, type-safe, and has first-class Better Auth adapter support.
- Separate package allows EE to extend with billing tables.

### Auth Library: Better Auth

**Decision:** Use Better Auth with the Drizzle adapter.

**Rationale:**
- TypeScript-first, modern API design.
- Built-in Expo/React Native support via `@better-auth/expo`.
- Plugin architecture for future extensibility (2FA, social providers).
- Session-based auth works well with existing `AuthProvider` interface.

### Session Strategy: Bearer Token Sessions (Mobile-First)

**Decision:** Authenticate API requests using bearer tokens (`Authorization: Bearer <token>`). Do not require cookie-based auth for mobile.

**Rationale:**
- Bearer transport works consistently across React Native/Expo and self-hosted backends.
- Avoids cookie/CSRF complexity that is awkward for native mobile apps.

### Identity Semantics: `userId` vs. `principalId`

**Decision:** Introduce both `userId` and `principalId` in `AuthResult` with distinct purposes. Do NOT use the bearer token as a state key.

**Rationale:**
- `userId` = stable account-level identity for billing, metering, and cross-device account data.
- `principalId` = session/device-scoped identity for GenerationStore and device-specific state. Derived from session ID, unique per device/session.
- Bearer tokens can rotate (refresh, re-auth); using them as state keys causes data loss.
- Error messages should say "Bearer token/session" not "DeviceToken" in Better Auth mode.
- A single user on multiple devices should have different `principalId` values (one per device) but the same `userId`.

**AuthResult changes:**
```typescript
interface AuthResult {
  userId: string;       // Account identity - use for billing, metering, account-level data
  principalId: string;  // Session/device identity - use for GenerationStore, device-scoped state
}
```

### Auth-Mode Selection Algorithm

**Decision:** Use a deterministic algorithm for auth-mode resolution that EE can reuse verbatim.

```
AUTH_MODE = env.AUTH_MODE ?? (env.DATABASE_URL ? 'better-auth' : 'stub')

if (env.EDITION === 'HOSTED' && AUTH_MODE !== 'better-auth') {
  throw new Error('EDITION=HOSTED requires Better Auth (DATABASE_URL must be set)')
}
```

**Rationale:**
- Explicit `AUTH_MODE` env var allows override for testing/migration.
- Falls back to `DATABASE_URL` presence as the default signal.
- Fail-closed for hosted: crash at startup, not silent degradation.

### No Identity from Arbitrary Headers

**Decision:** In Better Auth mode, identity MUST come from validating the bearer session. Headers like `x-user-id`, `x-plan-id` MUST NOT be trusted for identity.

**Rationale:**
- Prevents header injection attacks in hosted mode.
- All identity flows through `AuthProvider.authenticate()`.

### Avoid Edge Middleware for Auth

**Decision:** Do not use Next.js `middleware.ts` (Edge runtime) for DB-backed session validation or quota lookup.

**Rationale:**
- Edge runtime has limited DB driver support.
- Auth + quota enforcement should happen in Node route handlers via `AuthProvider` and `UsagePolicy`.
- Middleware can still be used for lightweight redirects or static asset handling.

### Auth Methods: Anonymous + Email/Password (Initial)

**Decision:** Start with **anonymous sessions** by default, with an optional upgrade path to **email/password**.

**Rationale:**
- Preserves today's "no-friction" first-run experience (no auth UI required).
- Upgrading to email/password later enables cross-device access, billing identity, and account recovery (future).

### Anonymous-to-Email Linking Semantics

**Decision:** When upgrading from anonymous to email/password, the system MUST preserve the same `userId`.

**Rationale:**
- Metering and billing continuity: usage before and after upgrade is attributed to the same user.
- No data loss or orphaned records.

### Mobile `storagePrefix` Derivation

**Decision:** Derive `storagePrefix` from a hash of the canonical backend URL.

**Rationale:**
- Switching backends doesn't overwrite sessions from other backends.
- Avoids SecureStore key collisions.
- Canonical URL = normalized (lowercase host, no trailing slash).

### Capabilities Discovery Endpoint (`/api/meta`)

**Decision:** Add `/api/meta` endpoint returning auth capabilities, protocol version, and feature flags. Export the response schema from `@workout-agent-ce/shared`.

**Response schema (in `packages/shared`):**
```typescript
// packages/shared/src/types/meta.ts
export interface MetaResponse {
  protocolVersion: string;
  auth: {
    enabled: boolean;
    methods: ('anonymous' | 'email')[];
    anonymousAvailable: boolean;
    emailAvailable: boolean;
  };
  edition: 'CE' | 'HOSTED';
}
```

**Response example:**
```json
{
  "protocolVersion": "1.0.0",
  "auth": {
    "enabled": true,
    "methods": ["anonymous", "email"],
    "anonymousAvailable": true,
    "emailAvailable": true
  },
  "edition": "CE"
}
```

**Rationale:**
- Clients can detect backend capabilities before attempting auth.
- Enables graceful degradation and backend-switching logic.
- EE can extend with billing/subscription fields.
- Shared type ensures mobile client can consume response type-safely.

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Database adds operational complexity | Conditional wiring: no DB required for CE/dev stub mode |
| Session invalidation on backend switch | Use unique `storagePrefix` per backend URL (hashed) |
| Better Auth breaking changes | Pin to stable version, review before upgrading |
| Accidental credential leakage in logs | Explicit "never log" list + redaction tests |
| Silent auth misconfiguration in production | Fail-closed: crash at startup when `EDITION=HOSTED` but auth not configured |
| Edge middleware DB limitations | Enforce auth/quota in Node handlers, not Edge middleware |
| Bearer token used as state key | Introduce stable `principalId`; document that bearer tokens rotate |

## Security: Never-Log List

The following MUST NOT appear in logs or error responses:
- `Authorization` header value
- Request bodies for auth routes (email, password fields)
- Session tokens (access, refresh)
- Better Auth secrets (`BETTER_AUTH_SECRET`)
- Any `x-*-key` headers (BYOK keys)

**Verification:** Add tests that assert redaction in both server logs and error payloads.

## Migration Plan

1. **Phase 1 (this change):** Add auth infrastructure, both auth modes work in parallel.
2. **Phase 2 (future):** Device token to account linking for existing users.
3. **Phase 3 (future):** Deprecate stub auth for hosted mode.

**Rollback:** Remove `DATABASE_URL` to revert to stub auth; no data migration needed.

## Open Questions

- Password reset flow design (future change).
- Account deletion and data retention policy (future change).
- Exact Better Auth plugin configuration for anonymous sessions (verify plugin availability).
