## ADDED Requirements

### Requirement: Exercise-Library-Backed Candidate Pool Inputs

The workout generation flow MUST be able to derive server-side candidate pools from the exercise library using generation request inputs, merged user context, and internal planning constraints while preserving the existing `TodayPlan` response contract.

Candidate-pool selection metadata and diagnostics SHALL remain internal to the server-side planning flow and MUST NOT be required in the public generation response.

#### Scenario: Generation derives a bounded candidate pool from context

- **WHEN** the server prepares a generation request with equipment, injury or avoid constraints, and environment limits such as quiet or low-impact
- **THEN** it can query the exercise library to produce a bounded eligible candidate pool before invoking model generation

#### Scenario: Public workout response stays stable

- **WHEN** generation uses an exercise-library-backed candidate pool internally
- **THEN** the user-facing generation response still returns the canonical `TodayPlan` contract rather than exposing candidate-pool internals

#### Scenario: Regeneration can reuse the same exercise-library filtering path

- **WHEN** the server prepares a regeneration request for a provider without prior-response memory
- **THEN** it can derive a fresh bounded candidate pool from the exercise library using the current constraints and baseline workout context
