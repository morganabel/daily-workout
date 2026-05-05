## ADDED Requirements

### Requirement: Local Planned Slot Data

The mobile data layer MUST maintain the starter-week planned workout slots locally using planned events. Blueprint-owned planned slots MUST be distinguishable from user-owned life events through metadata, and local queries MUST be able to return planned slots for a date range.

#### Scenario: Blueprint-owned planned slots are queryable

- **WHEN** the mobile app queries planned events for a date range
- **THEN** blueprint-owned planned slots are returned with metadata sufficient to identify schema version, source, template id, slot id, role or label, planned date, target duration, detail state, locked/user-edited marker, and ownership

#### Scenario: User-owned events remain separate

- **WHEN** planned events are used as life context for generation
- **THEN** user-owned life events and blueprint-owned planned workout slots remain distinguishable so starter-week logic updates only app-owned slots

#### Scenario: Planned slots work offline

- **WHEN** the device is offline
- **THEN** the app can still display deterministic starter-week planned slots from local data

### Requirement: Planned Slot To Workout Persistence

When a concrete workout is generated for a planned slot, the mobile data layer MUST link the generated workout to the source planned event and preserve that link across app restarts.

#### Scenario: Generated workout links to planned event

- **WHEN** the app saves a workout generated from a planned slot
- **THEN** it records the link from the planned event to the generated workout

#### Scenario: Linked slot survives metadata updates

- **WHEN** blueprint-owned planned slot metadata is read or updated
- **THEN** it preserves slots that have linked generated workouts

## MODIFIED Requirements

### Requirement: Planning-Date And Baseline-Aware Generation Requests

The workout generation flow MUST accept the operational request inputs needed by the planning layer, including an optional planning date, explicit regeneration baseline workout context, and optional planned-slot intent. Regeneration and planned-slot requests MUST be able to include full merged context rather than assuming provider-side memory.

#### Scenario: Scheduled generation can plan for a future day

- **WHEN** the client requests workout generation for a specific future local date
- **THEN** the generation request includes that planning date so the server can evaluate recent history and upcoming events relative to the intended workout day

#### Scenario: Planned-slot generation includes slot intent

- **WHEN** the client requests workout generation from a blueprint-owned planned slot
- **THEN** the generation request includes the slot role, target duration, equipment/location assumptions, and planning date so the server can plan the concrete workout for that slot

#### Scenario: Regeneration request includes explicit baseline workout data

- **WHEN** the client requests regeneration of an existing workout
- **THEN** it can submit baseline workout context alongside current constraints so the server can support stateless regeneration paths

#### Scenario: Full context remains available during regeneration

- **WHEN** the client requests regeneration
- **THEN** the request may include merged context instead of relying solely on prior-response continuity
