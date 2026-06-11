# workout-catalog Specification

## Purpose

Define the server-side workout catalog used to select, adapt, and materialize curated workout recipes without requiring an AI provider call.

## Requirements

### Requirement: Server-Side Workout Catalog

The system MUST provide a server-side workout catalog containing curated workout recipes. Catalog recipes MUST be available in CE and hosted deployments without requiring an AI provider call.

#### Scenario: Catalog opens locally

- **WHEN** the server initializes catalog-backed generation in a valid deployment
- **THEN** it can open the packaged catalog data from local runtime storage without requiring network access

#### Scenario: CE and hosted share system catalog behavior

- **WHEN** catalog matching runs in CE or hosted mode
- **THEN** it uses the same curated system catalog semantics before any hosted-only community catalog extension is considered

### Requirement: Workout Recipes Reference Canonical Exercises

Workout recipes MUST reference canonical exercise IDs from the exercise catalog for concrete exercise slots and substitutions. Catalog validation MUST fail if a recipe references a missing exercise or an exercise that is not eligible for production planning.

#### Scenario: Missing exercise reference fails validation

- **WHEN** a catalog recipe references an unknown exercise ID
- **THEN** catalog validation fails before the catalog is treated as ready for runtime use

#### Scenario: Recipe references planner-ready exercises

- **WHEN** a recipe is available for production catalog matching
- **THEN** every referenced exercise used for concrete selection is present in the exercise catalog with sufficient planner-ready metadata

### Requirement: Portable Relational Catalog Schema

The workout catalog MUST store filter-critical recipe data in a relational shape that can be recreated in SQLite for v1 and in PostgreSQL later. Recipe ownership, source, version metadata, tags, equipment requirements, constraints, blocks, slots, and exercise references MUST NOT exist only as opaque JSON blobs.

#### Scenario: Filter-critical fields are queryable

- **WHEN** catalog matching filters by equipment, duration, focus, experience, contraindication, or ownership
- **THEN** it uses normalized columns or join tables rather than parsing free-form recipe text

#### Scenario: Catalog supports future ownership types

- **WHEN** the catalog stores a curated system recipe
- **THEN** the record includes ownership/source metadata compatible with future system, community, and user catalog records

### Requirement: Catalog Match Decisions

The workout catalog MUST expose a matcher that evaluates request and context inputs and returns one of `direct`, `adapt`, or `none` with the selected recipe when applicable.

#### Scenario: Excellent fit returns direct decision

- **WHEN** a catalog recipe satisfies hard constraints and strongly matches focus, duration, equipment, energy, experience, and planning context
- **THEN** the matcher returns a `direct` decision suitable for immediate `TodayPlan` materialization

#### Scenario: Ambiguous fit returns adapt decision

- **WHEN** a catalog recipe satisfies hard constraints but the request has ambiguity, dense notes, unusual context, or only partial fit
- **THEN** the matcher returns an `adapt` decision so the generation planner can decide whether to use or adapt the recipe

#### Scenario: Weak fit returns none decision

- **WHEN** no catalog recipe satisfies hard constraints or reaches the minimum fit threshold
- **THEN** the matcher returns `none` without relaxing hard constraints silently

### Requirement: Catalog Workout Materialization

The catalog MUST materialize selected recipes into canonical `TodayPlan` responses with `source: 'library'`. Materialized workouts MUST include stable block and exercise data sufficient for the mobile app to persist and render previews without a later catalog lookup.

#### Scenario: Direct catalog match returns canonical plan

- **WHEN** catalog-aware generation accepts a direct catalog match
- **THEN** the server returns a valid `TodayPlan` whose source is `library`

#### Scenario: Materialized plan snapshots display data

- **WHEN** a catalog recipe is materialized into a workout
- **THEN** the response includes block titles, block durations, exercise names, prescriptions, details, equipment, focus, energy, and duration as resolved plan data

### Requirement: Catalog No-Match Diagnostics

When explicit library mode cannot find a valid recipe, the system MUST return a structured no-match error. Diagnostics MUST distinguish hard constraint misses from ordinary low-fit results without exposing internal recipe scoring details as a required public contract.

#### Scenario: Library mode no match returns error

- **WHEN** a request uses explicit library mode and no recipe can satisfy the request
- **THEN** the generation endpoint returns a structured no-match error instead of invoking an AI provider

#### Scenario: Auto mode no match falls through

- **WHEN** a request uses auto mode and the catalog matcher returns no viable recipe
- **THEN** generation continues through the existing AI planning and provider path when AI is allowed
