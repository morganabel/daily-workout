## 1. Stable Release And Change Alignment

- [x] 1.1 Select the current stable Better Auth 1.7 patch and record the same exact version for the runtime, Expo plugin, and renamed `auth` CLI package.
- [x] 1.2 Review the Better Auth 1.5, 1.6, and 1.7 upgrade guides/changelogs from the current 1.4.10 pin and document every applicable server, Expo, OAuth, proxy, schema, and error-shape change.
- [x] 1.3 Verify the exact pinned 1.7 anonymous-plugin and Expo source contract for callback failure, A deletion order, trusted OAuth server context, and retry through email/Google sign-in; resolve the design open questions before coding transition behavior.
- [x] 1.4 Revise the unimplemented `isolate-mobile-account-data` OpenSpec artifacts to replace deterministic `userId`-derived scopes and same-`userId` upgrade assumptions with the opaque storage binding and verified A-to-B handoff defined here.
- [x] 1.5 Define a merge/landing order so no mobile-data-isolation implementation can merge with the superseded stable-`userId` assumption.

## 2. Better Auth Upgrade And Schema

- [x] 2.1 Upgrade `better-auth`, `@better-auth/expo`, and the renamed `auth` CLI to the same exact stable 1.7 version, remove `@better-auth/cli`, update the schema-generation command, and refresh the npm lockfile without unrelated dependency churn.
- [x] 2.2 Inventory every existing `account.providerId`, define its trusted 1.7 issuer, backfill credential identities as `local:credential` plus linked user ID, and resolve any `(issuer, accountId)` collisions before making issuer required.
- [x] 2.3 Run the Better Auth 1.7 schema generator under the repository's pinned Node runtime and review its output against the existing Drizzle auth schema.
- [x] 2.4 Add/revise the repository-owned Drizzle migration for the issuer backfill, required compound identity index, and other reviewed Better Auth schema changes; verify it on an empty PostgreSQL database.
- [x] 2.5 Build a representative Better Auth 1.4.10 fixture database and verify the migration upgrades it to 1.7 without losing users, accounts, sessions, anonymous markers, or Google linkage.
- [x] 2.6 Update Expo cookie/session storage calls for the 1.7 asynchronous SecureStore contract and cover awaited persistence/read behavior.
- [x] 2.7 Run Nx lint, typecheck, unit tests, and server build for the dependency/schema-only slice before adding transition behavior.

## 3. Application Transition Ledger And Write Barrier

- [x] 3.1 Add the application-owned account-transition/ownership schema and migration with durable source/target IDs, method, state, timestamps, idempotency constraints, and redacted failure classification.
- [x] 3.2 Implement ordered transaction locking and an ownership guard that serializes all user-owned writes with account migration and returns a stable error for transitioning/completed A.
- [x] 3.3 Route AI usage/metering and included-generation window/reservation mutations through the ownership guard in their existing PostgreSQL transactions.
- [x] 3.4 Add a schema inventory assertion that enumerates every application-owned foreign key to the Better Auth user table and fails until each table is explicitly migrated, blocked, or documented as dependent-only.
- [x] 3.5 Implement the idempotent A-to-B migration transaction for `ai_usage_event`, included-generation windows/reservations, RevenueCat customer mappings, attributed billing webhooks, and entitlement projection while preserving dependent relationships.
- [x] 3.6 Fail migration before mutation when B owns any application/billing state, a RevenueCat identity is mapped to conflicting owners, or A is already paired with another target; allow valid generated-anonymous billing state owned by A.
- [x] 3.7 Add target-authorized transition-status access and redacted operational diagnostics for failed, blocked, retried, and completed-but-not-cleaned-up transitions.

## 4. Better Auth 1.7 Account Transition

- [x] 4.1 Configure the Better Auth anonymous plugin `onLinkAccount` callback to invoke only the application migration service and remove custom auth-user/account/session reassignment code.
- [x] 4.2 Use standard Better Auth email sign-up/sign-in and Google `signIn.social` paths; remove custom Google identity-token profile parsing and profile-promotion writes.
- [x] 4.3 Keep partial Google configuration non-fatal and expose `auth.googleAvailable=false` unless both credentials are present.
- [x] 4.4 Add pinned-version server integration tests proving A/B callback identity, default A deletion after callback success, A retention after callback failure, same-pair retry, and conflicting-target rejection.
- [x] 4.5 Add real PostgreSQL failure-injection tests before/during/after each migration phase and after migration success but before Better Auth cleanup.
- [x] 4.6 Prove email and Google retry paths after B was created but the first callback failed; keep the corresponding method capability disabled if the pinned 1.7 flow cannot recover without auth-table surgery.
- [x] 4.7 Remove the separate account-transition runtime flag so every Better Auth deployment enables and advertises the capability, while stub-auth deployments remain unavailable.

## 5. Existing-Account And Mobile Auth UX

- [ ] 5.1 Detect the stable existing-target rejection and present the explicit keep-anonymous-data versus discard-and-sign-in choice without changing either account by default.
- [ ] 5.2 Implement the destructive discard path with a separate confirmation, supported Better Auth anonymous deletion/sign-out APIs, source-scope deletion, and fresh sign-in to B without linking.
- [x] 5.3 Persist a pending mobile transition before opening email/Google auth, including canonical backend ID, source A, and opaque storage scope S, without storing credentials or tokens in the record.
- [x] 5.4 After auth returns, refresh the session and verify non-anonymous B, expected provider linkage when applicable, and a completed B-authorized A-to-B transition before returning success.
- [x] 5.5 Treat browser cancellation, callback error, missing trusted context/cookie, stale A session, missing provider linkage, or absent transition record as incomplete auth and keep A's scope active.

## 6. Mobile Storage Ownership Handoff

- [x] 6.1 Implement the per-backend principal-to-opaque-storage-scope registry and make scoped SQLite and BYOK storage consume `storageScopeId` rather than a deterministic `userId` digest.
- [x] 6.2 Implement one atomic/idempotent binding replacement from A-to-S to B-to-S after verified transition, ensuring A is unbound before B mounts the scope.
- [x] 6.3 Resume a pending handoff after process death by authenticating B and checking the server transition record; never infer ownership from sequential sessions.
- [ ] 6.4 Add mobile lifecycle tests for successful handoff, repeated handoff, cancellation, process death at each phase, unrelated B sign-in, backend switch, sign-out, and `401` teardown.
- [ ] 6.5 Verify local SQLite content and scoped BYOK values remain available to B after transition and inaccessible to A or any unrelated account without copying either resource.

## 7. Stable Server-Owned RevenueCat Identity

- [x] 7.1 Configure RevenueCat without deriving an App User ID from Better Auth A or B and remove any `Purchases.logIn(A)` behavior.
- [x] 7.2 Add authenticated bootstrap that accepts no client identity, creates or returns one server-generated canonical identity C, and maps C to the authenticated account under the ownership write guard.
- [x] 7.3 Make mobile reconcile the SDK to C and verify the exact current identity before purchase, restore, or Customer Center is available.
- [x] 7.4 Move C, alias mappings, attributed webhook rows, and entitlement projection from A to application-empty B inside the account-transition transaction without a RevenueCat network call.
- [x] 7.5 Remove transition-time `Purchases.logIn(B)` and make interrupted initialization retry the stable C without mutable entitlement snapshots.
- [x] 7.6 Keep entitlements and usage reads free of mapping side effects; confirm signed alias webhooks extend only an already mapped C owner and conflicting ownership fails closed.
- [x] 7.7 Add server/mobile matrix tests for idempotent/concurrent bootstrap, arbitrary client identity rejection, anonymous purchase under C, A-to-B ownership movement, interrupted SDK reconciliation, exact-identity verification, alias webhooks, and CE/`BILLING_PROVIDER=none` neutrality.

## 8. End-To-End Verification And Rollout

- [ ] 8.1 Run email transition end to end on PostgreSQL with an Expo development build, including callback failure, retry, concurrent generation, and app-restart recovery.
- [ ] 8.2 Run Google transition end to end on iOS and Android development builds, including browser cancellation and callback-without-cookie/trusted-context regression cases.
- [ ] 8.3 Run the affected Nx lint, typecheck, unit/integration test, server build, mobile build, and available E2E targets plus strict OpenSpec validation.
- [ ] 8.4 Deploy the additive schema before transition-capable server code, deploy the compatible mobile build, and verify Better Auth servers advertise transition while stub-auth servers do not.
- [ ] 8.5 Add redacted dashboards/alerts for transition success, retry, blocked billing state, existing-target rejection, and completed transitions whose anonymous auth user survives beyond the cleanup threshold.
- [ ] 8.6 Document rollback as deploying code that rejects new transitions without reversing completed A-to-B ownership; verify B retains migrated server/local state after rollback.
