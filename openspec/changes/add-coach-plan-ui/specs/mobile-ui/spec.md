## ADDED Requirements

### Requirement: Coach Next Action UI

The mobile Home screen MUST show the coach's next recommended action and concise rationale when an active coach program has projection output. The primary action MUST let the user generate, start, log, skip, or otherwise act on the recommendation as appropriate.

#### Scenario: Next action shown

- **WHEN** the Home screen loads with an active coach projection
- **THEN** it shows the next recommended action and concise coach rationale

#### Scenario: Primary action is obvious

- **WHEN** a projected session has not been generated yet
- **THEN** the primary action lets the user generate the concrete workout from that projection

### Requirement: Compact Upcoming Plan UI

The mobile app MUST show a compact upcoming coach plan that distinguishes projected suggestions, pinned commitments, skipped sessions, repaired sessions, and conflict warnings.

#### Scenario: Upcoming projection is scannable

- **WHEN** the user views Home
- **THEN** upcoming coach sessions are visible in a compact view without requiring a separate planner screen

#### Scenario: Pinned session is distinct

- **WHEN** a projected session is pinned
- **THEN** the UI marks it as a user commitment

### Requirement: Coach Repair Interactions

The mobile app MUST let users skip, pin, unpin, move, and generate from projected coach sessions. After an action, the UI MUST render the repaired projection from local data.

#### Scenario: Skip repairs plan

- **WHEN** the user skips a projected session
- **THEN** the UI updates to the repaired projection and shows a concise note if the next recommendation changed

#### Scenario: Move repairs plan

- **WHEN** the user moves a projected session
- **THEN** the UI updates the projection around the new placement

### Requirement: Pinned Conflict UI

The mobile app MUST warn when a planned event conflicts with a pinned coach session. The UI MUST offer explicit repair actions and MUST NOT silently move the pinned session.

#### Scenario: Conflict warning appears

- **WHEN** a planned event overlaps a pinned coach session
- **THEN** the UI shows a warning and repair actions

#### Scenario: No silent movement

- **WHEN** the conflict warning appears
- **THEN** the pinned session remains pinned until the user chooses an action

### Requirement: Outcome-Focused Plan Settings

Plan settings MUST expose goal, availability, constraints, equipment, pinned commitments, and major events. Internal strategy mechanics MUST be hidden, secondary, or debug-only.

#### Scenario: User edits life constraints

- **WHEN** the user opens plan settings
- **THEN** they can edit practical life and training constraints without choosing internal strategy ids

#### Scenario: Strategy labels are not required

- **WHEN** the user completes normal plan setup or edits
- **THEN** the UI does not require choosing ordered rotation, weekly target balance, minimum effective dose, or event-prep labels
