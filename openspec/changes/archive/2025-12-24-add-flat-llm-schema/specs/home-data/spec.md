## ADDED Requirements
### Requirement: Flattened LLM Workout Schema
The generation pipeline MUST support a flattened LLM workout schema with a maximum nesting depth of 3. The flattened schema SHALL represent blocks without nested exercises and SHALL represent exercises as a top-level list keyed by `blockIndex` with explicit `order`. The transformer MUST rebuild the canonical `TodayPlan` blocks and exercises in stable order without altering client-visible fields. The flattened schema MUST include required fields for: `focus`, `durationMinutes`, `equipment`, `source`, `energy`, `summary`, `blocks[]`, and `exercises[]`. Each block SHALL include `title`, `durationMinutes`, and `focus`. Each exercise SHALL include `blockIndex`, `order`, `name`, `prescription`, and `detail` (nullable).

#### Scenario: Flat schema rebuilds ordered exercises
- **GIVEN** an LLM payload with `blocks` and a top-level `exercises` list that includes `blockIndex` and `order`
- **WHEN** the transformer processes the payload
- **THEN** each `TodayPlan.block` contains its exercises sorted by `order` and no exercises are dropped or reordered

#### Scenario: Depth stays within limit
- **GIVEN** the provider requires a low-depth structured output schema
- **WHEN** the generation request is configured for the flattened schema
- **THEN** the schema depth does not exceed 3 levels while still representing the full workout

#### Scenario: Invalid block mapping fails transformation
- **GIVEN** an LLM payload where an exercise references a `blockIndex` outside `[0, blocks.length)`
- **WHEN** the transformer processes the payload
- **THEN** the transformation fails and is treated as an invalid provider response (no best-effort dropping)

#### Scenario: Missing blocks fails transformation
- **GIVEN** an LLM payload with no `blocks` or an empty `blocks` list
- **WHEN** the transformer processes the payload
- **THEN** the transformation fails and is treated as an invalid provider response

#### Scenario: Duplicate order per block fails transformation
- **GIVEN** an LLM payload where two exercises share the same `order` for the same `blockIndex`
- **WHEN** the transformer processes the payload
- **THEN** the transformation fails and is treated as an invalid provider response

### Requirement: Flattened Schema Invariants
For the flattened schema, `blockIndex` MUST be 0-based and within `[0, blocks.length)`. `order` MUST be 0-based and unique per `blockIndex`. These invariants MUST be enforced during transformation.

#### Scenario: Enforced ordering invariants
- **GIVEN** a flat payload with valid `blockIndex` and unique `order` values
- **WHEN** the transformer processes the payload
- **THEN** it emits a canonical `TodayPlan` with exercises in deterministic order

### Requirement: Schema Depth Definition
Schema depth SHALL be measured as the maximum nesting of objects/arrays along any path, counting each object or array as +1 from the root object. The flattened schema MUST remain at depth <= 3 by this definition.

#### Scenario: Depth calculation is enforceable
- **GIVEN** the flattened JSON schema definition
- **WHEN** depth is computed for the schema
- **THEN** the maximum depth is <= 3

### Requirement: Token-Efficient Schema Selection
When multiple LLM schemas are supported, the generation pipeline SHALL prefer the most token-efficient schema available for the active provider (estimated JSON size, defaulting to the flattened schema) and MUST record the selected schema version in internal generation metadata.

#### Scenario: Provider uses flattened schema by default
- **GIVEN** a provider that supports structured output for the flattened schema
- **WHEN** a generation request runs without an explicit override
- **THEN** the system selects the flattened schema, records its version, and returns the same canonical `TodayPlan` to the client

#### Scenario: Explicit schema override wins
- **GIVEN** an operator-configured override for the LLM schema version
- **WHEN** a generation request runs
- **THEN** the system selects the overridden schema version regardless of size estimates

### Requirement: Schema Selection Algorithm
The selection algorithm MUST be deterministic and configurable. It SHALL: (1) apply explicit overrides first, (2) fall back to provider-supported schemas when only one is available, (3) otherwise choose the smallest estimated JSON size with ties resolved in favor of the flattened schema, and (4) record the selected schema version in generation metadata.

#### Scenario: Tie breaks to flattened schema
- **GIVEN** two supported schemas with equal estimated size
- **WHEN** a generation request runs without an override
- **THEN** the flattened schema is selected

### Requirement: Fallback Semantics
Fallback behavior MUST be selection-time only. If a chosen schema fails validation or transformation, the generation request SHALL fail under the existing provider error rules and SHALL NOT automatically retry with another schema during the same request.

#### Scenario: No runtime retry on transform failure
- **GIVEN** a generation request using the flattened schema
- **WHEN** the transformation fails
- **THEN** the request fails with the existing provider error handling and does not re-invoke the provider with a different schema

### Requirement: Schema Versioning & Metadata
The generation pipeline MUST record the LLM output schema version used for parsing/transformation (e.g., `v1-current` or `v2-flat`) in internal generation metadata. The choice of schema version MUST NOT change any non-ID fields in the canonical `TodayPlan`.

#### Scenario: Metadata reflects LLM output schema
- **GIVEN** a generation request processed with the flattened schema
- **WHEN** the plan is persisted and returned
- **THEN** internal metadata records the flattened schema version and the client-visible fields match the canonical format

### Requirement: Enum Expansion Mapping
The transformer MUST support expanding compact enum values from the LLM payload into canonical complex objects or arrays required by the API response.

#### Scenario: Enum value expands into canonical structure
- **GIVEN** the LLM returns a compact enum value for a field that maps to a richer structure
- **WHEN** the transformer processes the payload
- **THEN** the resulting `TodayPlan` includes the expanded object/array as defined by server mapping rules

#### Scenario: Unknown enum value fails transformation
- **GIVEN** the LLM returns an enum value that is not mapped in the server ruleset
- **WHEN** the transformer processes the payload
- **THEN** the transformation fails and is treated as an invalid provider response
