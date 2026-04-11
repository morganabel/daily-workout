## Context

Workout generation is moving toward a more deterministic planning flow where the server can bound the model's options before prompting. Today the generation stack validates requests, merges profile/history context, and asks the selected provider to produce a `TodayPlan`, but it has no local exercise source of truth for filtering by equipment, injury/avoid constraints, impact, noise, space, travel constraints, or style tags.

The user intends to provide a local exercise library as an embedded SQLite database that is available to the server runtime. This is a cross-cutting change because it introduces a new packaged data asset, a query layer that later generation and evaluation flows will consume, and a requirement that CE and hosted deployments behave the same way without adding a new remote dependency or billing surface.

The data source strategy is now explicit. The library will live in a dedicated monorepo package at `packages/server-exercise-library`. It will import from a pinned snapshot of the public-domain `free-exercise-db` project, keep only the committed source inputs needed to reproduce the library, and build the runtime SQLite asset locally from those committed inputs. The normal app build will not fetch remote source data.

The design should solve the deterministic data problem without overcommitting to a fully closed-world workout engine on day one. The first implementation needs to make bounded candidate-pool construction possible for future planning work, especially for quiet/apartment, travel, injury-sensitive, and style-specific generation cases.

## Goals / Non-Goals

**Goals:**

- Ship a read-only embedded SQLite exercise library that the server runtime can query locally in both CE and hosted deployments
- Define a normalized schema with stable exercise IDs and filterable metadata for the current generation needs
- Provide a thin query layer that supports deterministic hard filtering plus optional biasing for candidate-pool construction
- Make query results deterministic and reusable by future generation and evaluation code
- Commit only the source snapshot, vocabularies, curation inputs, and build scripts needed to recreate the merged library and SQLite artifact
- Store all imported exercises in the built library while using `metadataCompleteness` to gate which records are safe for production planning
- Keep the user-facing workout response contract unchanged while enabling future internal planning to consume library-backed candidate pools

**Non-Goals:**

- Do not implement the full prompt/planning rewrite in this change
- Do not require the model to choose only from the library in the first iteration
- Do not build a complete substitution graph, progression engine, or coaching ontology
- Do not introduce a new hosted-only service, remote exercise API, or separate billing concept
- Do not expose internal candidate pools or diagnostics in the public `TodayPlan` response
- Do not commit the generated merged canonical JSON or the built SQLite database as source-of-truth files

## Decisions

### Decision: Use an embedded SQLite asset with a read-only server-side query layer

The exercise library will be packaged as a local SQLite database file that is available to the server runtime. Application code will access it only through a dedicated query module instead of issuing raw SQL throughout the codebase.

Why this approach:

- SQLite is local, portable, and works the same in CE and hosted server deployments
- A dedicated query layer keeps the rest of the codebase decoupled from schema details and makes tests easier to write
- Read-only access matches the intended use: deterministic exercise selection metadata, not user-generated mutable content

Alternatives considered:

- JSON or YAML files only: rejected because we need deterministic multi-dimensional filtering without pushing metadata parsing into application code
- Postgres-only storage: rejected because it adds operational requirements that do not fit CE/offline-friendly packaging
- Remote exercise API: rejected because it adds latency, cost, and privacy/deployment complexity before the product needs it

### Decision: Implement the library in a dedicated monorepo package with reproducible build inputs

The library will live in `packages/server-exercise-library` and will own the import pipeline, committed source snapshot, local curation inputs, validation, SQLite build step, and runtime query layer.

Why this approach:

- It keeps the data-build workflow close to the consuming server code without introducing another repository or artifact pipeline yet
- It preserves a clean extraction path later if the exercise data lifecycle becomes large enough to justify a separate repository
- It makes Nx build/test integration straightforward for local development and CI

Alternatives considered:

- Separate data repository from day one: rejected for now because it adds artifact-publishing and deployment complexity before the schema and curation workflow stabilize
- Hiding the build logic inside an existing server package: rejected because the library needs a clear boundary around source data, curation, validation, and runtime access

### Decision: Build from a committed single-source snapshot plus committed local curation inputs

The package will commit a reduced single-file snapshot of upstream `free-exercise-db` source data that keeps only the text and structural fields needed for import. The reduced snapshot will retain useful text fields such as names and instructions, but it will not retain exercise images. It will also commit local vocabularies and a human-authored override layer. The normal build will read only those committed inputs and produce generated outputs in build artifacts.

Why this approach:

- It makes builds reproducible without network access
- It keeps the repository focused on source inputs rather than generated outputs
- It allows future upstream refreshes to be explicit maintenance operations rather than an implicit part of every app build

Alternatives considered:

- Fetching upstream source during the normal build: rejected because it weakens reproducibility and couples builds to network availability and upstream HEAD
- Committing the fully merged canonical JSON and SQLite database: rejected because they are generated artifacts that can be recreated from smaller committed inputs

### Decision: Use `metadataCompleteness` as the only runtime maturity gate

Every imported exercise may exist in the generated library, but each record will carry a normalized `metadataCompleteness` field with the ordered states `raw`, `derived`, `curated`, and `planner-ready`. Production candidate-pool queries will default to filtering at `planner-ready`, while internal tooling may inspect lower-completeness records.

Why this approach:

- It allows the product to preserve broad source coverage while only exposing a curated subset to generation logic
- It provides a simple promotion path as metadata quality improves over time
- It avoids introducing a second enablement flag before there is a real need for one

Alternatives considered:

- Storing only a curated subset in the library: rejected because it throws away useful provenance and future coverage that can still be valuable for internal inspection and later promotion
- Adding both `metadataCompleteness` and a separate production enablement flag in v1: rejected because a single maturity gate is sufficient for the current workflow

### Decision: Normalize hard-filter metadata into columns and join tables

The schema will keep filter-critical fields in normal columns or normalized join tables instead of hiding them inside opaque JSON blobs. Core exercise rows will carry stable identity plus coarse load and environment metadata, while many-to-many tables will represent equipment, aliases, and tags.

Why this approach:

- Hard constraints like equipment, noise, impact, floor requirement, and travel suitability need deterministic SQL filtering
- Join tables make the data extensible without forcing wide sparse tables for every tag-like concept
- It keeps future generation and evaluation logic auditable

Alternatives considered:

- Storing most metadata as JSON blobs: rejected because it weakens deterministic querying and makes validation harder
- Encoding everything as free-form tags: rejected because hard filters need clearer semantics than tag text alone

### Decision: Separate hard filters from soft bias in the query API

The query layer will distinguish mandatory constraints from preference/bias criteria. Hard filters MUST never be violated silently. Soft criteria may influence ordering or scoring, but an exact-match query that yields no candidates should return an explicit empty result rather than broadening into disallowed exercises.

Why this approach:

- Future generation work needs candidate pools it can trust, especially for injury, equipment, quiet, and event-protection cases
- Explicit empty results are easier to debug than hidden relaxation logic
- This keeps future repair and fallback behavior in application code instead of burying it in SQL heuristics

Alternatives considered:

- Auto-relaxing constraints inside the query layer: rejected because it can mask safety and compatibility bugs
- Hard-filtering only with no bias support: rejected because style- and goal-aware pools still need a way to prefer better candidates when many exercises are eligible

### Decision: Scope the first version to server-side consumption only

The initial query layer is primarily a server/runtime asset for generation and evaluation. The mobile app does not need direct library access in this change.

Why this approach:

- The immediate requirement is to support server-side planning and provider-aware regeneration
- It avoids shipping the SQLite asset into the Expo/mobile runtime before there is a concrete UI use case
- It reduces packaging and migration risk while keeping future mobile reuse possible

Alternatives considered:

- Shared client/server direct access from day one: rejected because it adds unnecessary mobile complexity before there is a committed consumer

### Decision: Version and validate the seed data as a product artifact

The SQLite library contents will be treated as versioned product data. The build or validation workflow must check schema integrity, stable IDs, required metadata presence, and deterministic query expectations before the library is consumed by generation logic.

Why this approach:

- A broken library is effectively a broken planning dependency
- Seed validation is cheaper and safer than discovering bad metadata through live generation failures
- It keeps CE and hosted packaging aligned around the same tested asset

Alternatives considered:

- Ad hoc manual edits to the DB with no validation: rejected because it is too fragile for a core generation dependency

### Decision: Keep query behavior strict and planner-safe by default

The runtime query layer will expose deterministic lookup and candidate-pool APIs over the entire built library, but eligible-pool queries will default to a minimum completeness threshold of `planner-ready`. Lower-completeness records may still be returned by direct lookup or internal diagnostics, but they will not silently participate in production planning.

Why this approach:

- It matches the curated-subset rollout strategy without losing the rest of the imported data
- It makes planner behavior explicit and safe by default
- It gives validation a clear contract for what must be complete before a record can influence generation

Alternatives considered:

- Allowing candidate queries to include partially derived records by default: rejected because it undermines the safety and predictability goals of the library

## Risks / Trade-offs

- [Library coverage is too sparse for some specialized scenarios] -> Mitigation: define minimum metadata and seed coverage for known weak areas first, and keep first-phase generation able to fall back outside the pool only when later planning code explicitly allows it
- [Schema becomes too abstract or over-modeled] -> Mitigation: keep v1 focused on concrete filter dimensions needed for current generation failures rather than encoding a full exercise ontology
- [Hosted packaging or deployment misses the SQLite asset] -> Mitigation: treat the DB as an explicit runtime artifact with startup/validation checks in CI and local dev workflows
- [Query logic hides safety relaxations] -> Mitigation: separate hard filters from soft bias and require empty-result behavior instead of silent broadening
- [Future consumers couple tightly to raw SQL] -> Mitigation: require a single query layer/module and keep SQL details behind typed interfaces
- [Imported upstream data quality is too uneven for immediate planner use] -> Mitigation: store all imported records, but require `planner-ready` completeness before production candidate queries can use them
- [The reduced upstream snapshot loses fields needed later] -> Mitigation: keep source provenance metadata and make snapshot refreshes explicit so fields can be added deliberately if later consumers need them

## Migration Plan

1. Add `packages/server-exercise-library` with explicit build targets for import maintenance, canonical generation, validation, and SQLite generation.
2. Commit a reduced single-file snapshot of upstream `free-exercise-db` source data, plus source manifest, vocabularies, and local curation inputs.
3. Build the normalized canonical dataset and SQLite artifact from those committed inputs without network access.
4. Add validation tests that assert schema integrity, stable IDs, completeness gating, and representative deterministic queries for the key constraint categories.
5. Add the server-side query layer and wire it into a non-user-facing integration path first so packaging and startup behavior can be validated safely.
6. Add generation-facing integration only after the library queries are proven stable.
7. Roll back by removing the exercise-library consumer wiring and package dependency; the public `TodayPlan` contract remains unchanged.

## Open Questions

- Do we want a generated TypeScript snapshot or manifest of DB/library version metadata for easier debugging in reports?
- How much style metadata should be normalized in v1 versus represented as tags?
- Should the first query layer expose ranking scores, or only deterministic filtering plus stable ordering?
