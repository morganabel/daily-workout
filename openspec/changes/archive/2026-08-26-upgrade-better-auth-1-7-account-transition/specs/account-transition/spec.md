## ADDED Requirements

### Requirement: Better Auth Transition Availability

Every deployment using Better Auth MUST enable anonymous account transition and advertise `auth.accountTransitionAvailable=true`. Account transition MUST NOT depend on a separate runtime environment flag. Auth-disabled stub deployments MUST advertise the capability as false.

#### Scenario: Better Auth deployment advertises transition

- **GIVEN** the server is configured in Better Auth mode
- **WHEN** a client requests `/api/meta`
- **THEN** `auth.accountTransitionAvailable` is true
- **AND** no account-transition environment variable is required

#### Scenario: Stub-auth deployment has no transition

- **GIVEN** the server is configured in auth-disabled stub mode
- **WHEN** a client requests `/api/meta`
- **THEN** `auth.accountTransitionAvailable` is false

### Requirement: Standard Anonymous Account Transition

When a verified anonymous Better Auth user A registers or signs in with a supported credential, the system MUST use Better Auth 1.7's anonymous account-link callback to transition ownership to credentialed user B. Better Auth MUST remain the sole writer of authentication users, provider accounts, credentials, sessions, and provider profile fields. The application MUST NOT promise that A and B have the same `userId`.

#### Scenario: Fresh email account becomes canonical

- **GIVEN** anonymous user A has a verified session
- **WHEN** the user successfully registers a new email/password account B
- **THEN** Better Auth invokes the application transition from A to B
- **AND** the refreshed session identifies non-anonymous B

#### Scenario: Fresh Google account becomes canonical

- **GIVEN** anonymous user A has a verified session and Google is configured
- **WHEN** Google OAuth completes for an application-empty credentialed user B
- **THEN** Better Auth invokes the application transition from A to B
- **AND** Better Auth owns B's Google account and verified provider profile

#### Scenario: Auth tables are not reassigned by application code

- **WHEN** application state transitions from A to B
- **THEN** the transition callback does not update Better Auth-owned user, account, session, or verification rows

### Requirement: Transactional Application Ownership Migration

The server MUST migrate all eligible Leveza-owned PostgreSQL records from A to B in one transaction. The transaction MUST serialize with user-owned writes, MUST be idempotent for the same A/B pair, and MUST reject a conflicting target. It MUST move usage events, included-generation windows/reservations, RevenueCat customer mappings, attributed billing webhooks, and the entitlement projection together, preserve dependent model-call relationships, and MUST NOT perform external network calls.

#### Scenario: Eligible state moves atomically

- **GIVEN** A owns usage, included-generation, and/or anonymous RevenueCat billing state and B owns no application or billing state
- **WHEN** the transition callback succeeds
- **THEN** all eligible A-owned rows belong to B in one committed transaction
- **AND** no eligible row remains owned by A

#### Scenario: Migration failure rolls back application state

- **GIVEN** a failure is injected while A-owned records are moving to B
- **WHEN** the migration transaction aborts
- **THEN** all eligible records and ownership state remain attached to A
- **AND** Better Auth does not report the account transition as completed

#### Scenario: Concurrent write cannot land behind migration

- **GIVEN** a user-owned write races with the A-to-B migration
- **WHEN** both operations acquire the transition ownership guard
- **THEN** the write either commits before and is included in migration or is rejected after A begins transitioning
- **AND** it cannot commit an A-owned row after migration completes

#### Scenario: Completed callback is retried

- **GIVEN** the A-to-B application transaction completed but the surrounding auth flow did not finish
- **WHEN** Better Auth invokes the callback again for the same A and B
- **THEN** the callback returns the existing successful outcome without duplicating or losing state

#### Scenario: Source is paired with a different target

- **GIVEN** the transition ledger already pairs A with B
- **WHEN** a callback attempts to transition A to user C
- **THEN** the server rejects the conflict and changes no ownership

### Requirement: Stable Server-Owned RevenueCat Identity Transitions With Application State

Anonymous A MAY own a server-generated opaque canonical RevenueCat identity C, related alias mappings, webhook attribution, and an entitlement projection. The application migration MUST move C and those rows to B atomically without calling RevenueCat. C MUST remain the mobile SDK identity across the Better Auth transition; mobile MUST NOT call `Purchases.logIn(A)` or `Purchases.logIn(B)`.

#### Scenario: Canonical billing state moves to B

- **GIVEN** A owns server-generated canonical RevenueCat identity C and related billing state
- **AND** B owns no application or billing state
- **WHEN** the transition callback runs
- **THEN** C, its alias mappings, webhook attribution, and entitlement projection move to B in the application transaction
- **AND** the callback does not invoke RevenueCat

#### Scenario: Mobile keeps C after verified transition

- **GIVEN** server migration from A to B completed and mobile verified its non-anonymous B session
- **WHEN** mobile completes the account transition
- **THEN** the RevenueCat SDK remains identified as C without a transition-time login
- **AND** subsequent webhook aliases resolve to C's owner B

#### Scenario: Billing bootstrap is interrupted

- **GIVEN** the server returned C but SDK reconciliation failed or the app terminated
- **WHEN** mobile resumes billing initialization
- **THEN** it fetches the same C and either observes the SDK already on C or retries `Purchases.logIn(C)`
- **AND** billing remains unavailable until the SDK reports exactly C

#### Scenario: Auth identity is not used as RevenueCat identity

- **GIVEN** Better Auth user A is anonymous
- **WHEN** RevenueCat is configured
- **THEN** mobile obtains server-generated C through authenticated bootstrap and reconciles RevenueCat to C before billing operations
- **AND** it does not derive the RevenueCat identity from A or a later B

#### Scenario: Target already owns RevenueCat state

- **GIVEN** B already owns a RevenueCat mapping, entitlement projection, or other billing state
- **WHEN** A attempts automatic transition to B
- **THEN** the callback rejects the transition before A is deleted or either account is mutated
- **AND** the system does not claim that RevenueCat merged or transferred purchases

### Requirement: Existing Account Sign-In Does Not Merge Anonymous State

The first release MUST automatically transition A only when B owns no Leveza application or billing state. If B already owns state, the system MUST NOT combine A with B. It MUST discard A's anonymous server and local state and sign in to B independently through the ordinary sign-in path.

#### Scenario: Existing target owns application state

- **GIVEN** A is anonymous and credentialed B already owns application or billing records
- **WHEN** the user attempts to sign in to B from A
- **THEN** the transition does not merge A's records into B
- **AND** A's anonymous state is discarded before the client signs in to B independently

#### Scenario: Existing auth-only target is empty

- **GIVEN** credentialed B exists but owns no Leveza application or billing state
- **WHEN** A signs in to B and Better Auth invokes the transition callback
- **THEN** A's eligible application state may transition to B under the same atomic rules as a fresh account

### Requirement: Verified Mobile Storage Handoff

The mobile app MUST preserve A's local SQLite and scoped BYOK state by transferring one opaque storage-scope binding from A to B only after a refreshed non-anonymous B session and a B-authorized server transition record prove the exact A-to-B transition. The handoff MUST be durable, idempotent, and recoverable after process termination.

#### Scenario: Confirmed transition keeps the same local scope

- **GIVEN** A is bound to local storage scope S
- **AND** the server reports a completed transition from A to the currently authenticated B
- **WHEN** mobile completes the ownership handoff
- **THEN** B is bound to S and A is no longer able to mount S
- **AND** the SQLite database and scoped BYOK keys are not copied

#### Scenario: App terminates before local handoff

- **GIVEN** mobile persisted a pending A-to-B transition before authentication
- **AND** the server transition completed
- **WHEN** the app restarts authenticated as B
- **THEN** it verifies the completed server record and resumes the same storage binding handoff exactly once

#### Scenario: Unrelated sign-in cannot claim anonymous local data

- **GIVEN** A is bound to local scope S
- **WHEN** B signs in without a matching completed server transition from A
- **THEN** B cannot mount S or read A's SQLite or BYOK data

#### Scenario: Cancelled authentication keeps A active

- **GIVEN** A is bound to local scope S and a transition is pending
- **WHEN** authentication is cancelled or no completed server transition exists
- **THEN** A remains bound to S
- **AND** mobile does not navigate as though B owns the data

### Requirement: Transition Recovery And Diagnostics

The system MUST retain a non-secret transition ledger and expose transition status only to the authenticated target B. Operations diagnostics MUST identify failed, blocked, retried, and completed-but-not-cleaned-up transitions without logging credentials, OAuth tokens, session tokens, email addresses, or BYOK values.

#### Scenario: Target checks transition status

- **GIVEN** B has a valid authenticated session
- **WHEN** B requests transition status
- **THEN** the server returns only transitions whose target is B
- **AND** the result contains enough source/status data to resume the local handoff without exposing secrets

#### Scenario: Application migration completed but A still exists

- **GIVEN** the transition ledger is completed and A-owned application writes are frozen
- **WHEN** Better Auth has not deleted A within the operational threshold
- **THEN** diagnostics flag the transition for supported retry or cleanup
- **AND** no automatic rollback moves B's data back to A
