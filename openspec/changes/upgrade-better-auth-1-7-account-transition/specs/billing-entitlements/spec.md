## MODIFIED Requirements

### Requirement: Purchase Verification and Restore Synchronization

Hosted billing MUST accept only authenticated, validated RevenueCat webhooks and MUST persist each normalized event before mutating entitlement state. Processing MUST be idempotent by RevenueCat event ID and order-aware by vendor event timestamp. Entitlements are account-bound and MUST NOT be granted from an unknown app, environment, product, entitlement, or unmapped RevenueCat identity.

RevenueCat customer ownership MUST be established through authenticated hosted billing bootstrap before purchase, restore, or Customer Center access. Bootstrap MUST accept no client-selected customer identity or owner; the server MUST create or return one opaque canonical identity C for the authenticated account. Mobile MUST reconcile the RevenueCat SDK to C and verify the exact SDK identity before exposing billing. When anonymous A transitions to credentialed B, application billing ownership MUST move to B transactionally while C remains unchanged. Entitlement and usage reads MUST NOT create customer mappings. Webhook payloads MUST NOT create arbitrary account ownership, but a webhook containing mapped C plus `app_user_id`, `original_app_user_id`, or `aliases` MUST bind all non-conflicting identities to C's owner idempotently.

#### Scenario: Verified purchase grants entitlement once

- **GIVEN** a valid purchase event for an allowed app, environment, product, entitlement, and mapped hosted account
- **WHEN** the event is delivered one or more times
- **THEN** the event is persisted once, paid access is granted once, and later duplicate deliveries report `duplicate` without mutation

#### Scenario: Conflicting duplicate is rejected

- **GIVEN** a stored RevenueCat event ID
- **WHEN** another delivery uses that ID with different normalized state-affecting content
- **THEN** the server rejects it as a conflict, leaves entitlement state unchanged, and emits a redacted operations signal

#### Scenario: Out-of-order event cannot regress access

- **GIVEN** a renewal has already extended an account's paid-through timestamp
- **WHEN** an older cancellation or expiration event arrives later
- **THEN** the event is recorded as stale and cannot shorten or deactivate the newer entitlement

#### Scenario: Cancellation does not equal expiration

- **GIVEN** a valid cancellation event with an expiration in the future
- **WHEN** the event is applied
- **THEN** renewal is disabled but the paid entitlement remains active through the recorded expiration

#### Scenario: Invalid billing scope cannot grant access

- **GIVEN** an otherwise well-formed event references an unconfigured app, environment, product, entitlement, or unmapped user
- **WHEN** the webhook is processed
- **THEN** no entitlement is granted and the rejection/ignored outcome is recorded without creating an account mapping

#### Scenario: Authenticated account establishes canonical customer identity

- **GIVEN** anonymous Better Auth user A has a valid authenticated session
- **WHEN** billing bootstrap runs before purchase, restore, or Customer Center access
- **THEN** the server creates or returns one UUIDv7-based canonical identity C owned by A
- **AND** the request cannot choose C or claim an externally supplied identity

#### Scenario: Anonymous user purchases under C

- **GIVEN** A has authenticated billing bootstrap for canonical C and the SDK verified C
- **WHEN** A purchases, restores, or opens Customer Center
- **THEN** RevenueCat performs the operation under C
- **AND** the resulting entitlement is projected to A

#### Scenario: Fresh transition preserves C

- **GIVEN** anonymous A with canonical RevenueCat identity C successfully transitions to non-anonymous B
- **AND** C's server-side ownership and entitlement state moved to B
- **WHEN** mobile verifies the transition
- **THEN** the SDK remains on C without calling `Purchases.logIn(B)`
- **AND** B reads the moved entitlement state through authenticated account ownership

#### Scenario: RevenueCat initialization retry preserves ownership

- **GIVEN** SDK reconciliation to C was interrupted before billing became ready
- **WHEN** mobile retries initialization
- **THEN** it obtains the same C and verifies or retries that exact identity
- **AND** no entitlement snapshot from a changed SDK identity can certify the retry

#### Scenario: Existing target has an anonymous alias

- **GIVEN** B already owns a RevenueCat mapping or billing state that may represent another anonymous alias
- **WHEN** A attempts automatic account transition
- **THEN** the server rejects the transition before A deletion and does not call RevenueCat
- **AND** the client requires an explicit non-merging account choice

#### Scenario: SDK identity does not match bootstrap

- **GIVEN** authenticated bootstrap returned canonical identity C
- **WHEN** RevenueCat initialization or login completes but `getAppUserID()` is not C
- **THEN** the client keeps purchase, restore, and Customer Center unavailable
- **AND** it reports a retryable billing identity error without logging C

#### Scenario: Alias webhook extends the mapping set

- **GIVEN** C is mapped to B
- **WHEN** a valid RevenueCat webhook contains C together with another alias
- **THEN** all non-conflicting customer IDs in the event are mapped to B idempotently
- **AND** any alias already owned by another account makes the event a conflict without mutating entitlement state

#### Scenario: Account attempts to claim another mapping

- **GIVEN** a RevenueCat identity is already owned by Account A
- **WHEN** authenticated Account B attempts to bootstrap or attach that identity
- **THEN** the server rejects the ownership conflict and leaves Account A's mapping unchanged

#### Scenario: Mapping resolves a previously unmapped event

- **GIVEN** a valid signed event was persisted as unmapped before authenticated bootstrap completed
- **WHEN** the owning account establishes its durable mapping
- **THEN** the processor re-evaluates the stored event idempotently and applies it at most once

#### Scenario: Production webhook is unsigned

- **GIVEN** hosted production billing is enabled
- **WHEN** a RevenueCat webhook lacks the configured authentication credential
- **THEN** the server returns an authorization error and performs no billing database mutation

#### Scenario: RevenueCat provider is disabled

- **GIVEN** `BILLING_PROVIDER=none`
- **WHEN** a request reaches the RevenueCat webhook route
- **THEN** the route rejects the request without parsing it into domain state or mutating the billing database
