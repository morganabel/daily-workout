## Context

Workout Agent began this change pinned to `better-auth`, `@better-auth/expo`, and `@better-auth/cli` at 1.4.10. The abandoned implementation worked around mobile OAuth linking by keeping anonymous user A as the permanent Better Auth user and manually moving credentials, sessions, and provider profile fields onto A. That approach crossed Better Auth's ownership boundary and required custom identity surgery.

Stable Better Auth 1.7 introduces trusted OAuth server context for anonymous linking in Expo and other in-app browsers. Its standard anonymous plugin flow creates or resolves credentialed user B, calls `onLinkAccount({ anonymousUser: A, newUser: B })`, and deletes A by default after linking. The relevant upstream references are the [1.7 upgrade guide](https://better-auth.com/docs/guides/1-7-upgrade-guide) and [anonymous link-account contract](https://better-auth.com/docs/plugins/anonymous#link-account).

The identity change affects more than auth. PostgreSQL usage, quota, and billing rows use the Better Auth user ID as owner, the planned mobile data-isolation change derives its local scope from that ID, and the mobile billing client must not treat a client-reported RevenueCat identifier as authorization. The design must let Better Auth own auth identity, keep RevenueCat on a server-owned stable billing identity, and preserve Workout Agent-owned state without a cross-system transaction.

## Goals / Non-Goals

**Goals:**

- Upgrade the complete Better Auth package family from 1.4.10 to stable 1.7 with reviewed schema output and regression coverage.
- Use the supported anonymous plugin transition for email registration and Google OAuth instead of reassigning Better Auth accounts, sessions, or user profile fields.
- Move application-owned PostgreSQL state from anonymous A to credentialed B atomically, idempotently, and without accepting writes that can race behind the migration.
- Preserve the active install's local SQLite and BYOK scope only after the server proves the same A-to-B transition completed.
- Allow anonymous hosted purchases under a server-generated stable RevenueCat identity and keep RevenueCat network calls out of the auth callback.
- Provide deterministic recovery when the application migration succeeds but the surrounding Better Auth flow or mobile callback does not finish.

**Non-Goals:**

- Adopting a Better Auth prerelease or mixing Better Auth package versions.
- Preserving the anonymous Better Auth `userId` after registration.
- Manually updating Better Auth-owned `user`, `account`, `session`, or `verification` rows.
- Automatically merging anonymous application data into an existing account that already owns application or billing state in the first release.
- Transferring purchases between RevenueCat custom App User IDs or calling RevenueCat from `onLinkAccount`.
- Syncing a local-only mobile database across devices.
- Implementing account unlinking or splitting one credentialed account back into multiple identities.

## Decisions

### Intervening release review (1.4.10 to 1.7.1)

The implementation pins 1.7.1 after reviewing each intervening stable release:

- 1.5 replaces `@better-auth/cli` with the standalone `auth` CLI. Its removed
  deprecated adapter/client APIs, extracted API-key plugin, renamed passwordless
  endpoint, and stricter default rate limits do not otherwise affect this repo's
  bearer, anonymous, email/password, Google, Expo, or Drizzle configuration.
- 1.6 changes session freshness to use `createdAt`, aligns stateless cookie-cache
  lifetime, and switches password hashing to non-blocking native scrypt while
  preserving existing hashes. This repo disables cookie caching and does not use
  SAML, SCIM, passkeys, or the deprecated OIDC-provider plugin, so no schema or
  configuration migration is needed for those features.
- 1.7 requires issuer-scoped account identity, asynchronous Expo SecureStore
  cookie access, and removal of the now-default `experimental.joins` option. Its
  OAuth callback error rename is not parsed by this client. The app uses a fixed
  `baseURL`, so the new dynamic-base-URL proxy opt-in does not apply; the deployed
  proxy must continue forwarding the configured public origin unchanged. Better
  Auth 1.7.1 also requires Drizzle ORM `^0.45.2`, so the repository's exact
  `0.45.1` pin advances by one patch to `0.45.2`.
- 1.7's OAuth provider, MCP, SAML, SCIM, Stripe, captcha, device authorization,
  two-factor, magic-link, email-OTP, custom-adapter, and secondary-storage changes
  are out of scope because none of those Better Auth features are configured.

The schema generator confirms that this configuration's only Better Auth table
delta is `account.issuer` plus unique `(issuer, accountId)`. Mobile now awaits
`authClient.getCookie()`, while passing `expo-secure-store` directly continues to
satisfy both synchronous and asynchronous storage methods.

### 1. Upgrade to one stable 1.7 patch and keep Better Auth packages in lockstep

Better Auth 1.7 is stable. Implementation selects one current stable 1.7 patch and pins `better-auth`, `@better-auth/expo`, and the replacement `auth` CLI package to that same exact version; the discontinued `@better-auth/cli` package is removed. Because this repository skips from 1.4.10, implementation reviews every intervening upgrade guide and relevant changelog, not only the 1.7 delta.

The Better Auth CLI is run under the repository's pinned Node 24 runtime. Before making the 1.7 account `issuer` column required, the migration inventories every `providerId`, assigns a trusted issuer, uses `local:credential` plus the linked user ID for credential accounts, checks `(issuer, accountId)` collisions, and only then adds the required compound unique index. Generated auth schema is diffed against `packages/server-db`, translated into the repository's Drizzle migration workflow, and exercised on both an empty database and a representative pre-upgrade 1.4.10 database. The schema migration is deployed before code that requires it.

The Expo client is updated for 1.7's asynchronous SecureStore contract: cookie reads are awaited and custom storage implements the required synchronous and asynchronous methods.

Alternative considered: float Better Auth packages independently within `^1.7`. Rejected because schema generation, server behavior, and Expo callback handling must come from one tested release.

### 2. Better Auth owns A-to-B authentication lifecycle

Email uses the standard `signUp.email`/`signIn.email` paths and Google uses `signIn.social`. When the current verified session belongs to anonymous A, the anonymous plugin's `onLinkAccount` callback receives A and B. Better Auth owns B's verified email, name, image, provider account, sessions, and deletion of A. Workout Agent does not parse Google identity tokens to patch user fields and does not call a custom credential-transfer endpoint.

The implementation includes an upstream-contract integration suite against the exact pinned 1.7 version. Shipping account transition is blocked unless tests prove that:

- the Expo OAuth callback preserves the trusted anonymous context;
- `onLinkAccount` receives the expected A and B;
- a callback error does not delete A or report success;
- retrying email or Google authentication can re-enter the callback safely; and
- a successful callback leaves the refreshed mobile session on non-anonymous B.

Alternative considered: keep A and manually attach credentials. Rejected because it duplicates Better Auth internals and makes every auth schema change part of our maintenance surface.

### 3. One application transaction moves only Workout Agent-owned rows

Add an application-owned `account_transition` ledger keyed by source user ID, with target user ID, method, state, timestamps, and a redacted failure classification. Its source and target identifiers are retained as values rather than cascading foreign keys so the record survives Better Auth's deletion of A.

Every transaction that creates or mutates user-owned server state must lock/check the source ownership record before writing. The migration callback obtains the same ordered lock, changes A from active to transitioning, moves the eligible rows, and marks the transition completed in one PostgreSQL transaction. A write that begins first finishes before migration captures it; a write that begins afterward sees transitioning/completed state and fails with a stable retry-or-reauth error. This closes the late-write window between migration and Better Auth's deletion of A.

The first-release migration set is explicit:

- Move `ai_usage_event.user_id` from A to B; `ai_model_call` follows its existing usage-event relationship and is not reparented independently.
- Move `included_generation_window.account_id` and its `included_generation_reservation.account_id` rows together. Because B must be application-empty, the current unique window and active-operation constraints cannot collide.
- Move A-owned `billing_webhook_event.account_id`, `billing_customer_mapping.account_id`, and `billing_entitlement_projection.account_id` to B. B must own no application or billing state, so entitlement and mapping keys cannot collide. RevenueCat is not called from this transaction.
- Add every future user-owned table to the migration registry and its integration fixture before it can ship.
- Never update Better Auth's `account.user_id`, `session.user_id`, or auth-user profile fields from this callback.

The callback contains no network calls. Transaction rollback returns all application rows and ownership state to A. A completed ledger entry makes retries no-ops for the same A/B pair and rejects any attempt to map A to a different target.

Alternative considered: update foreign keys opportunistically without a ledger/write barrier. Rejected because concurrent generation or metering writes could land on A after migration and then be deleted by Better Auth.

### 4. Existing-account sign-in is explicit, not an automatic data merge

The lean first release automatically transitions only when B owns no Workout Agent application or billing state. That includes a newly created email/Google account and an existing auth identity that has never used application features.

If B already owns application or billing state, `onLinkAccount` fails before moving A or allowing A to be deleted. Mobile explains that the existing account cannot be combined automatically and offers two explicit choices: keep using A, or discard A's anonymous local/server activity and sign in to B without linking. The discard path must separately confirm destructive loss, finish/delete A through supported Better Auth APIs, clear A's mobile scope, and then authenticate B.

This avoids inventing collision semantics for quota windows, active reservations, usage idempotency keys, entitlement projections, and local databases. A later change may add a deterministic merge policy; it is not hidden inside this upgrade.

Alternative considered: always merge A into an existing B. Rejected for the first release because combining quota and billing records safely is a product policy, not a generic foreign-key update.

### 5. Mobile hands off a storage scope instead of copying a database

The unimplemented `isolate-mobile-account-data` change currently assumes `dataScopeId` is a deterministic digest of `userId`. Before that change proceeds, replace the assumption with a small durable principal-to-storage registry for each canonical backend:

```ts
type PrincipalStorageBinding = {
  backendId: string;
  subjectId: string;
  storageScopeId: string;
};
```

`storageScopeId` is an opaque, install-local identifier used by both SQLite and scoped BYOK keys. Initial anonymous A receives a binding to scope S. Before starting registration, mobile durably records a pending transition containing backend, A, and S, then suspends source-scoped mutations. After auth returns, mobile refreshes the session and requires non-anonymous B. An authenticated transition-status endpoint returns only a completed ledger transition whose target is the current B. If it confirms A to B, mobile atomically replaces binding A-to-S with B-to-S. No database or secret is copied, and A can no longer mount S.

The pending record makes this handoff resumable after process death. On B's next launch, mobile can query the status endpoint and complete the binding change. A sequential sign-in to B without a matching completed server transition never inherits A's scope. If the server transition did not complete, A remains bound to S and B receives its own scope if the user later signs in independently.

This decision supersedes the stable-`userId`/deterministic-scope assumption in `isolate-mobile-account-data`; that change must be revised or rebased before implementation.

Alternative considered: rename/copy the SQLite file and every SecureStore key from an A-derived name to a B-derived name. Rejected because multi-resource copying creates partial-failure states; reassigning one binding keeps the existing scope intact.

### 6. A server-owned RevenueCat identity C remains stable across A-to-B

Authenticated billing bootstrap accepts no client-selected customer ID. Under the account ownership write guard, the server creates or returns one UUIDv7-based opaque canonical RevenueCat App User ID C for the current Workout Agent account and stores it separately from webhook-observed aliases. The bootstrap response exposes C only so the authenticated mobile installation can configure the RevenueCat SDK; entitlements and usage reads never create mappings.

Mobile configures RevenueCat, obtains C from bootstrap, and compares C with `Purchases.getAppUserID()`. If they differ it calls `Purchases.logIn(C)`, then reads the SDK identity again. Purchase, restore, and Customer Center remain unavailable until the exact identity matches. The operation is retryable because C is durable: after an ambiguous failure, a retry either observes C already active or logs in to the same C. It does not infer success from a mutable entitlement snapshot.

Mobile MUST NOT call `Purchases.logIn(A)` or `Purchases.logIn(B)`. During Better Auth's A-to-B application transaction, the server moves canonical C, its alias mappings, attributed webhook rows, and entitlement projection from A to B. C does not change and the callback performs no RevenueCat request. A process death after server transition therefore requires only the existing auth/storage handoff; it cannot trigger a custom-to-custom RevenueCat transfer.

Existing webhook normalization collects `app_user_id`, `original_app_user_id`, and `aliases`. A signed event containing already mapped C may bind its non-conflicting aliases to C's owner idempotently, while an event with no mapped canonical identity remains unmapped. Automatic transition is rejected before A is deleted when B already owns a canonical identity, alias mapping, entitlement projection, or other billing state.

CE remains billing-neutral and self-hosted `BILLING_PROVIDER=none` does not initialize RevenueCat.

Alternative considered: authorize first claim of the SDK-generated anonymous ID R because it is random. Rejected because RevenueCat App User IDs are identifiers visible to clients, not credentials; format checks and first-writer locking cannot prove the rightful owner. Alternative considered: identify RevenueCat as A and later as B. Rejected because it introduces a custom-to-custom transfer and a retry state that can certify the wrong customer.

### 7. Completion is verified at both server and mobile boundaries

The initial authorization response is not proof of OAuth completion. Mobile returns success only after `getSession()` resolves B, `isAnonymous` is false, the expected provider account is visible when applicable, and the transition-status endpoint confirms A to B. Browser cancellation, callback error, missing cookie/context, stale A session, or absent transition record leaves the app on the auth flow with A's scope intact.

Server integration tests use PostgreSQL and inject failures before and after each migration phase. Mobile tests cover cancellation, missing callback cookie, process death before local handoff, idempotent resume, unrelated sign-in, existing-account rejection, and exactly-once navigation.

## Risks / Trade-offs

- [Better Auth 1.7 patch behavior changes] -> Pin one stable version and make source-level contract tests a release gate.
- [Auth identity creation/deletion and application migration are not one transaction] -> Use a persistent transition ledger, write barrier, idempotent callback, and reconciliation diagnostics; never claim cross-system atomicity.
- [Application migration commits but Better Auth fails to delete A] -> Completed state freezes A-owned writes, retry is a no-op, and operations diagnostics identify the stranded auth user for supported cleanup.
- [An existing account cannot automatically absorb anonymous progress] -> Fail before data loss and offer an explicit keep-A or discard-A-and-sign-in choice; define merging in a separate product change.
- [Mobile crashes between server transition and local binding handoff] -> Persist pending A/S state before auth and resume only after B-authenticated transition proof.
- [A new user-owned table is forgotten] -> Centralize the migration manifest and require schema inventory assertions in PostgreSQL integration tests.
- [RevenueCat B already owns billing state] -> Treat any existing B canonical identity, alias mapping, or projection as an automatic-transition conflict.
- [Client claims another RevenueCat identifier] -> Bootstrap ignores client identifiers and creates or returns only the authenticated account's server-owned C.

## Migration Plan

1. Select one stable Better Auth 1.7 patch. Upgrade all Better Auth packages together, review 1.5/1.6/1.7 changes, backfill issuer-scoped account identities, regenerate schema, and validate migrations on empty and upgraded PostgreSQL databases.
2. Add the transition ledger/write guard and PostgreSQL migration callback tests before deploying transition-capable server code. Inventory every user-owned foreign key and fail CI when the manifest is incomplete.
3. Revise the pending `isolate-mobile-account-data` artifacts to use opaque storage-scope bindings and implement principal-scoped storage before shipping transition-capable mobile auth.
4. Add server-owned canonical billing identity C, remove client-authorized first claim and read-route mutations, and verify mobile exact-identity reconciliation before exposing purchase/restore or A-to-B transition.
5. Exercise email transition in a non-production environment, run failure/retry and concurrent-write tests, then exercise Google transition with real Expo development builds on iOS and Android.
6. Apply the additive schema first, then deploy the compatible server and mobile implementations. Every Better Auth server advertises `/api/meta` account-transition capability as true; stub-auth deployments advertise it as false.
7. Monitor transition totals, redacted failures, stuck completed transitions with surviving A users, and existing-target rejections before broad enablement.

Rollback deploys server code that rejects new transition entry points while leaving the additive ledger and storage bindings in place. There is no environment toggle. Completed A-to-B transitions are not reversed automatically; B remains canonical and retains migrated application/local state.

## Open Questions

- Confirm the exact stable 1.7 API for exposing provider linkage in the refreshed mobile session; use account-list verification if `getSession()` alone does not expose it.
- Confirm through pinned-version tests whether a callback failure after B creation can be retried by email sign-in and Google sign-in without custom auth-table changes. Do not enable a method until its retry path is proven.
- Choose the retention period and operator workflow for completed transition-ledger records after production volume exists.
