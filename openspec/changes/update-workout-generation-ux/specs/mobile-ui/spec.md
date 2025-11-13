## MODIFIED Requirements
### Requirement: Quick Action Sheets Drive Generation
Quick action chips MUST stage preset changes in local UI state, display the chosen values on each chip, and feed those overrides directly into the next generation request. The UI SHALL highlight unsynced edits and let users apply changes without immediately generating.

#### Scenario: Chip label reflects staged value
- **GIVEN** the user edits the Time sheet to 45 minutes and taps `Apply`
- **WHEN** the sheet closes
- **THEN** the Time chip updates to “45 min” and shows a subtle staged indicator until a new plan is generated or the value is cleared

#### Scenario: Apply vs Apply & Generate
- **GIVEN** a sheet is open with a new selection
- **WHEN** the user taps `Apply & Generate`
- **THEN** the client writes the staged value locally, immediately builds a generation request using all staged overrides, and calls the generator; tapping `Apply` alone only stores the value for future generations

#### Scenario: Stage cleared after successful generation
- **GIVEN** staged overrides exist for focus and time
- **WHEN** a generation succeeds
- **THEN** the chips drop their staged indicator, move the persisted plan values into local defaults, and the overrides reset so the UI reflects the plan that was just generated

## ADDED Requirements
### Requirement: Generation Feedback & Recovery
The mobile hero experience MUST provide perceivable progress, disable conflicting actions while generation is pending, and surface actionable errors without losing context.

#### Scenario: Loading overlay after delay
- **GIVEN** the user triggers generation
- **WHEN** the request remains unresolved for >400 ms
- **THEN** the hero card shows an ActivityIndicator overlay with copy from `generationStatus` (e.g., “Generating with OpenAI… 12s elapsed”) and disables Generate/Customize buttons until the status returns to `idle`

#### Scenario: Pending state disables quick actions
- **GIVEN** `generationStatus.state` is `pending`
- **WHEN** the home screen renders
- **THEN** quick action chips become read-only with a tooltip explaining that edits resume after the current plan finishes, preventing conflicting staged state

#### Scenario: Error surfaces with retry
- **GIVEN** `generationStatus.state` is `error` with a message
- **WHEN** the user returns to the home screen
- **THEN** the hero card shows inline error text, the chips retain their staged values, and the Generate button becomes a `Retry` CTA that reuses the staged context

#### Scenario: Successful generation hydrates from snapshot
- **GIVEN** a generation completes and the client refetches `/api/home/snapshot`
- **WHEN** the screen refreshes
- **THEN** the hero card renders the persisted plan without requiring another manual fetch, and the Preview/Log buttons operate on that plan even after an app restart
