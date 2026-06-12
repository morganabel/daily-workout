## ADDED Requirements

### Requirement: V1 Strategy Scope

The adaptive coach program MUST treat ordered rotation and weekly target balance as the v1-functional schedule strategies. Fixed calendar commitments, minimum effective dose, and dated event preparation MAY be represented as schema hooks, but implementations MUST treat them as unsupported or fallback behavior until a later OpenSpec change defines their concrete behavior.

#### Scenario: Non-queue strategy is functional

- **WHEN** a coach program uses weekly target balance
- **THEN** projection and recommendation behavior works without an ordered queue, proving coach behavior is not queue-only

#### Scenario: Deferred strategy remains hook

- **WHEN** a program carries a minimum effective dose or event-prep strategy id before those strategies are implemented
- **THEN** the implementation returns an explicit unsupported or fallback state rather than pretending full strategy behavior exists

### Requirement: Simple Coach Experience

The adaptive coach program MUST preserve a simple user experience where the coach selects internal planning mechanics from goals, constraints, history, and life context. The primary UI MUST NOT require the user to choose internal strategy ids.

#### Scenario: User expresses outcome

- **WHEN** a user creates or edits a plan
- **THEN** the app asks about outcomes, availability, constraints, equipment, and life events rather than strategy mechanics
