## ADDED Requirements

### Requirement: Selective LLM-Assisted Planning Activation

The generation planner MUST support an LLM-assisted stage-1 planning path that runs only for ambiguous or high-risk requests. The server MUST decide whether stage 1 runs before final workout generation using request and context signals such as Smart focus, conflicting recent-session or event context, regeneration feedback, or dense free-form instructions.

#### Scenario: Smart focus activates stage 1

- **WHEN** a generation request uses Smart or auto focus
- **THEN** the planner runs the stage-1 planning path before final workout generation

#### Scenario: Explicit low-ambiguity request skips stage 1

- **WHEN** a generation request has explicit focus, simple constraints, no conflicting recency or event context, and no regeneration feedback
- **THEN** the planner skips stage 1 and uses the current deterministic planning path only

## MODIFIED Requirements

### Requirement: Server-Side Planning Brief

Before invoking workout generation, the system MUST derive a deterministic planning brief from the generation request, merged user context, optional planning date, and optional regeneration baseline workout. When the request qualifies for staged planning, the system MUST also derive a structured stage-1 planner artifact before the final provider generation flow. The deterministic planning brief and any stage-1 planner artifact together MUST be the authoritative internal representation of generation intent for provider prompting.

The planning artifacts MUST distinguish hard constraints, soft bias, unknown values, regeneration mode, provider-aware execution mode, and whether staged planning was used.

#### Scenario: Deterministic brief is always derived first

- **WHEN** a valid generation request is accepted
- **THEN** the server derives the deterministic planning brief before deciding whether to invoke the stage-1 planner

#### Scenario: Stage-1 planner returns structured advisory guidance

- **WHEN** the request qualifies for staged planning
- **THEN** the server records a structured stage-1 planner artifact containing advisory intent-resolution data such as confidence, recovery priorities, novelty guidance, or rerank hints before final workout generation

#### Scenario: Missing values remain unknown instead of being invented

- **WHEN** request or context fields such as injuries, preferences, or recent history are absent
- **THEN** the planning artifacts record them as unknown or absent rather than inferring new facts

#### Scenario: Provider receives structured planning inputs

- **WHEN** a provider request is built from the generation flow
- **THEN** the prompt inputs include the deterministic planning brief and any stage-1 planner artifact alongside bounded exercise candidates rather than relying only on unconstrained workout prose

### Requirement: Exercise-Library-Backed Candidate Pools

The planning layer MUST query the exercise library to derive bounded candidate pools that respect hard filters and may apply soft bias for style, goal, or load intent. When staged planning runs, the stage-1 planner artifact MAY influence retrieval ordering or reranking inside the bounded candidate set, but it MUST NOT broaden the hard-filtered set beyond deterministic planner-owned constraints.

#### Scenario: Candidate pool honors hard environment and safety constraints

- **WHEN** a planning brief requires quiet, low-impact, bodyweight-only, or contraindication-aware selection
- **THEN** the derived candidate pool contains only exercises that satisfy those hard constraints whether or not stage 1 ran

#### Scenario: Stage-1 planner can rerank without relaxing filters

- **WHEN** the stage-1 planner artifact suggests a style, novelty, or session-identity bias
- **THEN** the planner may reorder or rerank the bounded candidate pool while preserving the deterministic hard-filtered exercise set

#### Scenario: Candidate pool can bias toward session identity

- **WHEN** a planning brief or stage-1 planner artifact expresses a style identity such as bodybuilding, powerlifting, strongman, or climbing
- **THEN** the candidate-pool query can prefer matching exercises without violating hard constraints

### Requirement: Provider-Aware Regeneration Planning

The planning layer MUST support both stateful and stateless regeneration. Stateful regeneration MAY use provider-side continuity only when the prior response provenance matches a provider path that supports it. Stateless regeneration MUST use explicit baseline workout context, current merged context, and a fresh candidate pool. When staged planning runs for regeneration, the planner artifact MUST include explicit rewrite or novelty guidance derived from the user's feedback.

#### Scenario: OpenAI regeneration can continue from valid prior provenance

- **WHEN** the current provider supports prior-response continuity and the baseline workout provenance matches that provider
- **THEN** the planning flow may use stateful regeneration while still applying the current planning brief, stage-1 guidance if present, and deterministic constraints

#### Scenario: Stateless regeneration uses baseline workout context

- **WHEN** the provider does not support prior-response continuity or the prior provenance does not match the active provider
- **THEN** regeneration is planned from the explicit baseline workout, current constraints, and a new candidate pool instead of assuming provider memory

#### Scenario: Regeneration includes novelty guidance

- **WHEN** a regeneration request includes feedback such as `different-exercises`, `just-try-again`, `too-hard`, or `too-easy`
- **THEN** the stage-1 planner artifact records explicit rewrite or novelty guidance for the final workout-generation call

#### Scenario: Regeneration excludes baseline exercises when alternatives exist

- **WHEN** the user regenerates a workout or part of a workout and the planner can find eligible alternatives
- **THEN** the planning flow excludes the relevant baseline exercise IDs from the candidate set while preserving the original session intent and constraints

### Requirement: Internal Planning Diagnostics

The system MUST record planning diagnostics internally for evaluation and debugging, including at least the resolved planning mode, whether staged planning ran, major stage-1 outputs, and whether regeneration used a stateful or stateless path. These diagnostics MUST NOT be required in the public workout response.

#### Scenario: Planning diagnostics stay internal

- **WHEN** generation completes using either the single-pass or staged planner path
- **THEN** planning diagnostics are available to internal storage or evaluation flows without changing the canonical public workout response shape

#### Scenario: Evaluation can distinguish staged and non-staged runs

- **WHEN** the evaluation workflow captures a generation run
- **THEN** it can distinguish whether stage 1 ran and inspect the internal planner metadata needed to compare staged planning against the single-pass path
