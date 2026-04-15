# exercise-library Specification

## Purpose

Define the server-side embedded exercise library used for deterministic workout-generation candidate selection and future planning flows.

## Requirements

### Requirement: Embedded SQLite Exercise Library

The system MUST package a local SQLite exercise library that is available to the server runtime in both CE and hosted deployments without requiring a remote exercise service. The library SHALL be treated as a read-only product asset at runtime.

The library implementation MUST live in a dedicated monorepo package at `packages/server-exercise-library`.

#### Scenario: Server can open the packaged library locally

- **WHEN** the server-side exercise-library module initializes in a valid deployment
- **THEN** it opens the packaged SQLite database from local runtime storage without requiring network access

#### Scenario: CE and hosted use the same local library behavior

- **WHEN** the exercise library is used in CE or hosted mode
- **THEN** candidate queries run against the same embedded SQLite data model and do not depend on a hosted-only exercise backend

### Requirement: Stable Exercise Identity And Normalized Metadata

Each exercise MUST have a stable ID and normalized metadata that supports deterministic filtering for generation and evaluation. Filter-critical metadata MUST be stored in normal columns or normalized relations, not only in free text.

At minimum, the library MUST support metadata for equipment requirements, movement/style tags, contraindication or avoid tags, impact level, noise level, space footprint, travel friendliness, floor requirement, coarse load or soreness heuristics, and an ordered `metadataCompleteness` field with the states `raw`, `derived`, `curated`, and `planner-ready`.

#### Scenario: Filter-critical metadata is queryable without parsing prose

- **WHEN** the query layer filters for a constraint such as bodyweight-only, low-impact, quiet, or travel-friendly
- **THEN** it uses normalized fields or relations rather than relying on free-text exercise descriptions

#### Scenario: Exercise identity remains stable across seed updates

- **WHEN** the library is rebuilt with updated seed content that still includes an existing exercise
- **THEN** that exercise keeps the same stable ID so downstream references and tests remain valid

#### Scenario: Production-safe maturity is explicit per exercise

- **WHEN** an exercise record is present in the built library
- **THEN** it carries a `metadataCompleteness` value that indicates whether it is only imported, deterministically enriched, manually curated, or safe for planner-backed production queries

### Requirement: Reproducible Source Inputs And Generated Outputs

The exercise library package MUST commit only the source inputs needed to reproduce the built library, rather than committing generated merged output files as the source of truth.

At minimum, the committed inputs MUST include a reduced single-file snapshot of the pinned upstream exercise source that keeps needed text and structural fields while excluding images, source provenance metadata, and the local vocabularies or curation inputs needed to build the final library.

#### Scenario: Normal build does not require network access

- **WHEN** the exercise library build runs in CI or local development
- **THEN** it produces the merged canonical dataset and packaged SQLite library from committed inputs without fetching remote source data

#### Scenario: Generated artifacts are recreated from committed inputs

- **WHEN** the merged canonical dataset or SQLite database is deleted locally
- **THEN** the build workflow can recreate them from the committed source snapshot, vocabularies, and curation inputs

### Requirement: Deterministic Eligibility Query Surface

The system MUST expose a read-only query surface for eligible exercise selection that distinguishes hard filters from soft bias. Hard filters MUST never be relaxed silently by the query layer.

The query surface MUST support, at minimum, exercise lookup by ID and eligible-pool queries constrained by equipment, contraindications, avoid tags, environment limits, experience level, and coarse load or style preferences.

Eligible-pool queries MUST default to returning only exercises whose `metadataCompleteness` is `planner-ready`, unless a caller is explicitly using an internal/debug path that requests lower-completeness records.

When a caller provides optional search text, the query surface MUST apply full-text ranking only within the already eligible set, using deterministic ordering rules after hard filtering.

#### Scenario: Hard constraints exclude ineligible exercises

- **WHEN** a caller requests eligible exercises with hard filters for available equipment, injury-related exclusions, and low-impact quiet conditions
- **THEN** the result contains only exercises that satisfy all of those hard filters

#### Scenario: Empty result is explicit when hard filters are too strict

- **WHEN** no exercises satisfy the supplied hard filters
- **THEN** the query layer returns an explicit empty result instead of broadening into disallowed exercises

#### Scenario: Stable ordering makes query results reproducible

- **WHEN** the same eligible-exercise query runs repeatedly against the same library version
- **THEN** it returns exercises in a deterministic order so planning and tests can reproduce candidate pools

#### Scenario: Planner queries exclude lower-completeness records by default

- **WHEN** a production candidate-pool query runs against a library that contains `raw`, `derived`, `curated`, and `planner-ready` records
- **THEN** only `planner-ready` exercises are eligible unless the caller explicitly opts into a lower completeness threshold for internal use

#### Scenario: BM25 ranks text-relevant exercises within a hard-filtered pool

- **WHEN** a candidate query includes search text alongside hard filters such as equipment and environment constraints
- **THEN** the library returns only exercises that satisfy the hard filters, with BM25/FTS ranking used only to order the eligible set by text relevance

### Requirement: Planner-Facing Candidate Queries

The exercise library query surface MUST support planner-facing candidate selection for workout planning. Planner-facing queries MUST be able to apply planning constraints, bounded result limits, and baseline exercise exclusions while preserving the default `planner-ready` safety gate.

#### Scenario: Planning query applies planner constraints

- **WHEN** the generation planner requests candidate exercises for a workout session
- **THEN** the library can return a bounded candidate pool that reflects that session's constraints, preferences, and search text while still enforcing hard filters

#### Scenario: Variation query excludes baseline exercise IDs

- **WHEN** the planner prepares a regeneration query with baseline exercise IDs that should be avoided
- **THEN** the library excludes those IDs from the candidate result while still applying the remaining hard filters and completeness gate

### Requirement: Planner Query Diagnostics

The exercise library MUST provide structured planner-facing diagnostics when the eligible `planner-ready` set cannot satisfy a planner query. Those diagnostics MUST identify the primary blocker categories needed for fallback and later coverage expansion.

#### Scenario: No-match result includes explicit blocker diagnostics

- **WHEN** a planner query returns no eligible `planner-ready` exercises
- **THEN** the library returns structured blocker diagnostics that let the server distinguish issues such as unsupported equipment, unresolved family coverage, or other planner-visible readiness gaps

#### Scenario: Diagnostics do not lower the completeness gate

- **WHEN** planner-facing diagnostics are returned for an empty result
- **THEN** the library still excludes lower-completeness exercises from the eligible set unless an internal non-production path explicitly requests them

### Requirement: Library Validation And Versioning

The exercise library build and validation workflow MUST verify schema integrity, required metadata presence, and representative query behavior before the library is treated as ready for server-side planning.

#### Scenario: Invalid seed data fails validation

- **WHEN** the seed or packaged SQLite library contains missing required metadata, duplicate IDs, or broken relations
- **THEN** validation fails before the library is promoted for runtime use

#### Scenario: Representative query smoke tests pass before use

- **WHEN** validation runs for the packaged library
- **THEN** it verifies representative queries for constraint-heavy categories such as quiet/apartment, travel, injury-sensitive, and style-specific pools

#### Scenario: Planner-ready records must meet stronger metadata rules

- **WHEN** validation runs against exercises marked `planner-ready`
- **THEN** it fails if any such record is missing required normalized metadata needed for planner-backed candidate selection
