## ADDED Requirements

### Requirement: Hosted Entitlement State Endpoint

Hosted deployments MUST expose an authenticated entitlement state for the current account so clients can render plan status and purchase outcomes. The entitlement payload MUST include at least plan/tier, entitlement status, quota window, and remaining included generations.

#### Scenario: Authenticated user receives entitlement state

- **GIVEN** a hosted user with a valid authenticated session
- **WHEN** the client requests entitlement state
- **THEN** the server returns the account's current entitlement status, plan identifier, quota window metadata, and remaining allowance

#### Scenario: Anonymous or invalid session is rejected

- **GIVEN** a request with no valid authenticated session
- **WHEN** entitlement state is requested
- **THEN** the server returns an authorization error and does not disclose entitlement details

### Requirement: Entitlement-Aware Usage Enforcement

Hosted generation policy MUST evaluate entitlements before model invocation for requests that use managed (server-side) keys. Requests that exceed included limits MUST be denied with `QUOTA_EXCEEDED` and MUST NOT invoke model providers. BYOK requests bypass entitlement quota checks because the user is self-funding inference costs; platform-level rate limiting is a separate concern outside this spec.

#### Scenario: In-plan user can generate

- **GIVEN** the account has available included usage for the active quota window
- **WHEN** the user requests generation
- **THEN** policy allows the request and generation proceeds normally

#### Scenario: Over-limit user is denied before model call

- **GIVEN** the account has exhausted included usage for the active quota window and the request does not include BYOK keys
- **WHEN** the user requests generation
- **THEN** policy denies the request with `QUOTA_EXCEEDED` and no model provider is invoked

#### Scenario: BYOK user bypasses entitlement quota

- **GIVEN** the account has exhausted included usage for the active quota window but provides a valid BYOK key
- **WHEN** the user requests generation
- **THEN** the entitlement policy check is skipped and generation proceeds using the BYOK key

### Requirement: Purchase Verification and Restore Synchronization

Hosted billing MUST verify purchase evidence before granting paid entitlements and MUST support restoring previously purchased entitlements for the same account. Purchase verification and subscription lifecycle management are delegated to RevenueCat; the hosted backend receives entitlement updates via RevenueCat webhooks and maps the RevenueCat customer ID to the account's `userId`.

#### Scenario: Verified purchase grants entitlement

- **GIVEN** a client completes a store transaction and RevenueCat processes the receipt
- **WHEN** the hosted backend receives a RevenueCat webhook confirming the purchase
- **THEN** the account entitlement is updated to the purchased tier and becomes visible in subsequent entitlement reads

#### Scenario: Restore updates entitlement state

- **GIVEN** a user reinstalls the app or signs in on a new device
- **WHEN** they trigger restore purchases via RevenueCat SDK and verification succeeds
- **THEN** the backend reconciles entitlement state from RevenueCat and returns the restored entitlement for that account

#### Scenario: Invalid or unverified purchase does not grant access

- **GIVEN** purchase evidence is invalid, expired, or unverifiable
- **WHEN** RevenueCat verification runs
- **THEN** no webhook is dispatched and existing entitlement state remains unchanged

### Requirement: CE/Self-Host Neutral Billing Defaults

Community Edition/self-host deployments MUST remain billing-neutral by default. They MUST NOT require purchase verification or entitlement endpoints for core generation behavior.

#### Scenario: CE deployment remains functional without billing services

- **GIVEN** a CE/self-host deployment without hosted billing infrastructure
- **WHEN** users generate workouts
- **THEN** core generation behavior continues without entitlement enforcement from hosted billing systems
