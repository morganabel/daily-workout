## ADDED Requirements
### Requirement: Active Workout Mode
The app SHALL provide an active mode for executing a workout plan, tracking time, and logging completion.

#### Scenario: Start workout
- **GIVEN** a generated plan is visible on the Preview screen
- **WHEN** the user taps "Start workout"
- **THEN** the app navigates to the Active Workout screen and starts the session timer

#### Scenario: Track progress
- **GIVEN** the Active Workout screen is open
- **WHEN** the user completes an exercise
- **THEN** they can toggle a completion state (checkbox) for that item

#### Scenario: Finish workout
- **GIVEN** the user is in an active workout
- **WHEN** they tap "Finish Workout"
- **THEN** the current workout record in the local database is updated with `status: 'completed'` and `completedAt: <now>`, and the user is returned to the Home Screen


