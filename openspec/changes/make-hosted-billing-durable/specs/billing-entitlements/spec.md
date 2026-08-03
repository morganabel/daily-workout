## MODIFIED Requirements

### Requirement: Hosted Entitlement State Endpoint

Hosted deployments MUST expose an authenticated, account-scoped entitlement state backed by durable storage. The response MUST include plan/tier, entitlement identity, effective status, renewal state, current paid/grace boundaries, quota window, remaining included generations, and refresh time. Effective access MUST be computed from stored validity boundaries so a delayed expiration webhook cannot grant access indefinitely.

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

Hosted generation policy MUST reserve included usage atomically before invoking a managed provider. A successful reservation MUST return a unique token. The consolidated server MUST use this repository's `server-db` lineage to make the semantically validated, replayable generation result, its idempotent successful usage event, and that reservation's commit durable atomically before returning the result, or MUST use a transactional outbox whose reconciliation completes all three before replay. Entitlement state, quota windows, attempts, usage events, and reservations MUST remain consistent across process restarts and concurrent instances. BYOK bypass applies only when the credential actually selected for the chosen provider came from a matching client BYOK header.

#### Scenario: Concurrent requests compete for the last slot

- **GIVEN** one included generation remains and two hosted instances receive managed-key requests for the same account concurrently
- **WHEN** both attempt to reserve usage
- **THEN** exactly one reservation succeeds, the other returns `QUOTA_EXCEEDED`, and at most one provider is invoked

#### Scenario: Successful generation commits its reservation

- **GIVEN** a managed-key request has an active quota reservation
- **WHEN** its validated result is finalized for persistence and replay
- **THEN** the server makes attempt success and that exact reservation's commit durable together, and both remain available after restart

#### Scenario: Failed generation rolls back its reservation

- **GIVEN** a managed-key request has an active quota reservation
- **WHEN** provider invocation, validation, or result finalization fails before the atomic commit point
- **THEN** the server rolls back that exact included-generation reservation without changing any other request's allowance, while separately settling any actual managed-provider spend already incurred

#### Scenario: Abandoned reservation expires

- **GIVEN** a process terminates after reserving usage but before any validated result becomes durable
- **WHEN** the configured reservation lifetime elapses and the next transactional reserve/reclaim runs
- **THEN** the abandoned reservation becomes expired exactly once and no longer consumes allowance

#### Scenario: Process crashes after result finalization

- **GIVEN** a validated result has reached the hosted atomic finalization boundary
- **WHEN** the process crashes before sending or replaying the HTTP response
- **THEN** the result remains replayable and its exact reservation remains committed after restart

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

### Requirement: Abuse-Resistant Generation Admission And Spend Enforcement

Hosted generation MUST treat correlation, idempotency, execution, allowance, and spend as separate identities and controls. `x-request-id` is caller-controlled correlation metadata and MUST NOT determine ledger uniqueness, quota deduplication, spend deduplication, or replay. Every owned execution MUST have a server-generated operation ID. Optional `Idempotency-Key` MUST be scoped to stable `auth.userId`, bound to a bounded secret-free normalized request fingerprint, and atomically map matching retries to one operation.

Before any provider invocation, hosted generation MUST enforce bounded authenticated-account request rate, trusted-source request rate, and per-account active-generation concurrency. These infrastructure controls apply to managed, Vertex, and BYOK calls. Source identity MUST come only from configured trusted ingress metadata, not arbitrary forwarding headers supplied directly by a client.

Before a managed or Vertex invocation, the server MUST reserve a conservative maximum cost against durable per-account and global hourly/daily spend windows using the selected provider/model pricing snapshot and configured prompt/output/retry caps. It MUST settle actual provider cost for every upstream attempt, including attempts belonging to operations that time out, fail validation, fail persistence, or return no workout. It MUST release the full spend reservation only when no billable upstream attempt occurred and otherwise release only the unused remainder. Unknown managed pricing, exhausted spend windows, unhealthy settlement, or unavailable durable admission state MUST trip or preserve a fail-closed circuit breaker before further managed provider work.

The customer-facing included-generation reservation remains independent: an operation that returns no workout MAY release that allowance even though its already-incurred provider spend remains settled against platform budgets.

#### Scenario: Reused correlation ID creates independent executions

- **GIVEN** one authenticated account submits different requests using the same `x-request-id` and no `Idempotency-Key`
- **WHEN** both pass admission
- **THEN** each receives a distinct server operation ID, each actual provider attempt is metered, and neither usage record suppresses the other

#### Scenario: Idempotency key is reused for different input

- **GIVEN** an account has an existing operation bound to an idempotency key and request fingerprint
- **WHEN** the same account submits that key with a different normalized fingerprint
- **THEN** the server returns an idempotency conflict before allowance, spend, or provider work

#### Scenario: Attacker rotates idempotency keys

- **GIVEN** an authenticated account submits many requests with unique idempotency keys
- **WHEN** its request-rate or active-generation limit is reached
- **THEN** further requests are denied before provider invocation regardless of key uniqueness

#### Scenario: Failed provider attempt still consumes platform spend

- **GIVEN** a managed operation reserved allowance and maximum provider cost
- **WHEN** a billable upstream attempt occurs but no workout is returned
- **THEN** the included-generation reservation may roll back, actual provider cost is durably settled, and only unused spend reserve is released

#### Scenario: BYOK exceeds infrastructure admission

- **GIVEN** a matching selected BYOK credential and an exhausted account/source request or concurrency limit
- **WHEN** generation is requested
- **THEN** the server denies the request before provider invocation even though no included-generation or managed-spend reservation would apply

#### Scenario: Global managed-spend circuit breaker is open

- **GIVEN** the global hourly or daily managed-spend window cannot reserve the operation's conservative maximum cost
- **WHEN** a managed or Vertex request reaches admission
- **THEN** the server returns a stable spend-budget denial and does not invoke the provider

#### Scenario: Managed pricing is unknown

- **GIVEN** the selected managed provider/model has no usable provider-reported cost contract or configured pricing snapshot
- **WHEN** the server cannot conservatively reserve maximum cost
- **THEN** managed generation fails closed before provider invocation rather than recording the call as free
