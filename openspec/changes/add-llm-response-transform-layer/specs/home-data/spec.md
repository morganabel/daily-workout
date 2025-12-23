## ADDED Requirements
### Requirement: LLM Response Transformation Layer
The workout generation pipeline MUST normalize LLM responses into the canonical API workout schema so client contracts stay stable even when prompt schemas change or are simplified for cost/performance.

#### Scenario: Canonical response preserved
- **GIVEN** the transformer receives a simplified LLM plan output (e.g., missing derived IDs or secondary metadata)
- **WHEN** it processes the payload
- **THEN** it emits a fully populated `TodayPlan` matching the existing API fields and persists/returns that normalized plan to the client

#### Scenario: Identity path for current schema
- **GIVEN** the LLM still returns the current `TodayPlan` schema
- **WHEN** the transformer runs
- **THEN** it validates and passes the payload through without altering its semantic content so responses remain structurally equivalent to today’s format (same fields and values, regardless of whitespace or key ordering)

#### Scenario: Versioned schema selection
- **GIVEN** the server configures an `llmSchemaVersion` (or feature flag) for generation
- **WHEN** a generation request executes
- **THEN** the transformer selects the matching parser/mapping rules, records the configured `llmSchemaVersion` in internal generation metadata (for observability and persistence alongside the plan), and keeps the API response shape constant

#### Scenario: Transformation failure handling
- **GIVEN** the LLM output cannot be mapped or validated (e.g., missing required block structure)
- **WHEN** the transformer detects the failure
- **THEN** it treats the request as a provider failure: logs the mapping error, sets `generationStatus` to `error`, and triggers the existing deterministic/mock fallback rules (respecting hosted BYOK enforcement)
