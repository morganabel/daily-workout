## 0. Terminology + Safety Baselines
- [x] 0.1 Standardize on `EDITION=CE|HOSTED` across repo docs/config (no `OSS`/`CE` mixing)
- [ ] 0.2 Add explicit “secrets never logged” constraints (server + mobile) and remove any request logging that could capture auth payloads

## 1. Database Setup
- [ ] 1.1 Create `packages/server-db` Nx library
- [ ] 1.2 Add drizzle-orm and postgres dependencies
- [ ] 1.3 Create Drizzle client initialization (`src/client.ts`)
- [ ] 1.4 Generate Better Auth schema with CLI
- [ ] 1.5 Configure drizzle-kit for migrations (`drizzle.config.ts`)
- [ ] 1.6 Run initial migration against local PostgreSQL

## 2. Better Auth Server
- [ ] 2.1 Add better-auth dependency to apps/server
- [ ] 2.2 Create auth configuration in `apps/server/src/lib/better-auth.ts` (bearer transport + anonymous sessions + email/password)
- [ ] 2.3 Create catch-all auth API route (`apps/server/src/app/api/auth/[...all]/route.ts`)
- [ ] 2.4 Fail fast if `EDITION=HOSTED` but Better Auth is not configured (no silent stub fallback)
- [ ] 2.5 Add environment variables to `.env.example`

## 3. Auth Provider Integration
- [ ] 3.1 Create `BetterAuthProvider` in `packages/server-core/src/defaults/`
- [ ] 3.2 Export `BetterAuthProvider` from package
- [ ] 3.3 Update `wiring.ts` (hosted overlay) to use `BetterAuthProvider` when Better Auth is enabled
- [ ] 3.4 Add tests proving protected routes accept valid bearer sessions and reject missing/expired sessions
- [ ] 3.5 Manual test auth flow with curl/Postman

## 4. Mobile Client
- [ ] 4.1 Add better-auth and @better-auth/expo to mobile
- [ ] 4.2 Create `auth-client.ts` with Expo SecureStore + per-backend `storagePrefix`
- [ ] 4.3 Implement silent anonymous sign-in on first run when backend supports Better Auth
- [ ] 4.4 Add URL scheme to `app.json`
- [ ] 4.5 Update `api.ts` to send `Authorization: Bearer <session>` and never log auth headers/tokens (or request bodies for auth endpoints)

## 5. Auth UI
- [ ] 5.1 Create SignInScreen with email/password form (upgrade from anonymous)
- [ ] 5.2 Create SignUpScreen with registration form (upgrade from anonymous)
- [ ] 5.3 Add auth guard to navigation
- [ ] 5.4 Test full auth flow on device/simulator
