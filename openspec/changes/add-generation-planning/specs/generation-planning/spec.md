## ADDED Requirements

### Requirement: Server-Side Generation Planning Brief

The system MUST derive an internal server-side planning brief before invoking a workout-generation provider. The planning brief MUST normalize generation inputs, merged user context, and exercise-library query results into a structured session plan that the provider can follow while the public `TodayPlan` response contract remains unchanged.

#### Scenario: Initial generation derives a planning brief before provider invocation

- **WHEN** the server receives a workout generation request
- **THEN** it derives an internal planning brief that captures normalized session intent, constraints, and planner-facing exercise candidates before calling the selected provider

#### Scenario: Provider receives structured planning inputs

- **WHEN** a provider request is built from the generation flow
- **THEN** the prompt inputs include the planning brief's block intents and bounded exercise candidates rather than relying only on unconstrained workout prose

#### Scenario: Public response contract stays unchanged

- **WHEN** generation succeeds using the internal planning brief
- **THEN** the user-facing response still returns the canonical `TodayPlan` payload without exposing planning metadata or planner diagnostics

### Requirement: Regeneration Reuses Planning Intent

The system MUST use the same generation-planning path for regeneration flows, including stateless provider flows that require a fresh prompt. Regeneration planning MUST preserve the baseline workout intent while excluding previously used exercises when variation is requested and eligible alternatives exist.

#### Scenario: Regeneration excludes baseline exercises when alternatives exist

- **WHEN** the user regenerates a workout or part of a workout and the planner can find eligible alternatives
- **THEN** the planning brief excludes the relevant baseline exercise IDs from the candidate set while preserving the original session intent and constraints

#### Scenario: Stateless providers receive a fresh planning brief for regeneration

- **WHEN** regeneration runs against a provider that does not retain prior response memory
- **THEN** the server derives a fresh planning brief from the current request, baseline workout context, and variation rules before invoking the provider again

### Requirement: Planning Fallback Is Explicit

The system MUST treat planning degradation as an explicit server-side decision. If the exercise library cannot satisfy one or more requested block intents using planner-safe candidates, the planner MUST record a fallback reason and fallback mode instead of silently relaxing hard constraints inside the query layer.

#### Scenario: Empty candidate pool records explicit planner fallback

- **WHEN** a block-level planning query returns no eligible `planner-ready` candidates for the requested hard constraints
- **THEN** the planner records a structured fallback reason for that block before deciding whether to proceed in a degraded mode or fail the generation request

#### Scenario: Planner fallback remains internal

- **WHEN** generation proceeds using a degraded fallback mode
- **THEN** the fallback metadata remains internal to the server/runtime path and does not alter the public `TodayPlan` schema
