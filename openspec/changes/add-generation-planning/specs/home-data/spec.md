## ADDED Requirements

### Requirement: Planned Generation Execution

The workout generation flow MUST execute an internal planning step before provider invocation. That planning step MUST derive the structured planning inputs used for model prompting while keeping the public generation API and `TodayPlan` response contract unchanged.

#### Scenario: Generation endpoint plans before calling the provider

- **WHEN** the server begins processing a valid generation request
- **THEN** it derives internal planning inputs from request data, merged context, and exercise-library results before invoking the selected provider

#### Scenario: Planning metadata stays server-side

- **WHEN** the generation flow computes planning metadata such as fallback reason, candidate diagnostics, or library version
- **THEN** that metadata remains internal to the server/runtime flow and is not required in the public generation response body

### Requirement: Regeneration Uses Shared Planning Logic

Regeneration flows MUST reuse the same internal planning path as initial generation so that stateless providers, variation requests, and baseline exercise exclusions behave consistently.

#### Scenario: Regeneration reuses the planner for stateless providers

- **WHEN** a regeneration request targets a provider that needs a fresh prompt
- **THEN** the server derives a new internal planning brief from the current request plus baseline workout context instead of relying on provider memory

#### Scenario: Variation exclusions come from planning rather than prompt-only hints

- **WHEN** regeneration asks for a different exercise selection where eligible alternatives exist
- **THEN** the planner excludes the prior exercise IDs from the bounded candidate set before building the provider request
