## 0. Terminology + Safety Baselines
- [x] 0.1 Standardize on `EDITION=CE|HOSTED` across repo docs/config (accept `OSS` as alias for `CE` during transition)
- [ ] 0.2 Add explicit "secrets never logged" constraints (server + mobile) and remove any request logging that could capture auth payloads
- [x] 0.3 Update error messages in handlers from "DeviceToken" to "Bearer token/session"

## 1. Database Setup (`packages/server-db`)
- [x] 1.1 Create `packages/server-db` Nx library (ESM, exports, Nx buildable)
- [x] 1.2 Add drizzle-orm and postgres dependencies
- [x] 1.3 Create Drizzle client factory (`createDb()`) - no side effects at import
- [x] 1.4 Generate Better Auth schema with CLI
- [x] 1.5 Configure drizzle-kit for migrations (`drizzle.config.ts`)
- [x] 1.6 Export schema and factory from package index
- [ ] 1.7 Run initial migration against local PostgreSQL

## 2. Auth Package (`packages/server-auth`)
- [x] 2.1 Create `packages/server-auth` Nx library (ESM, exports, Nx buildable)
- [x] 2.2 Create Better Auth factory (`createAuth()`) - no side effects at import
- [x] 2.3 Configure bearer token transport (no cookie requirement for mobile)
- [x] 2.4 Configure anonymous sessions plugin
- [x] 2.5 Configure email/password with account linking (anonymous→email preserves userId)
- [x] 2.6 Export Next.js route handler factory (`createAuthHandler()`)
- [x] 2.7 Add trusted web origins (CORS) for mobile clients
- [x] 2.8 Create `BetterAuthProvider` implementing `AuthProvider` interface
- [x] 2.9 BetterAuthProvider returns `principalId` derived from session ID (unique per device)
- [x] 2.10 BetterAuthProvider returns `userId` for account-level identity (billing, metering)
- [x] 2.11 Export `BetterAuthProvider` from package

## 3. Better Auth Server Integration (`apps/server`)
- [x] 3.1 Add `@workout-agent-ce/server-db` and `@workout-agent-ce/server-auth` dependencies
- [x] 3.2 Create `getAuthContext()` factory that initializes auth based on auth-mode
- [x] 3.3 Create catch-all auth API route (`apps/server/src/app/api/auth/[...all]/route.ts`)
- [x] 3.4 Implement auth-mode selection algorithm (AUTH_MODE ?? DATABASE_URL-based) in `getAuthContext()`
- [x] 3.5 Fail fast at startup if `EDITION=HOSTED` but Better Auth not configured
- [x] 3.6 Add `/api/meta` endpoint returning auth capabilities, protocol version, edition
- [x] 3.7 Add `MetaResponse` type to `@workout-agent-ce/shared` package
- [x] 3.8 Add environment variables to `.env.example` (DATABASE_URL, BETTER_AUTH_SECRET, AUTH_MODE)

## 4. Auth Provider Integration (`packages/server-core`)
- [x] 4.1 Update `AuthResult` type to include both `userId` and `principalId` (remove `deviceToken`)
- [x] 4.2 Update `StubAuthProvider` to return `principalId` (can use token as fallback for stub mode)
- [x] 4.3 Update handlers to use `auth.principalId` for GenerationStore (device-scoped state)
- [x] 4.4 Update handlers to use `auth.userId` for billing/metering (account-level data)
- [x] 4.5 Ensure identity comes only from AuthProvider, not from arbitrary headers (x-user-id, etc.)

## 5. Security Tests
- [ ] 5.1 Add test: Authorization header is redacted in server logs
- [ ] 5.2 Add test: Auth endpoint request bodies (email/password) are redacted in logs
- [ ] 5.3 Add test: Error responses do not include secrets
- [x] 5.4 Add test: Protected routes accept valid bearer sessions
- [x] 5.5 Add test: Protected routes reject missing/expired sessions (401)
- [x] 5.6 Add test: Hosted mode fails closed when DATABASE_URL missing
- [x] 5.7 Add test: Stub fallback works only in CE/no-DB mode
- [x] 5.8 Add test: x-user-id header is ignored in Better Auth mode
- [ ] 5.9 Manual test auth flow with curl/Postman

## 6. Mobile Client
- [x] 6.1 Add better-auth and @better-auth/expo to mobile
- [x] 6.2 Create `auth-client.ts` with Expo SecureStore
- [x] 6.3 Derive `storagePrefix` from hash of canonical backend URL
- [x] 6.4 Fetch `/api/meta` on startup to detect auth capabilities
- [x] 6.5 Implement silent anonymous sign-in on first run when backend supports it
- [x] 6.6 Add URL scheme to `app.json`
- [x] 6.7 Update `api.ts` to send `Authorization: Bearer <session>`
- [x] 6.8 Remove/redact auth headers/tokens from client debug logs

## 7. Auth UI
- [x] 7.1 Create SignInScreen with email/password form (upgrade from anonymous)
- [x] 7.2 Create SignUpScreen with registration form (upgrade from anonymous, preserves userId)
- [x] 7.3 Add auth guard to navigation
- [ ] 7.4 Test full auth flow on device/simulator
- [ ] 7.5 Test backend switching (verify storagePrefix isolation)
