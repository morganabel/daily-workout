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

### Requirement: Catalog-Aware Planning Route

Before invoking a workout-generation provider, the planning layer MUST be able to evaluate a server-side workout catalog against the request, merged context, planning brief, adaptive plan intent, recent sessions, and upcoming events.

#### Scenario: Catalog matching runs before provider invocation

- **WHEN** generation handles a valid auto-mode request and the workout catalog is available
- **THEN** the server evaluates catalog fit before invoking a model provider

#### Scenario: Catalog matching honors planning constraints

- **WHEN** catalog matching evaluates recipes
- **THEN** it applies the same hard equipment, injury, avoid-list, experience, environment, and event-protection constraints used by generation planning

### Requirement: Direct Catalog Acceptance

The planning layer MUST accept an excellent catalog match directly when catalog fit is high and AI is not needed to interpret or adapt the request.

#### Scenario: Excellent catalog match skips provider

- **WHEN** catalog matching returns a direct decision for an auto-mode request
- **THEN** the server materializes and returns the catalog workout without invoking the provider or recording AI usage

#### Scenario: Library mode direct match

- **WHEN** explicit library mode receives a direct catalog decision
- **THEN** the server returns the catalog workout and does not evaluate AI quota or provider configuration

### Requirement: Ambiguous Catalog Adaptation

When catalog fit is plausible but ambiguous and AI use is allowed, the planner MUST be able to pass the selected catalog recipe as an anchor into stage-one planning and final provider generation.

#### Scenario: Ambiguous match enters planner

- **WHEN** catalog matching returns an adapt decision for an auto-mode request with AI allowed
- **THEN** the selected catalog recipe is available to the planner as structured context before final generation

#### Scenario: Adapted catalog remains within hard constraints

- **WHEN** AI adapts a catalog recipe
- **THEN** deterministic hard constraints remain authoritative and the provider must not broaden beyond disallowed equipment, injuries, avoid tags, or event-protected stressors

### Requirement: Weak Catalog Fit Falls Through To AI

When catalog fit is weak and AI use is allowed, the planning layer MUST preserve the current AI generation path.

#### Scenario: No catalog match uses current AI path

- **WHEN** an auto-mode request has no viable catalog match
- **THEN** the server proceeds with deterministic planning, candidate-pool construction, and provider generation as it does today

#### Scenario: AI-disabled no match does not call provider

- **WHEN** a library-mode request has no viable catalog match
- **THEN** the server returns a structured catalog no-match error and does not call a provider

### Requirement: Catalog Planning Diagnostics

The system MUST record catalog-routing diagnostics internally for evaluation and debugging, including whether catalog matching ran, the match decision, selected catalog recipe identity when applicable, and whether a provider was invoked.

#### Scenario: Catalog diagnostics stay internal

- **WHEN** catalog-aware generation completes
- **THEN** catalog decision metadata is available to internal diagnostics or evaluation without being required in the public `TodayPlan` response
