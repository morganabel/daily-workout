## ADDED Requirements

### Requirement: Home Adaptive Plan State
Home data MUST expose the active adaptive plan state when available, including target range progress, recent relevant exposures, upcoming schedule constraints, projected or pinned sessions for the active date, and the current recommendation.

#### Scenario: Home loads recommendation from plan state
- **WHEN** a user with an adaptive plan opens Home
- **THEN** Home data includes the recommended primary block, optional add-on blocks, rationale, and alternatives for the active planning date

#### Scenario: Home falls back without adaptive plan
- **WHEN** a user has no adaptive plan
- **THEN** Home shows the one-off Today setup flow without hydrating starter planned-slot metadata

### Requirement: Home Generation Uses Adaptive Recommendation
When a user generates from an adaptive recommendation, Home MUST build a generation request containing structured adaptive plan intent derived from the recommendation.

#### Scenario: Generate from combined recommendation
- **WHEN** Home recommends Pull plus Easy Cardio and the user taps Generate
- **THEN** the generation request includes the primary Pull block and Easy Cardio add-on intent

#### Scenario: User override beats recommendation
- **WHEN** the user explicitly changes the focus before generation
- **THEN** Home sends the explicit focus while retaining adaptive plan context only as background context where applicable

## MODIFIED Requirements

### Requirement: Planning-Date And Baseline-Aware Generation Requests

The workout generation flow MUST accept the operational request inputs needed by the planning layer, including an optional planning date, explicit regeneration baseline workout context, and optional adaptive plan intent. Regeneration and adaptive-plan requests MUST be able to include full merged context rather than assuming provider-side memory.

#### Scenario: Scheduled generation can plan for a future day

- **WHEN** the client requests workout generation for a specific future local date
- **THEN** the generation request includes that planning date so the server can evaluate recent history and upcoming events relative to the intended workout day

#### Scenario: Adaptive recommendation generation includes block intent

- **WHEN** the client requests workout generation from an adaptive plan recommendation
- **THEN** the generation request includes the primary block, optional add-ons, target range context, rationale, and planning date so the server can plan the concrete workout for that recommendation

#### Scenario: Regeneration request includes explicit baseline workout data

- **WHEN** the client requests regeneration of an existing workout
- **THEN** it can submit baseline workout context alongside current constraints so the server can support stateless regeneration paths

#### Scenario: Full context remains available during regeneration

- **WHEN** the client requests regeneration
- **THEN** the request may include merged context instead of relying solely on prior-response continuity
