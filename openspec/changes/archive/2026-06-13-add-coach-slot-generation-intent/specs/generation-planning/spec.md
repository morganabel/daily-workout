## ADDED Requirements

### Requirement: Coach Projection Intent In Planning

Generation planning MUST accept optional coach projection intent when a user generates a workout from a projected coach session. The intent MUST include program id, program version, projection id, planning date, source block intent, optional add-on intents, target-range context, schedule strategy, session disposition, and repair rationale when available. Session disposition MUST distinguish projected, pinned, repaired, and substituted sessions so persistence and skip accounting can treat substitutions explicitly.

#### Scenario: Projection intent enters planning brief

- **WHEN** a user generates from a projected coach session
- **THEN** the planning brief records the projection id, source block intent, target context, session disposition, and coach rationale

#### Scenario: Substituted session is flagged

- **WHEN** a user generates a coach-recommended substitute for blocked or skipped work
- **THEN** the intent carries the substituted disposition so the saved workout can be recorded as a substitution rather than normal completion of the original work

#### Scenario: Hard constraints override projection intent

- **WHEN** projection intent conflicts with injuries, avoid-list, equipment, explicit user focus, or event-protected stressors
- **THEN** planning adjusts the generated workout intent rather than relaxing hard constraints

### Requirement: Exercise Slot Policy In Planning

Generation planning MUST accept optional exercise-slot policy. Slot policy MUST identify stable, coach-rotatable, and user-locked slots, current assignments, eligible movement or exercise criteria, and override reasons when a slot cannot be preserved.

#### Scenario: Stable slot is preserved

- **WHEN** a stable slot has an eligible current assignment and required equipment is available
- **THEN** planning includes that assignment so generation can preserve it

#### Scenario: Rotatable slot can vary

- **WHEN** a coach-rotatable slot has eligible alternatives
- **THEN** planning may allow a different exercise within deterministic constraints

#### Scenario: Slot override is recorded

- **WHEN** a slot assignment cannot be used because of hard constraints
- **THEN** planning records an explicit override reason

### Requirement: Slot Attribution For Persistence

Generation planning MUST return or expose the metadata needed for local persistence to link generated workout content back to source slots where slots are used.

#### Scenario: Generated workout saves slot source

- **WHEN** generation succeeds for a slot-aware projected session
- **THEN** the local persistence path can save source slot ids and assignment metadata with the workout

#### Scenario: Slot metadata stays internal

- **WHEN** workout content is shown to the user
- **THEN** internal slot ids are not required to appear as user-facing workout copy
