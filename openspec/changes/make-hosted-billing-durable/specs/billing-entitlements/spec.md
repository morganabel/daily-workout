## MODIFIED Requirements

### Requirement: Hosted Entitlement State Endpoint

Hosted deployments MUST expose an authenticated, account-scoped entitlement state backed by durable storage. The response MUST include plan/tier, entitlement identity, effective status, renewal state, current paid/grace boundaries, quota window, remaining included generations, and refresh time. Quota-window boundaries MUST be stable and account-anchored before the first managed reservation so earlier BYOK usage remains in the same reported window. Effective access MUST be computed from stored validity boundaries so a delayed expiration webhook cannot grant access indefinitely.

#### Scenario: Cancellation remains active through the paid period

- **GIVEN** an authenticated account whose subscription was canceled and whose paid-through timestamp is in the future
- **WHEN** the client requests entitlement state
- **THEN** the server reports paid access as active, reports `willRenew=false`, and returns the current period end

#### Scenario: Paid period has elapsed

- **GIVEN** an authenticated account whose paid-through and grace boundaries are in the past with no newer renewal
- **WHEN** the client requests entitlement state
- **THEN** the server reports the paid entitlement inactive even if a final expiration webhook has not arrived

#### Scenario: State survives a server restart

- **GIVEN** an account with a persisted entitlement and quota window
- **WHEN** every hosted application process restarts
- **THEN** subsequent entitlement reads return the same effective plan, validity boundaries, and usage counts from durable storage

#### Scenario: Invalid session is rejected

- **GIVEN** a request with no valid authenticated session
- **WHEN** entitlement state is requested
- **THEN** the server returns an authorization error and does not disclose account billing details

### Requirement: Entitlement-Aware Usage Enforcement

Hosted generation policy MUST reserve included usage atomically before invoking a managed provider. A successful reservation MUST return a unique token, and commit and rollback MUST address only that exact reservation as idempotent state transitions. The reservation MUST be committed durably after the validated result is accepted and rolled back on failure or abort; commit is not required to be atomic with result persistence, and a crash between provider success and commit MAY miscount a single generation. Entitlement state, quota windows, usage events, and reservations MUST survive process restarts, and concurrent reservations MUST NOT exceed the window limit. BYOK bypass applies only when the credential actually selected for the chosen provider came from a matching client BYOK header.

#### Scenario: Concurrent requests compete for the last slot

- **GIVEN** one included generation remains and two hosted instances receive managed-key requests for the same account concurrently
- **WHEN** both attempt to reserve usage
- **THEN** exactly one reservation succeeds, the other returns `QUOTA_EXCEEDED`, and at most one provider is invoked

#### Scenario: Successful generation commits its reservation

- **GIVEN** a managed-key request has an active quota reservation
- **WHEN** its validated result is accepted
- **THEN** the server commits that exact reservation durably, and the committed count survives restart

#### Scenario: Failed generation rolls back its reservation

- **GIVEN** a managed-key request has an active quota reservation
- **WHEN** provider invocation, validation, or persistence fails
- **THEN** the server rolls back that exact included-generation reservation without changing any other request's allowance, while any actual managed-provider spend already incurred remains metered

#### Scenario: Abandoned reservation expires

- **GIVEN** a process terminates after reserving usage but before commit or rollback
- **WHEN** the configured reservation lifetime elapses
- **THEN** the pending reservation no longer counts toward the active-reservation check, while an exact later commit for completed in-flight work still charges the original window

#### Scenario: Selected BYOK credential bypasses included quota

- **GIVEN** the account is over its included limit and the selected provider credential came from that provider's matching BYOK header
- **WHEN** generation is requested
- **THEN** entitlement quota is bypassed and no included-usage reservation is created

#### Scenario: Unused key header does not bypass included quota

- **GIVEN** the account is over its included limit and sends a key header that is not the credential selected for the chosen provider
- **WHEN** generation is requested using a managed credential
- **THEN** policy evaluates included quota, returns `QUOTA_EXCEEDED`, and no provider is invoked

### Requirement: Purchase Verification and Restore Synchronization

Hosted billing MUST accept only authenticated, validated RevenueCat webhooks and MUST persist each normalized event before mutating entitlement state. Processing MUST be idempotent by RevenueCat event ID and order-aware by vendor event timestamp. Entitlements are account-bound and MUST NOT be granted from an unknown app, environment, product, entitlement, or unmapped RevenueCat identity.

RevenueCat customer ownership MUST be established through an authenticated hosted billing bootstrap before purchase or restore. Webhook payloads MUST NOT create arbitrary account mappings. When a valid event was stored as unmapped before bootstrap completed, establishing the mapping MUST reconcile that event idempotently.

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

#### Scenario: Authenticated account establishes customer mapping

- **GIVEN** a hosted account has a valid authenticated session and no RevenueCat mapping
- **WHEN** its billing bootstrap runs before purchase or restore
- **THEN** the server creates or returns exactly one durable RevenueCat identity owned by that account

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

### Requirement: CE/Self-Host Neutral Billing Defaults

Self-host deployments MUST remain billing-neutral by default. The canonical billing domain and durable PostgreSQL implementation MAY ship in the same product image, but `BILLING_PROVIDER=none` MUST NOT initialize or require RevenueCat state. Any in-memory billing adapter MUST be explicitly restricted to tests or local development.

#### Scenario: Self-host remains functional without billing services

- **GIVEN** a self-host deployment with `BILLING_PROVIDER=none`
- **WHEN** users generate workouts
- **THEN** generation proceeds without hosted entitlement enforcement and billing capabilities remain disabled

#### Scenario: Memory adapter is selected in hosted production

- **GIVEN** hosted production billing is enabled
- **WHEN** configuration selects the development memory adapter
- **THEN** composition fails before the server accepts traffic

#### Scenario: Durable adapter becomes unavailable

- **GIVEN** hosted production uses managed provider credentials and its durable billing adapter is unavailable
- **WHEN** a user requests generation
- **THEN** the server returns service unavailable before provider invocation rather than granting usage permissively

## ADDED Requirements

### Requirement: Generation Admission And Spend Ceilings

Hosted generation MUST separate correlation, execution, allowance, and spend. `x-request-id` is caller-controlled correlation metadata and MUST NOT determine ledger uniqueness, quota deduplication, or spend deduplication. Every owned execution MUST have a server-generated operation ID that keys its reservation and usage events.

Before any provider invocation, hosted generation MUST enforce bounded per-account request rate and per-account active-generation concurrency. These controls apply to managed, Vertex, and BYOK calls and MAY be process-local in the single-instance deployment; their counters MAY reset on restart.

Before a managed or Vertex invocation, the server MUST deny the request when the account's or the deployment's settled managed-provider cost for the current day has reached its configured ceiling. Actual provider cost MUST be settled durably for every upstream attempt, including attempts belonging to operations that time out, fail validation, fail persistence, or return no workout, so failed attempts count toward ceilings. Unknown managed pricing or an unavailable spend query MUST fail closed before provider work; in-flight concurrent requests MAY overshoot a ceiling by at most the configured concurrency times the maximum single-request cost.

The customer-facing included-generation reservation remains independent: an operation that returns no workout MAY release that allowance even though its already-incurred provider spend remains settled against platform ceilings.

#### Scenario: Reused correlation ID creates independent executions

- **GIVEN** one authenticated account submits different requests using the same `x-request-id`
- **WHEN** both pass admission
- **THEN** each receives a distinct server operation ID, each actual provider attempt is metered, and neither usage record suppresses the other

#### Scenario: Account exceeds rate or concurrency limits

- **GIVEN** an authenticated account has reached its request-rate or active-generation limit
- **WHEN** it submits another generation request
- **THEN** the server denies the request with a stable rate or concurrency error before provider invocation

#### Scenario: Failed provider attempt still counts toward spend ceilings

- **GIVEN** a managed operation with an included-generation reservation
- **WHEN** a billable upstream attempt occurs but no workout is returned
- **THEN** the included-generation reservation may roll back while the attempt's actual provider cost is durably settled and counts toward account and global ceilings

#### Scenario: BYOK exceeds infrastructure admission

- **GIVEN** a matching selected BYOK credential and an exhausted account request or concurrency limit
- **WHEN** generation is requested
- **THEN** the server denies the request before provider invocation even though no included-generation allowance or spend ceiling would apply

#### Scenario: Daily spend ceiling is reached

- **GIVEN** the account's or the deployment's settled managed-provider cost for the current day has reached its configured ceiling
- **WHEN** a managed or Vertex request reaches admission
- **THEN** the server returns a stable spend-ceiling denial and does not invoke the provider

#### Scenario: Managed pricing is unknown

- **GIVEN** the selected managed provider/model has no usable provider-reported cost contract or configured pricing
- **WHEN** the server cannot determine what the attempt would cost
- **THEN** managed generation fails closed before provider invocation rather than recording the call as free

#### Scenario: Spend data is unavailable

- **GIVEN** the durable spend query cannot be evaluated
- **WHEN** a managed or Vertex request reaches admission
- **THEN** the server fails closed with a dependency-unavailable error rather than treating unknown spend as headroom
