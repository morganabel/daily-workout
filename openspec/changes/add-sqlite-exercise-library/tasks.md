## 1. Exercise Library Package And SQLite Asset

- [ ] 1.1 Create a dedicated server-available exercise-library package/module and define how the embedded SQLite asset is located at runtime in CE and hosted deployments
- [ ] 1.2 Define and create the SQLite schema for exercises, normalized equipment/tags/aliases relations, stable IDs, and filter-critical metadata columns
- [ ] 1.3 Add seed/build tooling that creates or refreshes the packaged SQLite library from source data in a repeatable way

## 2. Seed Data And Validation

- [ ] 2.1 Seed the library with enough exercises and metadata to cover quiet/apartment, travel, injury-sensitive, and style-specific generation needs
- [ ] 2.2 Add validation checks for duplicate IDs, broken relations, missing required metadata, and other seed/schema integrity failures
- [ ] 2.3 Add representative smoke-test queries that verify deterministic coverage for key constraint-heavy categories before the library is treated as ready

## 3. Read-Only Query Layer

- [ ] 3.1 Implement typed read-only query APIs for exercise lookup by ID and eligible candidate-pool queries
- [ ] 3.2 Implement deterministic hard-filter handling for equipment, contraindications/avoid tags, environment limits, and coarse load constraints without silent relaxation
- [ ] 3.3 Implement stable ordering and optional soft-bias/ranking inputs so repeated identical queries produce reproducible candidate pools

## 4. Generation-Facing Integration

- [ ] 4.1 Add a server-side integration path that can derive bounded candidate pools from generation inputs and merged context while keeping the public `TodayPlan` response unchanged
- [ ] 4.2 Ensure regeneration paths can reuse the same exercise-library filtering logic, including stateless provider flows that need a fresh candidate pool
- [ ] 4.3 Keep candidate-pool metadata internal to the server/runtime path and out of the user-facing generation response contract

## 5. Packaging, Docs, And Verification

- [ ] 5.1 Document how the embedded SQLite library is built, validated, packaged, and consumed locally and in hosted deployments
- [ ] 5.2 Add Nx-friendly validation/test commands for library build integrity and deterministic query behavior
- [ ] 5.3 Validate the OpenSpec change and confirm the library artifacts are ready for later planning/prompt integration work
