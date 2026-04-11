## 1. Exercise Library Package And SQLite Asset

- [x] 1.1 Create a dedicated `packages/server-exercise-library` package and define how the embedded SQLite asset is located at runtime in CE and hosted deployments
- [x] 1.2 Define and create the SQLite schema for exercises, normalized equipment/tags/aliases relations, stable IDs, filter-critical metadata columns, and `metadataCompleteness`
- [x] 1.3 Add Nx-friendly build targets that generate the merged canonical dataset and packaged SQLite library from committed source inputs in a repeatable way

## 2. Seed Data And Validation

- [x] 2.1 Add a committed reduced snapshot of `free-exercise-db` source data that keeps text/instruction fields but excludes images, plus a source manifest that records provenance and the pinned upstream version
- [x] 2.2 Add committed vocabularies and override inputs that enrich imported exercises into the internal metadata model without requiring network access during normal builds
- [x] 2.3 Seed the library with enough `planner-ready` exercises and metadata to cover quiet/apartment, travel, injury-sensitive, and style-specific generation needs while still preserving lower-completeness imported records in the built library
- [x] 2.4 Add validation checks for duplicate IDs, broken relations, unknown vocab values, missing required metadata for `planner-ready` records, and other seed/schema integrity failures
- [x] 2.5 Add representative smoke-test queries that verify deterministic coverage for key constraint-heavy categories before the library is treated as ready

## 3. Read-Only Query Layer

- [x] 3.1 Implement typed read-only query APIs for exercise lookup by ID and eligible candidate-pool queries over the built library
- [x] 3.2 Implement deterministic hard-filter handling for equipment, contraindications/avoid tags, environment limits, and coarse load constraints without silent relaxation
- [x] 3.3 Default production candidate-pool queries to `metadataCompleteness = 'planner-ready'` while allowing direct lookup or internal tooling to inspect lower-completeness records
- [x] 3.4 Implement stable ordering and optional soft-bias/ranking inputs so repeated identical queries produce reproducible candidate pools

## 4. Generation-Facing Integration

- [x] 4.1 Add a server-side integration path that can derive bounded candidate pools from generation inputs and merged context while keeping the public `TodayPlan` response unchanged
- [x] 4.2 Ensure regeneration paths can reuse the same exercise-library filtering logic, including stateless provider flows that need a fresh candidate pool
- [x] 4.3 Keep candidate-pool metadata internal to the server/runtime path and out of the user-facing generation response contract

## 5. Packaging, Docs, And Verification

- [x] 5.1 Document how the committed source snapshot, vocabularies, overrides, generated canonical dataset, and generated SQLite library relate to each other
- [x] 5.2 Add Nx-friendly validation/test commands for library build integrity and deterministic query behavior
- [x] 5.3 Validate the OpenSpec change and confirm the library artifacts are ready for later planning/prompt integration work
