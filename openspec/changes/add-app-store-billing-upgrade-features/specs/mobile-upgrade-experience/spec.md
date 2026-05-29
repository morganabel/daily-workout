## ADDED Requirements

### Requirement: Capability-Driven Upgrade Availability

The mobile app SHALL determine whether upgrade UX is available from backend capabilities, not hardcoded build flavor. Upgrade screens MUST be disabled when billing capabilities are absent or disabled. This requirement defines the behavioral logic for computing availability; screen-level placement of upgrade surfaces is specified in `mobile-ui`.

#### Scenario: Upgrade availability follows backend capabilities

- **GIVEN** the app fetches `/api/meta` and receives billing capability fields
- **WHEN** it computes upgrade availability
- **THEN** it enables upgrade UX only when `billing.enabled=true` and `billing.showUpgradeUi=true`

#### Scenario: Unknown capabilities default to no paywall

- **GIVEN** `/api/meta` omits billing fields or the request fails
- **WHEN** the app computes upgrade availability
- **THEN** it defaults to no paywall entry points until capabilities are refreshed

### Requirement: Error-Driven Upgrade Routing

Generation errors MUST route to the appropriate recovery flow so users are not blocked behind ambiguous alerts.

#### Scenario: Entitlement denial routes to paywall

- **GIVEN** a generation request returns `QUOTA_EXCEEDED`
- **WHEN** billing capabilities indicate upgrade is available
- **THEN** the app opens the paywall flow with plan choices and current entitlement context

#### Scenario: Key requirement routes to BYOK flow

- **GIVEN** a generation request returns `BYOK_REQUIRED`
- **WHEN** the app handles the response
- **THEN** the app routes to BYOK setup guidance instead of showing the paywall

### Requirement: Store Purchase and Restore Lifecycle

For backends that advertise `billing.purchaseMethod='iap'`, the mobile app MUST support purchasing and restoring entitlements through RevenueCat SDK using platform-compliant in-app purchase flows.

#### Scenario: Successful purchase refreshes entitlement

- **GIVEN** the user completes an in-app purchase via RevenueCat in the paywall flow
- **WHEN** the app finalizes the transaction and RevenueCat confirms the entitlement
- **THEN** the UI reflects the upgraded plan and generation is unblocked when policy allows

#### Scenario: Restore purchases recovers entitlement

- **GIVEN** the user has a previously purchased subscription
- **WHEN** they trigger restore purchases via RevenueCat from the paywall or profile
- **THEN** the app reconciles with RevenueCat entitlement state and restores access without requiring repurchase

#### Scenario: Purchase pending shows processing state

- **GIVEN** store purchase succeeds on-device but backend entitlement grant is still reconciling via RevenueCat webhook
- **WHEN** the user returns to generation
- **THEN** the app shows a temporary processing state and retries entitlement refresh before reporting final success/failure

### Requirement: Purchase Secret Handling

The app and server MUST treat purchase tokens/receipts as sensitive data and MUST NOT log raw purchase secrets in client or server logs.

#### Scenario: Purchase tokens are redacted in logs

- **GIVEN** purchase verification fails and telemetry/logging is emitted
- **WHEN** logs are written
- **THEN** raw store receipt/token values are not present in logs or error payloads
