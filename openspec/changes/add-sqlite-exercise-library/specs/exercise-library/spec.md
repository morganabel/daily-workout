## ADDED Requirements

### Requirement: Embedded SQLite Exercise Library

The system MUST package a local SQLite exercise library that is available to the server runtime in both CE and hosted deployments without requiring a remote exercise service. The library SHALL be treated as a read-only product asset at runtime.

#### Scenario: Server can open the packaged library locally

- **WHEN** the server-side exercise-library module initializes in a valid deployment
- **THEN** it opens the packaged SQLite database from local runtime storage without requiring network access

#### Scenario: CE and hosted use the same local library behavior

- **WHEN** the exercise library is used in CE or hosted mode
- **THEN** candidate queries run against the same embedded SQLite data model and do not depend on a hosted-only exercise backend

### Requirement: Stable Exercise Identity And Normalized Metadata

Each exercise MUST have a stable ID and normalized metadata that supports deterministic filtering for generation and evaluation. Filter-critical metadata MUST be stored in normal columns or normalized relations, not only in free text.

At minimum, the library MUST support metadata for equipment requirements, movement/style tags, contraindication or avoid tags, impact level, noise level, space footprint, travel friendliness, floor requirement, and coarse load or soreness heuristics.

#### Scenario: Filter-critical metadata is queryable without parsing prose

- **WHEN** the query layer filters for a constraint such as bodyweight-only, low-impact, quiet, or travel-friendly
- **THEN** it uses normalized fields or relations rather than relying on free-text exercise descriptions

#### Scenario: Exercise identity remains stable across seed updates

- **WHEN** the library is rebuilt with updated seed content that still includes an existing exercise
- **THEN** that exercise keeps the same stable ID so downstream references and tests remain valid

### Requirement: Deterministic Eligibility Query Surface

The system MUST expose a read-only query surface for eligible exercise selection that distinguishes hard filters from soft bias. Hard filters MUST never be relaxed silently by the query layer.

The query surface MUST support, at minimum, exercise lookup by ID and eligible-pool queries constrained by equipment, contraindications, avoid tags, environment limits, experience level, and coarse load or style preferences.

#### Scenario: Hard constraints exclude ineligible exercises

- **WHEN** a caller requests eligible exercises with hard filters for available equipment, injury-related exclusions, and low-impact quiet conditions
- **THEN** the result contains only exercises that satisfy all of those hard filters

#### Scenario: Empty result is explicit when hard filters are too strict

- **WHEN** no exercises satisfy the supplied hard filters
- **THEN** the query layer returns an explicit empty result instead of broadening into disallowed exercises

#### Scenario: Stable ordering makes query results reproducible

- **WHEN** the same eligible-exercise query runs repeatedly against the same library version
- **THEN** it returns exercises in a deterministic order so planning and tests can reproduce candidate pools

### Requirement: Library Validation And Versioning

The exercise library build and validation workflow MUST verify schema integrity, required metadata presence, and representative query behavior before the library is treated as ready for server-side planning.

#### Scenario: Invalid seed data fails validation

- **WHEN** the seed or packaged SQLite library contains missing required metadata, duplicate IDs, or broken relations
- **THEN** validation fails before the library is promoted for runtime use

#### Scenario: Representative query smoke tests pass before use

- **WHEN** validation runs for the packaged library
- **THEN** it verifies representative queries for constraint-heavy categories such as quiet/apartment, travel, injury-sensitive, and style-specific pools
