## MODIFIED Requirements

### Requirement: Workout Preview Screen

The mobile app MUST provide a dedicated preview view of the exact persisted workout the user selected before starting timers or logging. Preview navigation MUST carry a required local workout ID, reload that ID when focused, and preserve its scheduled date through regeneration and discard actions.

#### Scenario: Preview button navigation

- **WHEN** the user taps Preview for a persisted workout
- **THEN** the app navigates to the workout preview screen with that workout's required local ID

#### Scenario: Preview layout mirrors active workout

- **WHEN** the preview screen renders the selected workout
- **THEN** it shows the workout title, duration, equipment badges, energy indicator, and block-by-block exercise details with prescriptions while leaving logging controls non-interactive

#### Scenario: Back returns to the prior screen

- **WHEN** the user taps Back on the preview screen
- **THEN** the app returns to the screen from which that workout was selected without starting it

#### Scenario: Preview focus refreshes the exact workout

- **GIVEN** the preview is showing a future-dated workout and today's workout is different
- **WHEN** the preview regains focus
- **THEN** it reloads the future workout by local ID and does not replace it with today's workout

#### Scenario: Preview target was removed

- **GIVEN** the routed local workout ID no longer exists
- **WHEN** the preview loads or regains focus
- **THEN** it shows an unavailable state and does not fall back to any other workout

#### Scenario: Regenerate preserves the selected date

- **GIVEN** Preview shows a persisted workout scheduled for a non-today date
- **WHEN** the user regenerates it
- **THEN** the replacement is saved for the same local date and Preview rebinds to the replacement's local ID

#### Scenario: Discard removes only the selected workout

- **GIVEN** Preview shows workout A and other planned workouts exist
- **WHEN** the user confirms Discard
- **THEN** the app deletes workout A by local ID, leaves the other planned workouts intact, and returns to the prior planning surface
