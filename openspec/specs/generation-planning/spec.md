# generation-planning Specification

## Purpose

Define the internal planning layer that resolves generation intent before provider prompting while keeping the public `TodayPlan` contract stable.
## Requirements
### Requirement: Server-Side Planning Brief

Before invoking workout generation, the system MUST derive a deterministic planning brief from the generation request, merged user context, optional planning date, optional adaptive plan intent, and optional regeneration baseline workout. The planning brief MUST be the authoritative internal representation of generation intent for provider prompting.

The planning brief MUST distinguish hard constraints, soft bias, unknown values, adaptive-plan source, regeneration mode, and provider-aware execution mode.

#### Scenario: Planning brief is derived before generation

- **WHEN** a valid generation request is accepted
- **THEN** the server derives a planning brief before invoking the provider generation flow

#### Scenario: Missing values remain unknown instead of being invented

- **WHEN** request or context fields such as injuries, preferences, or recent history are absent
- **THEN** the planning brief records them as unknown or absent rather than inferring new facts

#### Scenario: Provider receives structured planning inputs

- **WHEN** a provider request is built from the generation flow
- **THEN** the prompt inputs include the planning brief's block intents and bounded exercise candidates rather than relying only on unconstrained workout prose

#### Scenario: Adaptive-plan source remains internal

- **WHEN** a workout is generated from an adaptive training plan recommendation
- **THEN** adaptive-plan source metadata is available to internal planning and diagnostics without changing the public `TodayPlan` response contract

### Requirement: Deterministic Smart Focus Resolution

When the user requests `Smart` or auto focus, the planning layer MUST resolve a recommended session intent before model generation. That resolution MUST account for recent training summaries, upcoming event protection, energy, style or goal bias, environment constraints, and any adaptive plan intent supplied by Home.

The Smart-resolution step MUST produce at least a recommended focus or session identity, disallowed or de-prioritized stressors, and a coarse load ceiling suitable for downstream candidate-pool selection and prompting.

Adaptive plan intent MUST be treated as explicit structured coaching intent for that workout request, while still allowing safety constraints, user overrides, and nearby life events to modify load, exercise selection, or recovery emphasis.

#### Scenario: Smart focus protects a near-term event

- **WHEN** a user requests Smart focus and a demanding run or sport event is scheduled soon
- **THEN** the planning brief de-prioritizes stressors that would meaningfully reduce freshness for that event

#### Scenario: Smart focus shifts away from repeated recent overload

- **WHEN** recent session summaries indicate repeated emphasis on a movement pattern or body region
- **THEN** the planning brief biases away from repeating that same stress pattern unless the request explicitly overrides it

#### Scenario: Adaptive plan provides workout intent

- **WHEN** a generation request includes adaptive plan intent for a primary block and optional add-ons
- **THEN** the planning brief resolves the session intent from that adaptive plan recommendation before final workout generation

#### Scenario: Adaptive plan still honors safety constraints

- **WHEN** adaptive plan intent conflicts with injuries, avoid-list, equipment, or near-term event protection
- **THEN** the planning brief adjusts load or exercise selection rather than blindly following the block label

### Requirement: Exercise-Library-Backed Candidate Pools

The planning layer MUST query the exercise library to derive bounded candidate pools that respect hard filters and may apply soft bias for style, goal, or load intent. The candidate-pool path MUST use the deterministic hard-filter semantics defined by the exercise-library capability.

#### Scenario: Candidate pool honors hard environment and safety constraints

- **WHEN** a planning brief requires quiet, low-impact, bodyweight-only, or contraindication-aware selection
- **THEN** the derived candidate pool contains only exercises that satisfy those hard constraints

#### Scenario: Candidate pool can bias toward session identity

- **WHEN** a planning brief expresses a style identity such as bodybuilding, powerlifting, strongman, or climbing
- **THEN** the candidate-pool query can prefer matching exercises without violating hard constraints

### Requirement: Provider-Aware Regeneration Planning

The planning layer MUST support both stateful and stateless regeneration. Stateful regeneration MAY use provider-side continuity only when the prior response provenance matches a provider path that supports it. Stateless regeneration MUST use explicit baseline workout context, current merged context, and a fresh candidate pool.

#### Scenario: OpenAI regeneration can continue from valid prior provenance

- **WHEN** the current provider supports prior-response continuity and the baseline workout provenance matches that provider
- **THEN** the planning flow may use stateful regeneration while still applying the current planning brief and constraints

#### Scenario: Stateless regeneration uses baseline workout context

- **WHEN** the provider does not support prior-response continuity or the prior provenance does not match the active provider
- **THEN** regeneration is planned from the explicit baseline workout, current constraints, and a new candidate pool instead of assuming provider memory

#### Scenario: Regeneration excludes baseline exercises when alternatives exist

- **WHEN** the user regenerates a workout or part of a workout and the planner can find eligible alternatives
- **THEN** the planning brief excludes the relevant baseline exercise IDs from the candidate set while preserving the original session intent and constraints

### Requirement: Planning Fallback Is Explicit

The system MUST treat planning degradation as an explicit server-side decision. If the exercise library cannot satisfy the requested hard constraints using planner-safe candidates, the planner MUST record a fallback reason and fallback mode instead of silently relaxing hard constraints inside the query layer.

#### Scenario: Empty candidate pool records explicit planner fallback

- **WHEN** a planner-backed candidate query returns no eligible `planner-ready` candidates for the requested hard constraints
- **THEN** the planner records a structured fallback reason for that query before deciding whether to proceed in a degraded mode or fail the generation request

#### Scenario: Planner fallback remains internal

- **WHEN** generation proceeds using a degraded fallback mode
- **THEN** the fallback metadata remains internal to the server/runtime path and does not alter the public `TodayPlan` schema

### Requirement: Internal Planning Diagnostics

The system MUST record planning diagnostics internally for evaluation and debugging, including at least the resolved planning mode, Smart-resolution outputs, and whether regeneration used a stateful or stateless path. These diagnostics MUST NOT be required in the public workout response.

#### Scenario: Planning diagnostics stay internal

- **WHEN** generation completes using the planning layer
- **THEN** planning diagnostics are available to internal storage or evaluation flows without changing the canonical public workout response shape

### Requirement: Adaptive Plan Intent
Generation planning MUST accept optional adaptive plan intent in addition to existing request fields. Adaptive plan intent MUST support plan id, recommendation id, source template id, primary block intent, optional add-on block intents, target range context, recommendation rationale, and projection status when available.

#### Scenario: Planning brief records adaptive source
- **WHEN** a generation request includes adaptive plan intent
- **THEN** the planning brief records adaptive-plan source metadata internally without changing the public `TodayPlan` response contract

#### Scenario: Combined blocks shape generation
- **WHEN** adaptive plan intent includes Pull as the primary block and Easy Cardio as an add-on
- **THEN** provider prompt inputs include both block intents so the generated workout can include appropriate strength and cardio work within the requested duration

### Requirement: Adaptive Intent Honors Safety And Explicit Overrides
The planning layer MUST treat adaptive plan intent as structured coaching intent while still honoring explicit user focus, injuries, avoid lists, equipment constraints, energy, recent fatigue, and upcoming event protection.

#### Scenario: Upcoming event can override recommended stressor
- **WHEN** adaptive plan intent recommends Legs but an upcoming event requires lower-body freshness
- **THEN** the planning brief adjusts load or focus rather than blindly following the recommendation

#### Scenario: Explicit focus remains stronger
- **WHEN** the user explicitly selects Mobility before generation while adaptive context recommends Pull
- **THEN** the planning brief resolves Mobility as the requested focus and treats adaptive context as background only where safe

