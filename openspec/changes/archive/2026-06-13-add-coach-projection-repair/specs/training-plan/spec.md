## ADDED Requirements

### Requirement: Derived Coach Projection

Adaptive training plans MUST support a derived coach projection for the next 7-14 days. The projection MUST be calculated from durable inputs including coach program state, session-level attribution, completed workouts, skipped workouts, pinned sessions, target ranges, planned events, and current constraints.

Projection output MUST NOT be persisted as authoritative state in v1.

#### Scenario: Projection derives from durable inputs

- **WHEN** the system computes the next planning window
- **THEN** it derives projected sessions from program state, attributed history, pins, skips, planned events, and constraints

#### Scenario: History edit repairs projection

- **WHEN** an attributed workout is edited, deleted, or backfilled
- **THEN** the next projection reflects the changed durable history without reconciling a stored queue cursor

### Requirement: V1 Projection Strategies

Projection repair MUST implement ordered rotation and weekly target balance as v1-functional strategies. Fixed calendar, minimum effective dose, and dated event-prep strategy ids MAY exist as hooks, but the resolver MUST treat them as unsupported or future behavior until a later change defines them.

#### Scenario: Ordered rotation projects pending work

- **WHEN** the active program uses ordered rotation
- **THEN** the projection selects pending blocks in sequence while respecting recovery, target ranges, planned events, and constraints

#### Scenario: Weekly balance projects useful exposures

- **WHEN** the active program uses weekly target balance
- **THEN** the projection selects sessions based on target-range needs rather than a strict ordered queue

#### Scenario: Unsupported strategy is explicit

- **WHEN** the active program uses a strategy hook that is not v1-functional
- **THEN** the resolver returns an explicit unsupported or fallback state instead of pretending full strategy behavior exists

### Requirement: Stable Projection Identity

Projected sessions MUST receive deterministic ids from program id, program version, an integer cycle index, strategy id, and a strategy-specific session identity key. Calendar dates MUST NOT be part of any session identity key: session dates are attributes, not identity, and pinned session identity MUST be the durable pin record id alone so a moved pinned commitment keeps its id. The cycle index MUST be derived from the program's active-from date and the device's current local calendar date and MUST only change at cycle boundaries, so ids remain stable across daily refreshes within a cycle. Occurrence ordinals used in session identity keys MUST be counted across the whole anchored cycle including completed, skipped, and substituted occurrences, so pending sessions keep their identity as earlier occurrences resolve. Projected session ids MUST remain stable when repair moves the session to a different date but preserves the same session identity.

#### Scenario: No-op repair keeps ids

- **WHEN** projection repair runs twice with unchanged inputs
- **THEN** projected session ids, ordering, and repair notes remain unchanged

#### Scenario: Daily refresh keeps ids within a cycle

- **WHEN** the projection is rederived on the next calendar day within the same program cycle and no durable inputs changed
- **THEN** projected sessions that remain in the window keep their ids

#### Scenario: Completed occurrence does not shift pending identity

- **WHEN** an earlier occurrence of a block completes within the cycle
- **THEN** the remaining pending occurrence of that block keeps its ordinal and id

#### Scenario: Moved projected session keeps id

- **WHEN** a non-pinned projected session moves because of a planned-event conflict but keeps the same program identity
- **THEN** the projected session keeps the same id

#### Scenario: Moved pinned session keeps id

- **WHEN** the user moves a pinned session to a different date
- **THEN** the session keeps the same id because pinned identity is the pin record id, not the date

#### Scenario: Timezone shift only re-anchors at boundaries

- **WHEN** a timezone or device clock change moves the local calendar date without crossing a cycle boundary
- **THEN** projected session ids remain unchanged; a shift that crosses a cycle boundary causes the same one-time re-anchor as a normal boundary crossing

#### Scenario: DST transitions do not change day counts

- **WHEN** the span between the program active-from date and the current date crosses a DST spring-forward or fall-back transition
- **THEN** calendar-day differences and the derived cycle index are unaffected by the transition

### Requirement: Skip And Pending Work Semantics

Skipped coach sessions MUST be modeled explicitly. A skipped session MUST NOT count as completed target exposure. In ordered rotation, skipped work MUST remain pending unless the coach records a substitution or retirement.

#### Scenario: Skipped exposure does not count

- **WHEN** a user skips a projected cardio session
- **THEN** the target-range state does not count that skipped session as completed cardio exposure

#### Scenario: Skipped ordered work remains pending

- **WHEN** a user skips the next ordered block
- **THEN** the next projection can keep that block pending rather than advancing blindly

### Requirement: Durable Skip Records

Skips MUST be persisted as durable coach session action records that survive projection rederivation. A skip record MUST be keyed by program id, program version, and session identity key rather than only the derived projection id, MUST work for projected sessions that were never generated as workouts, and MUST support an optional substitution reference that marks the skipped work as substituted or retired.

#### Scenario: Skip of ungenerated session persists

- **WHEN** a user skips a projected session that has no generated workout record
- **THEN** a durable skip record is stored and the next projection derivation treats that session as skipped

#### Scenario: Skip survives id regeneration

- **WHEN** projection ids regenerate because of a program revision or cycle re-anchor
- **THEN** previously recorded skips still apply to the matching session identity

#### Scenario: Substitution retires skipped work

- **WHEN** a skip record carries a substitution reference
- **THEN** ordered rotation may advance past the skipped work instead of keeping it pending

### Requirement: Pinned Conflict Warning

Projection repair MUST preserve pinned sessions unless the user changes, moves, unpins, or accepts a repair. If a planned event conflicts with a pinned session, the projection MUST emit a conflict warning and possible repair actions instead of silently moving the pinned session.

#### Scenario: Pinned conflict is warned

- **WHEN** a planned event overlaps a pinned coach session
- **THEN** the projection keeps the pin and marks the conflict

#### Scenario: User action repairs pin

- **WHEN** the user accepts a move or unpin action for the conflict
- **THEN** subsequent projection uses the updated pin state
