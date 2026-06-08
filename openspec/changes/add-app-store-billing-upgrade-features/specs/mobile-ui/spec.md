## ADDED Requirements

### Requirement: Capability-Gated Upgrade Entry Points

The mobile app MUST gate all upgrade/paywall entry points using backend billing capabilities from `/api/meta`. Upgrade UI MUST be rendered only when billing is explicitly enabled; when billing is disabled or unspecified, the app MUST preserve the existing CE/self-host flow without paywall affordances. The behavioral logic for computing upgrade availability is defined in `mobile-upgrade-experience`; this requirement covers screen-level placement and visibility of upgrade surfaces.

#### Scenario: Hosted backend shows profile upgrade entry point

- **GIVEN** `/api/meta` indicates `billing.enabled=true` and `billing.showUpgradeUi=true`
- **WHEN** the user views Profile surfaces
- **THEN** the app shows a plan entry point that opens the hosted paywall flow

#### Scenario: Hosted quota denial opens upgrade flow

- **GIVEN** `/api/meta` indicates `billing.enabled=true` and `billing.showUpgradeUi=true`
- **WHEN** the user attempts generation and the server returns `QUOTA_EXCEEDED`
- **THEN** the app opens the hosted paywall flow without requiring a persistent Home upgrade affordance

#### Scenario: Self-host backend hides upgrade entry points

- **GIVEN** `/api/meta` indicates billing is disabled (or billing capability fields are absent)
- **WHEN** the user views Profile surfaces or attempts generation
- **THEN** no upgrade/paywall entry points are shown and the existing generation + BYOK UX remains unchanged

## MODIFIED Requirements

### Requirement: Home CTA Execution

The hero buttons and quick log affordances MUST invoke real data mutations and keep the UI state in sync with the latest snapshot. Generation failures MUST route users to the correct recovery path: entitlement denials to upgrade when billing is enabled, and key-related denials to BYOK setup.

#### Scenario: Generate workout submits context

- **GIVEN** the user taps `Generate workout` (or `Customize -> Generate`)
- **WHEN** the app has a network connection and a configured API key
- **THEN** it sends the staged quick-action parameters to the generator endpoint, disables the CTA until the response arrives, and refreshes the hero card with the returned plan

#### Scenario: Log done refreshes activity list

- **GIVEN** a plan is in `ready` state
- **WHEN** the user taps `Log done`
- **THEN** the app marks the workout complete via the logging endpoint, shows a transient loading state, and updates the Recent Activity list with the new entry

#### Scenario: Quick log bottom bar entry

- **GIVEN** the user taps `Quick log`
- **WHEN** they submit a bodyweight/cardio entry without an active plan
- **THEN** the app posts a short workout summary, clears the sheet, and prepends the response to Recent Activity

#### Scenario: Offline or BYOK missing

- **GIVEN** the user taps any networked CTA while offline or without an API key
- **WHEN** the app validates execution prerequisites
- **THEN** the action is blocked, the inline BYOK banner appears, and no network request is attempted

#### Scenario: Generation errors route to appropriate recovery flow

- **GIVEN** generation fails with an actionable error code (`QUOTA_EXCEEDED` or `BYOK_REQUIRED`)
- **WHEN** the app handles the error
- **THEN** it routes the user to the appropriate recovery flow as defined by the error-driven routing rules in `mobile-upgrade-experience`
