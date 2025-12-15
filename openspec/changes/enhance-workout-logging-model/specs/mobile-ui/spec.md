## MODIFIED Requirements
### Requirement: Active Workout Mode
The app SHALL provide an active mode for executing a workout plan, tracking time, and logging detailed performance (sets, reps, weight).

#### Scenario: Start workout
- **GIVEN** a generated plan is visible on the Preview screen
- **WHEN** the user taps "Start workout"
- **THEN** the app navigates to the Active Workout screen and starts the session timer

#### Scenario: Track set details
- **GIVEN** the Active Workout screen is open
- **WHEN** the user views an exercise
- **THEN** they see a list of sets with fields for Weight, Reps, and RPE, pre-filled with the plan's prescription where possible

#### Scenario: Edit sets
- **GIVEN** an exercise in active mode
- **WHEN** the user taps "Add Set" or swipes to delete a set
- **THEN** the UI updates immediately and persists the change to the local database

#### Scenario: Toggle set completion
- **GIVEN** a set row
- **WHEN** the user taps the completion checkbox
- **THEN** the set is marked as completed and the row visual style updates

#### Scenario: Finish workout
- **GIVEN** the user is in an active workout
- **WHEN** they tap "Finish Workout"
- **THEN** the app captures the final state of all sets (including modified weights/reps), marks the workout as completed locally with `status: 'completed'` and `completedAt: <now>`, and the user is returned to the Home Screen
