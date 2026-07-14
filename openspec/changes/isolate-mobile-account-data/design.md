## Context

Mobile state is currently held behind module-level database and repository singletons. `UserRepository` selects the first user globally, workout queries have no owner predicate, and SecureStore uses device-wide BYOK keys. Separately, `WorkoutPreviewScreen` accepts a plan object but refreshes with `getTodayWorkout()`, drops the scheduled date during regeneration, and calls `discardPlannedWorkout()`, which deletes every planned workout record without deleting its exercise/set graph.

Launch also conflates capability discovery, session presence, and authorization. A cookie can route directly to Home without server validation, while a 300 ms `/api/meta` timeout can be interpreted as auth-disabled. API calls do not have one authoritative `401` transition.

The app has no production users. We can establish the correct ownership and workout-targeting invariants directly, reset unscoped storage, and avoid legacy migration and rollout scaffolding.

## Goals / Non-Goals

**Goals:**

- Keep preview, regeneration, and discard bound to the exact local workout selected by the user.
- Delete one planned workout and its owned graph without damaging unrelated workouts or user-owned planned events.
- Represent unknown capability state separately from auth-disabled state.
- Verify sessions before treating them as authenticated and expose one stable resolved principal to the rest of the app.
- Make local database and BYOK access impossible without an active data scope.
- Isolate data and credentials across both backend and account changes.
- Make sign-out and `401` handling deterministic and centralized.
- Preserve local-first offline access only for an already verified principal, never by guessing that auth is disabled.

**Non-Goals:**

- Migrating, backfilling, claiming, or quarantining the current unscoped database.
- Supporting old route shapes, unscoped repository APIs, or legacy BYOK key names.
- Adding server-side workout sync or claiming that local workouts sync across devices.
- Changing Better Auth server behavior, billing policy, generation safety, or provider selection semantics.
- Adding feature flags, dual reads/writes, shadow behavior, or slow rollout stages.

## Decisions

### 1. Preview Routes Carry Local Workout Identity

`WorkoutPreview` will take `{ workoutId: string }`, not an optional serialized `TodayPlan`. Every Home, History, calendar, and debug entry point must resolve the local record before navigating. On focus, Preview fetches that exact ID and maps it to a plan; it never substitutes today's workout.

Regeneration reads the persisted workout's `scheduledDate` and passes it together with `baselineWorkoutId`. After persistence, the flow resolves the new selected local workout ID and rebinds Preview to it. A missing record produces a clear removed/unavailable state instead of displaying another workout.

### 2. Planned Workout Deletion Is An ID-Scoped Transaction

The broad `discardPlannedWorkout()` API will be removed. Its replacement accepts one local workout ID, verifies that the target is planned, clears any `planned_events.linked_workout_id` references to it, destroys its sets and exercises, then destroys the workout. The transaction must leave all other workout versions, dates, completed sessions, planned events, exercises, and sets untouched.

The general history deletion operation may share the graph-deletion primitive, but the Preview discard command retains the planned-status precondition. This keeps the destructive boundary explicit.

### 3. Capability And Session State Are Separate

The app will keep three small state machines:

```ts
type AuthCapabilityState = 'unknown' | 'disabled' | 'enabled';
type SessionState = 'unknown' | 'authenticated' | 'unauthenticated' | 'unavailable' | 'not-required';
type PrincipalResolutionState = 'none' | 'live' | 'cached-offline' | 'reset-held';
```

The client validates `/api/meta` with shared `metaResponseSchema.safeParse`. A timeout, network error, 5xx, auth-context initialization failure, or malformed response leaves capability state `unknown`; it does not imply `disabled`. `/api/ready` is deployment health and is not substituted for capability discovery. A stored cookie or bearer token is only a credential hint. When auth is enabled, `authClient.getSession()` must return a valid session before session state becomes `authenticated`. Authoritative auth-disabled mode sets session state to `not-required`; repository mounting is gated by principal resolution rather than by calling a live stub principal unauthenticated.

Launch remains responsive while resolution is unknown, but protected data is not mounted for a never-verified identity. After a principal has been verified once for the same canonical backend, the app may expose that exact principal with `PrincipalResolutionState='cached-offline'` and reopen its local scope with networked actions disabled. This does not mark `SessionState` authenticated; the session is `unavailable` until live validation succeeds. Explicit sign-out or a server `401` returns principal resolution to `none`. Active-scope reset enters `reset-held`, invalidates cached-offline eligibility, and suppresses automatic stub recreation until the user explicitly chooses to start a fresh local scope.

### 4. One Resolved Principal Owns Mobile State

The root auth provider exposes either no principal or this non-secret ownership descriptor:

```ts
type ResolvedMobilePrincipal = {
  backendId: string;
  authMode: 'stub' | 'better-auth';
  subjectId: string;
  dataScopeId: string;
  verification: 'live' | 'cached-offline';
};
```

- One validated backend descriptor produces the normalized request base URL, `backendId`, and Better Auth `storagePrefix`. It normalizes scheme, lowercase host, effective port, and base path while ignoring query, fragment, and trailing slash differences. Default and explicit default ports are equivalent; HTTP/HTTPS and distinct base paths never collide. Non-HTTP(S), invalid, or userinfo-bearing URLs are rejected.
- Better Auth in either deployment mode uses verified `session.user.id`, corresponding to server `AuthResult.userId`, as `subjectId`; it never uses session-scoped `AuthResult.principalId`.
- Auth-disabled stub mode is limited to self-hosted deployment and uses a stable random install ID as `subjectId`; hosted mode must resolve Better Auth or fail at server boot.
- `dataScopeId` is a deterministic filesystem-safe digest of backend ID, auth mode, and subject ID.
- Cookies, bearer tokens, deployment/edition labels, and server `principalId` session identifiers are not used as ownership keys.

The raw subject, credential material, and data-scope derivation input must not be logged. Better Auth anonymous-to-email account upgrade preserves `userId`, so it preserves the same mobile data scope rather than remounting local state under a new identity.

### 5. SQLite Is Partitioned Per Principal

Each `dataScopeId` receives its own SQLite/WatermelonDB database name. A root `MobileDataProvider` creates the database and repository container only when principal resolution is `live` or `cached-offline`, disposes observers on scope changes, and makes repository access unavailable while resolution is `none` or `reset-held`. Session state controls network authorization but is not the repository gate for auth-disabled stub mode.

Repository constructors receive the scoped `Database`; they no longer import the global database singleton. Because the database itself is partitioned, every table, relation, query, subscription, generation-context read, and debug operation is isolated without relying on developers to remember a `data_scope_id` predicate.

### 6. BYOK Credentials Use The Same Scope

SecureStore key names include `dataScopeId` and provider. BYOK helpers require the active scope explicitly and never fall back to the old `byokApiKey` or `byokProvider` entries. Switching principal unloads the in-memory BYOK value immediately. Returning to the same verified scope may read its retained key; another scope cannot enumerate or read it.

Account-data reset removes only the active scope's database and secure settings. Sign-out unmounts them but does not silently delete retained local data.

### 7. Unauthorized Recovery Is A Root Transition

The API client maps any protected endpoint's `401` to one idempotent unauthorized handler. That handler invalidates the cached principal, unmounts repositories, clears credential-derived in-memory state, invokes billing logout/reset integration, and resets navigation to Launch. Individual hooks and screens must not implement competing retry-or-navigation policies for `401`.

Auth/bootstrap endpoints and `/api/meta` are excluded from recursive unauthorized handling. A request still returns its typed error after the root transition so the initiating operation can settle normally.

### 8. Legacy Auth, Database, And BYOK Cleanup Are Independent

M2 deletes legacy host/port-only Better Auth session keys when it adopts the canonical backend descriptor. The first scoped-storage release also deletes the legacy unscoped WatermelonDB database and old unscoped BYOK keys, then creates clean principal-owned storage. All three destructive steps use separate idempotent version markers: M2 owns only auth-session cleanup, M3 owns only the legacy database marker, and M4 owns only the legacy BYOK marker. Each step MUST run even when either other marker is already complete, and no legacy state is copied into a canonical scope.

No migration steps, compatibility reads, quarantine state, or claim UI are implemented. Development fixtures and tests must seed sessions, data, and credentials into an explicitly resolved scope. M3 and M4 may be reviewed separately, but a scoped-storage app release is not complete until both have merged.

Future schema changes may use ordinary migrations; this decision applies to the transition from the unsafe unscoped model.

## PR Boundaries And Dependencies

| PR  | Scope                                                                                                                                | Dependencies                     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------- |
| M1  | Exact workout preview/regeneration and ID-scoped graph deletion                                                                      | Package-and-CI PR 1 before merge |
| M2  | Auth state machines, verified resolved principal, centralized `401` and sign-out transitions                                         | Package-and-CI PR 1 before merge |
| M3  | Principal-scoped SQLite factory, repository injection, observer/debug isolation, and independently marked legacy database reset      | M2                               |
| M4  | Principal-scoped BYOK storage, independently marked legacy SecureStore cleanup, and end-to-end account/backend lifecycle integration | M3                               |

Origin's workflow already provides `nx sync:check` and affected lint/test/build. M1 and M2 can be developed in parallel now, but they merge only after package-and-CI PR 1 adds npm 12 and explicit typecheck. M3 and M4 form a reviewable stack. Generation hardening and hosted billing durability do not block this change.

## Risks / Trade-offs

| Risk                                                | Mitigation                                                                                                                                         |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Navigation callers retain the old plan-object route | Make `workoutId` required in the route type and update all compile-time and debug callers in M1.                                                   |
| Deletion leaves dangling relations                  | Perform unlink and graph destruction in one database write and assert orphan counts in repository tests.                                           |
| Capability outage locks out first-run offline use   | Keep Launch usable, but do not invent an owner; offline access begins only after one verified scope exists.                                        |
| Scope changes leave old observers active            | Own the database/repository container at the root and test unsubscribe/remount behavior.                                                           |
| Separate database files consume storage             | Provide explicit active-scope reset; storage management across many accounts is deferred until it is needed.                                       |
| Destructive reset surprises developers              | Document it in release notes and make the one-time reset deterministic and covered by a bootstrap test. There are no production users to preserve. |

## Migration Plan

1. Develop M1 and M2 independently while package-and-CI PR 1 completes the existing workflow.
2. Merge package-and-CI PR 1, then merge M1 and M2.
3. Merge M3, which switches the app to scoped database construction and records the independent legacy database reset.
4. Merge M4 before producing the scoped-storage app release; it runs its own SecureStore cleanup regardless of the database marker and completes principal-switch lifecycle tests.
5. Run the complete mobile Nx test, lint, typecheck, and build targets.

There is no data backfill, compatibility window, staged rollout, dual-write period, or rollback to the unscoped schema. A code rollback during development requires resetting local app data.
