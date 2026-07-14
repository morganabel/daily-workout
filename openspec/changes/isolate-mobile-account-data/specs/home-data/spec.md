## ADDED Requirements

### Requirement: Exact Planned Workout Targeting

Mobile workout operations MUST identify a persisted planned workout by its local workout ID. Loading or refreshing a selected workout MUST NOT substitute a workout selected for another date. Regeneration MUST preserve the target's persisted scheduled date and baseline workout identity, and MUST return or resolve the local ID of the newly selected persisted result.

#### Scenario: Future workout is refreshed

- **GIVEN** a user selected a planned workout for a future local date
- **AND** a different planned workout exists for today
- **WHEN** the selected workout is refreshed by local ID
- **THEN** the future workout is returned and today's workout is not substituted

#### Scenario: Selected workout is regenerated

- **GIVEN** a persisted planned workout has a local ID and scheduled date
- **WHEN** the user regenerates it
- **THEN** generation uses that scheduled date and baseline ID, persists the replacement on the same local date, and exposes the replacement's local workout ID

#### Scenario: Selected workout no longer exists

- **GIVEN** a caller holds a local workout ID that has been deleted
- **WHEN** it requests the exact workout
- **THEN** the data layer reports that the target is unavailable and does not return a different planned workout

### Requirement: ID-Scoped Planned Workout Graph Deletion

The mobile data layer MUST provide a planned-workout discard operation that accepts exactly one local workout ID. It MUST verify the target is planned, clear nullable planned-event links to that workout, permanently delete the workout's sets and exercises, and then delete the workout in one database write. It MUST preserve every unrelated workout, child graph, and user-owned planned event.

#### Scenario: Discard one of several planned workouts

- **GIVEN** planned workouts A and B exist on the same or different dates
- **WHEN** the user discards workout A by local ID
- **THEN** A and its exercises and sets are deleted while B and its graph remain unchanged

#### Scenario: Discard a workout linked to an event

- **GIVEN** a user-owned planned event links to workout A
- **WHEN** workout A is discarded
- **THEN** the event remains stored with its workout link cleared and no dangling reference remains

#### Scenario: Discard rejects a completed workout

- **GIVEN** the supplied local ID identifies a completed workout
- **WHEN** the planned-workout discard operation is called
- **THEN** it rejects the operation without deleting or changing that workout

#### Scenario: Broad planned-workout deletion is unavailable

- **GIVEN** multiple planned workouts exist
- **WHEN** a Preview discard command is constructed
- **THEN** it must supply one local workout ID and cannot invoke a delete-all-planned operation
