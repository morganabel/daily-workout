## 0. Cross-Change Prerequisite

**Dependency:** package-and-CI PR 1 before implementation PRs merge.

- [ ] 0.1 Record origin's existing `nx sync:check` and affected lint/test/build workflow as the partial baseline; M1/M2 development may begin without waiting for another workflow.
- [ ] 0.2 Merge package-and-CI PR 1 so npm 12 and explicit mobile typecheck are required before any mobile implementation PR merges.
- [ ] 0.3 Confirm no task in this change adds legacy migration, quarantine, compatibility, feature-flag, shadow, or staged-rollout behavior.

**Acceptance criteria:**

- The repository has the completed required CI gates before mobile correctness PRs merge.
- Native ESM package repair, generation hardening, and hosted billing changes are not treated as prerequisites.

## 1. PR M1 - Exact Workout Targeting And Deletion

**Dependencies:** Section 0 only. May proceed in parallel with M2.

- [ ] 1.1 Change `WorkoutPreview` route parameters to require a local `workoutId`; update Home, History/calendar, debug tools, and tests to navigate with that ID rather than a serialized plan.
- [ ] 1.2 Load and observe the exact workout record on preview focus; show a removed/unavailable state if it no longer exists and never fall back to today's workout.
- [ ] 1.3 Regenerate with the persisted target's `scheduledDate` and `baselineWorkoutId`, then rebind Preview to the newly persisted selected workout ID.
- [ ] 1.4 Replace `discardPlannedWorkout()` with an ID-scoped planned-workout deletion that clears linked planned-event references and deletes the target's sets, exercises, and workout in one write.
- [ ] 1.5 Add regression tests for future-date preview, focus refresh, missing target, date-preserving regeneration, unrelated planned workouts, linked events, and child-row cleanup.

**Acceptance criteria:**

- Opening or refocusing a future workout never displays today's workout.
- Regeneration remains on the original local date and preview follows the new persisted record.
- Discarding workout A removes only A and its owned graph; workout B and its graph remain intact.
- A planned event survives discard with its nullable workout link cleared.
- Preview cannot use the broad delete-all-planned operation because that API no longer exists.

**Verification commands:**

- `nx test mobile --testPathPatterns=WorkoutPreviewScreen`
- `nx test mobile --testPathPatterns=WorkoutRepository`
- `nx test mobile --testPathPatterns=HistoryScreen`
- `nx run mobile:typecheck`
- `nx lint mobile`

## 2. PR M2 - Authoritative Auth Resolution

**Dependencies:** Section 0 only. May proceed in parallel with M1.

- [ ] 2.1 Introduce separate `AuthCapabilityState` and `SessionState` models and a root auth-resolution provider; parse `/api/meta` with `metaResponseSchema.safeParse` and keep timeout, 5xx, initialization failure, and malformed payload states `unknown`.
- [ ] 2.2 Validate stored Better Auth credentials with `getSession()` before routing to protected app state.
- [ ] 2.3 Introduce one validated backend descriptor that supplies the normalized request base URL, `backendId`, and Better Auth `storagePrefix`; normalize scheme, host, effective/default port, and base path, ignore query/fragment/trailing slash, and reject non-HTTP(S), invalid, or userinfo-bearing URLs.
- [ ] 2.4 Resolve `ResolvedMobilePrincipal` from canonical backend plus verified Better Auth `session.user.id`/server `AuthResult.userId` or auth-disabled stub install ID, with an opaque install-local `dataScopeId` binding and no deployment, credential, or `principalId` ownership keys.
- [ ] 2.5 Persist only the last verified scope metadata needed for same-backend offline reopening; invalidate it on explicit sign-out or `401`.
- [ ] 2.6 Add one idempotent unauthorized handler to the API client and root navigation lifecycle; remove screen/hook-specific `401` retries or redirects that conflict with it.
- [ ] 2.7 Route sign-out through the same principal teardown boundary, including RevenueCat reset, without logging identifiers or credentials.
- [ ] 2.8 Add tests for slow/unreachable/5xx/malformed meta, auth-disabled stub, self-hosted Better Auth, hosted Better Auth, valid and expired sessions, anonymous-to-email upgrade, canonical backend collisions, cached-offline scope, backend changes, repeated concurrent `401`s, and sign-out.
- [ ] 2.9 Represent cached-offline principal resolution explicitly without marking an unvalidated session authenticated; disable network actions until live capability and session validation succeed.
- [ ] 2.10 Represent authoritative auth-disabled mode with session `not-required` and live principal resolution; gate local repositories on principal resolution rather than Better Auth session state.
- [ ] 2.11 Destructively delete legacy host/port-only Better Auth storage keys with an idempotent auth-storage marker; do not copy them into a canonical scope.

**Acceptance criteria:**

- Capability discovery failure remains `unknown`; it never enables stub auth implicitly.
- A cookie alone cannot route the app to Home or expose a principal.
- Better Auth in either deployment mode resolves ownership from stable `userId`, never session `principalId`; only self-hosted auth-disabled stub mode resolves it from a stable install ID.
- Anonymous A-to-authenticated B transition preserves the opaque data scope only after B-authenticated server proof atomically reassigns the binding; sequential sign-in without proof cannot inherit it.
- Equivalent backend URLs resolve the same backend ID, while HTTP/HTTPS, effective-port, and base-path differences resolve distinct IDs.
- The same backend descriptor drives requests, ownership, and auth credential storage; default-port equivalents match, invalid/userinfo URLs fail, and no legacy session key is reused.
- Cached-offline local access is explicit and never enables network actions or reports an unvalidated session as authenticated.
- Auth-session cleanup has its own idempotent marker and cannot suppress or be suppressed by the database and BYOK cleanup markers in M3/M4.
- One or many concurrent protected `401`s cause one root transition to Launch and clear the active principal.
- The same previously verified backend scope may open offline, but a never-verified scope cannot.

**Verification commands:**

- `nx test mobile --testPathPatterns=LaunchScreen`
- `nx test mobile --testPathPatterns=auth-client`
- `nx test mobile --testPathPatterns=api.test`
- `nx test mobile --testPathPatterns=AuthResolution`
- `nx run mobile:typecheck`
- `nx lint mobile`

## 3. PR M3 - Principal-Scoped SQLite Persistence

**Dependencies:** M2 merged.

- [ ] 3.1 Replace the module-level WatermelonDB singleton with a database factory keyed by `dataScopeId` and a root `MobileDataProvider` that mounts only for a resolved principal.
- [x] 3.2 Change all repositories and repository-using services/hooks/debug tools to receive the scoped database or scoped repository container instead of importing global instances.
- [ ] 3.3 Ensure user preferences, workouts, exercises, sets, planned events, coach session actions, generation context, and subscriptions read and write only the mounted partition.
- [ ] 3.4 Dispose observations and in-flight local state when the principal changes, then remount consumers against the next scope without stale emissions.
- [ ] 3.5 Implement the one-time destructive cleanup of the legacy unscoped database with a database-specific idempotent version marker; do not use that marker for SecureStore cleanup.
- [ ] 3.6 Restrict debug inspection, seeding, and reset operations to the active scope and include the non-secret scope status in diagnostics without exposing subject identifiers.
- [ ] 3.7 Rewrite repository/schema fixtures to seed an explicit test scope; add isolation tests for two accounts on one backend and one account name across two backends.

**Acceptance criteria:**

- Repository access is unavailable while no principal is resolved.
- Account A cannot query, observe, mutate, or debug Account B's records.
- Backend A and Backend B never share a database partition even when the user ID matches.
- Switching scope removes old observer emissions before the new repository container is exposed.
- An existing schema-v11 unscoped database is deleted and not migrated, queried, or quarantined.
- Completing the database reset marker cannot suppress the separate legacy BYOK cleanup owned by M4.

**Verification commands:**

- `nx test mobile --testPathPatterns=schema.test`
- `nx test mobile --testPathPatterns=Repository`
- `nx test mobile --testPathPatterns=useHomeData`
- `nx test mobile --testPathPatterns=debugTools`
- `nx run mobile:typecheck`
- `nx lint mobile`

## 4. PR M4 - Scoped BYOK And Lifecycle Integration

**Dependencies:** M3 merged.

- [x] 4.1 Replace device-wide BYOK key names with `dataScopeId`-qualified provider/key entries and require an active scope for every read, write, and delete.
- [x] 4.2 Remove legacy BYOK fallback APIs and delete the old unscoped `byokApiKey` and `byokProvider` entries through a SecureStore-specific idempotent cleanup marker that runs even when M3's database reset is already complete.
- [ ] 4.3 Clear in-memory BYOK and generated-request credential state on scope transition before rendering the next account; retain encrypted values only for return to the same scope.
- [ ] 4.4 Make active-scope reset unmount the scope, invalidate its cached verified-principal/offline eligibility, enter a per-backend `reset-held` state, remove only that scope's SQLite partition and SecureStore values, then return to Launch/onboarding. Auth-disabled stub mode may create a fresh scope only after explicit user re-entry clears the hold.
- [ ] 4.5 Add end-to-end lifecycle tests covering Account A data/key, sign-out, Account B isolation, return to Account A, backend switch, offline reopening, and centralized `401` teardown.
- [ ] 4.6 Remove or correct any UI text that implies local workouts or BYOK credentials automatically sync across devices.

**Acceptance criteria:**

- API requests cannot read or attach a BYOK key unless it belongs to the active data scope.
- Account and backend switching expose neither the previous scope's data nor its key.
- Returning to the same verified scope restores only that scope's retained local state.
- Active-scope reset does not delete another account's partition or credentials.
- Active-scope reset cannot reopen the deleted scope from cached-offline metadata without a new live verification.
- An auth-disabled backend cannot automatically recreate a reset stub scope; an explicit start-fresh/local-entry action is required and creates clean state.
- No legacy unscoped BYOK fallback remains.
- Database cleanup and SecureStore cleanup can each run first, retry, or observe the other as complete without skipping their own destructive step.

**Verification commands:**

- `nx test mobile --testPathPatterns=byokKey`
- `nx test mobile --testPathPatterns=api.test`
- `nx test mobile --testPathPatterns=App.spec`
- `nx test mobile`
- `nx run mobile:typecheck`
- `nx lint mobile`
- `nx build mobile`

## 5. Change Verification

**Dependencies:** M1 and M4 merged.

- [ ] 5.1 Trace every `WorkoutPreview` navigation entry point and confirm it supplies a local workout ID.
- [ ] 5.2 Trace every database/repository and BYOK access path and confirm it originates from the active `MobileDataProvider` scope.
- [ ] 5.3 Confirm there is one centralized protected-request `401` transition and no competing screen-level navigation policy.
- [ ] 5.4 Confirm the implementation contains no legacy data migration, quarantine, compatibility reader, feature flag, dual read/write, or slow-rollout path.
- [ ] 5.5 Run `nx test mobile`, `nx run mobile:typecheck`, `nx lint mobile`, and `nx build mobile` successfully.
- [ ] 5.6 Run `npm run validate:openspec -- isolate-mobile-account-data` successfully using the repo-owned CLI from `harden-package-and-ci-integrity`.
