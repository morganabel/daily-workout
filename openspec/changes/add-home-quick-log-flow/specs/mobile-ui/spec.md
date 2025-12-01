## ADDED Requirements
### Requirement: Quick Log Sheet
The mobile Home screen MUST present a dedicated Quick Log sheet when users want to record an ad‑hoc workout, so they can capture a minimal session without leaving Home.

#### Scenario: Quick log opens sheet
- **GIVEN** the user is on the Home screen
- **WHEN** they tap the `Quick log` button in the bottom bar
- **THEN** a Quick Log sheet slides up from the bottom with fields for what they did, how long it took, and when it happened

#### Scenario: Minimal structured fields
- **GIVEN** the Quick Log sheet is visible
- **WHEN** the user enters a short activity label and a duration (in minutes), and optionally chooses when it happened and adds a note
- **THEN** the form validates that at least a label/focus and duration are present before enabling `Save log`

#### Scenario: Quick log creates manual session
- **GIVEN** the user submits a valid Quick Log entry
- **WHEN** the app processes the submission
- **THEN** it creates a completed manual workout session with the provided label/focus and duration, closes the sheet, and prepends the new entry to the Recent Activity list

#### Scenario: Offline quick log
- **GIVEN** the device is offline or has no API key configured
- **WHEN** the user completes and submits the Quick Log form
- **THEN** the app still records the session locally and updates Recent Activity, without attempting any network request

#### Scenario: Backfill via Quick log
- **GIVEN** the Quick Log sheet is visible
- **WHEN** the user sets the “When” field to an earlier‑today option and submits the form
- **THEN** the app records the session with a `completedAt` timestamp reflecting the chosen time window, without requiring a separate Backfill quick action chip

## MODIFIED Requirements
### Requirement: Quick Actions & Activity Context
Users MUST be able to tweak core parameters quickly and see at least the last three logged sessions from the home screen.

#### Scenario: Quick action chips
- **GIVEN** the user taps a chip (Time, Focus, Equipment, Energy)
- **THEN** a lightweight sheet appears allowing them to adjust the chosen parameter and dismiss without leaving the screen

#### Scenario: Activity list summary
- **GIVEN** at least one past workout exists
- **THEN** the list shows the last three sessions with name/focus, completion timestamp, and duration, plus a "View history" CTA

#### Scenario: Empty history guidance
- **GIVEN** no past workouts exist
- **THEN** the activity section shows a friendly nudge explaining that completed workouts will appear here after the first log
