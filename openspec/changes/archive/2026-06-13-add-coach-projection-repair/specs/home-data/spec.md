## ADDED Requirements

### Requirement: Local Coach Projection Output

The Home data layer MUST expose coach projection output derived from local data. The output MUST include today's projected recommendation, upcoming projected sessions, projection ids, statuses, repair notes, conflict warnings, and available local actions.

#### Scenario: Home receives projection

- **WHEN** a user has an active coach program with enough local inputs
- **THEN** Home data includes today's projected coach recommendation and upcoming sessions

#### Scenario: Offline projection remains available

- **WHEN** the device is offline
- **THEN** Home data can still compute and expose the local coach projection

### Requirement: Projection Actions In Home Data

The Home data layer MUST support local skip, pin, unpin, and move actions for projected coach sessions. These actions MUST update durable local inputs and recompute projection output. Skips MUST be recorded as durable coach session action records keyed by session identity. A move MUST be recorded as a pinned session preference at the chosen date rather than a separate moved state.

#### Scenario: Skip action updates projection

- **WHEN** the user skips a projected session
- **THEN** Home data records a durable skip record and recomputes the projection from durable inputs

#### Scenario: Pin action updates projection

- **WHEN** the user pins a projected session
- **THEN** Home data records the pin and subsequent repair preserves the pinned commitment

#### Scenario: Move records a pinned commitment

- **WHEN** the user moves a projected session to another date
- **THEN** Home data records a pinned session preference at the new date and the projection repairs around it

### Requirement: Planned Events Remain User-Owned

The Home data layer MUST treat planned events as user-owned context for projection. Projection repair MUST NOT overwrite or mutate planned events.

#### Scenario: Event affects projection without overwrite

- **WHEN** a planned event conflicts with a projected workout
- **THEN** Home data exposes a repaired projection or conflict warning while leaving the planned event unchanged

### Requirement: Home Projection Stability

Rebuilding Home data from unchanged local inputs MUST produce the same projection ids, session ordering, and repair notes.

#### Scenario: Refresh does not churn

- **WHEN** Home reloads with unchanged program, history, pins, skips, and planned events
- **THEN** projection output remains stable
