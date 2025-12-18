## MODIFIED Requirements
### Requirement: Active Workout Mode
The app SHALL provide an active mode for executing a workout plan, tracking time, and logging detailed performance (sets, reps, weight).

For this iteration, the app SHALL represent load with an explicit unit (`kg` or `lb`). The weight input UI defaults to the user’s preferred unit (or `kg` if unset) and stores the unit alongside the numeric weight value.

#### Scenario: Start workout
- **GIVEN** a generated plan is visible on the Preview screen
- **WHEN** the user taps "Start workout"
- **THEN** the app navigates to the Active Workout screen and starts the session timer

#### Scenario: Track set details
- **GIVEN** the Active Workout screen is open
- **WHEN** the user views an exercise
- **THEN** they see a list of sets with fields for Weight, Reps, and RPE, pre-filled with the plan's prescription where possible

#### Scenario: Show previous performance context
- **GIVEN** the Active Workout screen is open for an exercise name the user has performed before
- **WHEN** the exercise section renders
- **THEN** the UI shows a lightweight “Last time” summary sourced from the most recent completed on-device session matching by exercise name (for example date + best/last set summary)

#### Scenario: Edit sets
- **GIVEN** an exercise in active mode
- **WHEN** the user taps "Add Set" or swipes to delete a set
- **THEN** the UI updates immediately and persists the change to the local database

#### Scenario: Toggle set completion
- **GIVEN** a set row
- **WHEN** the user taps the completion checkbox
- **THEN** the set is marked as completed and the row visual style updates

#### Scenario: Validate set inputs
- **GIVEN** a set row has editable fields
- **WHEN** the user enters invalid values (reps < 1, negative weight, RPE outside 1-10, or non-numeric text)
- **THEN** the UI prevents saving invalid values (coerces to empty or previous valid value) and communicates the error inline without crashing

**Validation rules**:
- `reps`: integer >= 1 (0 is invalid; empty is valid for incomplete sets)
- `weight`: number >= 0 (0 is valid for bodyweight; empty is valid for incomplete)
- `rpe`: integer 1-10 or empty
- All fields accept empty as "not yet entered"

#### Scenario: Resume after app restart
- **GIVEN** the user has edited set fields during an active workout
- **WHEN** the app is terminated and reopened
- **THEN** the Active Workout screen restores the in-progress session state and the previously entered set values from the local database

#### Scenario: Timer recalculation on restore
- **GIVEN** the user started a workout 10 minutes ago, then terminated the app
- **WHEN** the app is reopened and the Active Workout screen loads
- **THEN** the timer displays approximately 10 minutes (calculated from persisted `startedAt` timestamp to current time)

#### Scenario: Finish workout
- **GIVEN** the user is in an active workout
- **WHEN** they tap "Finish Workout"
- **THEN** the app captures the final state of all sets (including modified weights/reps), marks the workout as completed locally with `status: 'completed'` and `completedAt: <now>`, and the user is returned to the Home Screen

#### Scenario: Complete workout while offline
- **GIVEN** the user has finished editing all sets and the device has no network connectivity
- **WHEN** the user taps "Finish Workout"
- **THEN** the app saves the workout locally with `sync_pending: true`, marks it as completed, returns to the Home Screen, and queues the sync for the next connectivity window

#### Scenario: Select weight unit per set
- **GIVEN** the user is editing a set's weight field
- **WHEN** the user changes the unit selector (kg/lb)
- **THEN** the UI updates the unit for that specific set and persists it to the database

#### Scenario: Display "last time" context with history
- **GIVEN** the Active Workout screen is open for an exercise named "Bench Press" and the user has completed "bench press" in a previous session
- **WHEN** the exercise section renders
- **THEN** the UI shows a summary like "Last: Dec 15 - 3×10 @ 135 lb" sourced from the most recent completed session matching by case-insensitive name

#### Scenario: Display no history context
- **GIVEN** the Active Workout screen is open for an exercise the user has never performed
- **WHEN** the exercise section renders
- **THEN** no "Last time" context is displayed (the section is omitted)
