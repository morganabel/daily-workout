## Context

This change builds on the `refactor-open-core-server` proposal which established dependency injection patterns and the `AuthProvider` interface. The hosted service needs real authentication to tie subscriptions, metering, and billing to user accounts.

**Stakeholders:**
- OSS users: Can continue using `StubAuthProvider` for local development without a database.
- Hosted users: Get real accounts with email/password login.
- Mobile app: Needs seamless session management across app restarts.

## Goals / Non-Goals

**Goals:**
- Replace stub authentication with real user accounts for hosted deployments.
- Maintain backward compatibility: OSS mode without `DATABASE_URL` still works with stub auth.
- Preserve local-first architecture: user preferences and workout data stay on device.
- Enable future billing/metering by establishing user identity.

**Non-Goals:**
- Social login (Google, Apple) — can be added later as a separate change.
- Email verification — users can sign up and use immediately.
- Password reset flow — out of scope for initial implementation.
- Migrating existing device tokens to user accounts — future work.

## Decisions

### Edition Terminology

**Decision:** Standardize on `EDITION=CE|HOSTED` across docs and code (Community Edition vs Hosted overlay).

**Rationale:**
- The repo already uses “CE” as the public distribution model, and “Hosted” as the managed service overlay.
- Reduces ambiguity versus mixing `OSS`/`CE` in different places.

### Database: PostgreSQL with Drizzle ORM

**Decision:** Use PostgreSQL via Drizzle ORM in a new `packages/server-db` package.

**Rationale:**
- PostgreSQL is production-ready and widely supported by hosting providers.
- Drizzle ORM is lightweight, type-safe, and has first-class Better Auth adapter support.
- Separate package allows hosted overlay to extend with billing tables.

**Alternatives considered:**
- SQLite/Turso: Simpler but less suitable for central platform data.
- Prisma: Heavier, and project.md already mentions migrating away from it.

### Auth Library: Better Auth

**Decision:** Use Better Auth with the Drizzle adapter.

**Rationale:**
- TypeScript-first, modern API design.
- Built-in Expo/React Native support via `@better-auth/expo`.
- Plugin architecture for future extensibility (2FA, social providers).
- Session-based auth works well with existing `AuthProvider` interface.

**Alternatives considered:**
- Auth.js (NextAuth): More established but heavier, less focused on mobile.
- Custom JWT implementation: More work, reinventing the wheel.
- Clerk/Auth0: External dependencies, cost for hosted service.

### Session Strategy: Bearer Token Sessions (Mobile-First)

**Decision:** Authenticate API requests using bearer tokens (`Authorization: Bearer <token>`). Do not require cookie-based auth for mobile.

**Rationale:**
- Bearer transport works consistently across React Native/Expo and self-hosted backends.
- Avoids cookie/CSRF complexity that is awkward for native mobile apps.
- `@better-auth/expo` can still manage secure storage on mobile, with `storagePrefix` for per-backend session isolation.

### Auth Methods: Anonymous + Email/Password (Initial)

**Decision:** Start with **anonymous sessions** by default, with an optional upgrade path to **email/password**. No email verification required initially.

**Rationale:**
- Preserves today’s “no-friction” first-run experience (no auth UI required).
- Upgrading to email/password later enables cross-device access, billing identity, and account recovery (future).
- No email infrastructure required initially; social providers can be added incrementally.

### DeviceToken Deprecation (Auth vs. Device Identity)

**Decision:** Treat the current “DeviceToken” bearer scheme as a legacy fallback for DB-less CE/dev, and use Better Auth sessions (including anonymous) as the primary auth mechanism when available.

**Rationale:**
- The current DeviceToken is effectively an unauthenticated install identifier; it is not suitable as an account identity for billing/subscriptions.
- Anonymous sign-in provides a real server-side principal immediately, without requiring user interaction, and can later be upgraded.
- Keeps CE self-hosting simple: no DB required unless you want real accounts.

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Database adds operational complexity | Conditional wiring: no DB required for CE/dev stub mode |
| Session invalidation on backend switch | Use unique `storagePrefix` per backend URL |
| Better Auth breaking changes | Pin to stable version, review before upgrading |
| Accidental credential leakage in logs | Add explicit “secrets never logged” requirements + tests; remove request-body logging on auth flows |
| Silent auth misconfiguration in production | Fail fast when `EDITION=HOSTED` but Better Auth is not configured |

## Migration Plan

1. **Phase 1 (this change):** Add auth infrastructure, both auth modes work in parallel.
2. **Phase 2 (future):** Device token to account linking for existing users.
3. **Phase 3 (future):** Deprecate stub auth for hosted mode.

**Rollback:** Remove `DATABASE_URL` to revert to stub auth; no data migration needed.

## Open Questions

- Password reset flow design (future change).
- Account deletion and data retention policy (future change).
