## ADDED Requirements
### Requirement: Workout Preview Screen
The mobile app MUST provide a dedicated preview view of the suggested workout before starting any timers or logging.

#### Scenario: Preview button navigation
- **WHEN** the user taps the `Preview` button on the Home hero card
- **THEN** the app navigates to the workout preview screen

#### Scenario: Preview layout mirrors active workout
- **WHEN** the preview screen renders
- **THEN** it shows the workout title, duration, equipment badges, energy indicator, and block-by-block exercise details with prescriptions while leaving controls non-interactive

#### Scenario: Back returns to Home
- **WHEN** the user taps Back on the preview screen
- **THEN** the app returns to the Home screen without starting the workout

