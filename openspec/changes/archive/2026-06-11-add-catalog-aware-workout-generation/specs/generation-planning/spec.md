## ADDED Requirements

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
