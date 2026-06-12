## 1. Shared Contracts

- [x] 1.1 Add coach program attribution, attribution confidence, source kind (generated, manual-log, quick-log, substitution, legacy-inferred), primary/add-on block ids, strategy id, and program revision schemas to shared workout contracts
- [x] 1.2 Add deterministic strategy-selection output types for blueprint seeding
- [x] 1.3 Add adaptive plan v1 to coach-program-aware migration helpers and fixture tests

## 2. Mobile Session Attribution Migration

- [x] 2.1 Add a WatermelonDB schema version that stores session-level coach attribution on `workouts`
- [x] 2.2 Add the matching WatermelonDB migration step for existing databases
- [x] 2.3 Update the `Workout` model, workout mapper, and repository persistence paths to read and write attribution
- [x] 2.4 Add migration and repository round-trip tests for generated, completed, skipped, and manual workouts

## 3. Attribution Stamping

- [x] 3.1 Stamp generated workouts with program id, program version, primary/add-on source block ids, optional template id, optional projection id, schedule strategy, source kind, and attribution confidence
- [x] 3.2 Attach manual and quick logs to a coach source when the user logs against a projected or recommended session
- [x] 3.3 Preserve attribution through regeneration, version selection, completion, skip, archive, and favorite mutations
- [x] 3.4 Keep generation API adaptive intent payloads on a server-compatible allowlist while preserving richer local intent for attribution and debug traces

## 4. Resolver And Strategy Selection

- [x] 4.1 Update resolver history interpretation to prefer explicit session attribution before legacy title/focus matching
- [x] 4.2 Mark legacy inferred matches as low confidence and avoid treating them as authoritative for new coach-program advancement
- [x] 4.3 Implement deterministic initial strategy selection in blueprint seeding from template defaults and user context
- [x] 4.4 Represent later strategy changes as explicit program revisions with a reason

## 5. Validation

- [x] 5.1 Add regression tests for a completed workout whose name does not string-match its source block
- [x] 5.2 Add tests proving exercise-level block metadata alone is not required for session attribution
- [x] 5.3 Run targeted shared contract and mobile database/repository tests through Nx
- [x] 5.4 Validate this OpenSpec change with `openspec validate add-coach-program-attribution --strict`
- [x] 5.5 Add regression tests for combined-session target progress and client-only intent metadata compatibility
