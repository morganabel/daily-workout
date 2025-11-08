## ADDED Requirements
### Requirement: Home CTA Execution
The hero buttons and quick log affordances MUST invoke real data mutations and keep the UI state in sync with the latest snapshot.

#### Scenario: Generate workout submits context
- **GIVEN** the user taps `Generate workout` (or `Customize ➝ Generate`)
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
- **THEN** the action is blocked, the inline BYOK banner appears, and no network request is attempted

### Requirement: Quick Action Sheets Drive Generation
Quick action chips MUST stage preset changes and feed them directly into the next generation request.

#### Scenario: Sheet edits update staged context
- **GIVEN** the user adjusts Time/Focus/Equipment/Energy/Backfill inside a sheet
- **THEN** the staged values are reflected on the chip labels and included in subsequent plan generation calls until changed again

#### Scenario: Backfill opens log shortcut
- **GIVEN** the user selects Backfill and confirms
- **THEN** the app opens the Quick Log flow pre-populated with the chosen time window so they can record a past session without navigating away
