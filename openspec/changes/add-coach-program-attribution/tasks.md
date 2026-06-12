## 1. Shared Contracts

- [ ] 1.1 Add coach program attribution, attribution confidence, source kind (generated, manual-log, quick-log, substitution, legacy-inferred), strategy id, and program revision schemas to shared workout contracts
- [ ] 1.2 Add deterministic strategy-selection output types for blueprint seeding
- [ ] 1.3 Add adaptive plan v1 to coach-program-aware migration helpers and fixture tests

## 2. Mobile Session Attribution Migration

- [ ] 2.1 Add a WatermelonDB schema version that stores session-level coach attribution on `workouts`
- [ ] 2.2 Add the matching WatermelonDB migration step for existing databases
- [ ] 2.3 Update the `Workout` model, workout mapper, and repository persistence paths to read and write attribution
- [ ] 2.4 Add migration and repository round-trip tests for generated, completed, skipped, and manual workouts

## 3. Attribution Stamping

- [ ] 3.1 Stamp generated workouts with program id, program version, source block id, optional template id, optional projection id, schedule strategy, source kind, and attribution confidence
- [ ] 3.2 Attach manual and quick logs to a coach source when the user logs against a projected or recommended session
- [ ] 3.3 Preserve attribution through regeneration, version selection, completion, skip, archive, and favorite mutations

## 4. Resolver And Strategy Selection

- [ ] 4.1 Update resolver history interpretation to prefer explicit session attribution before legacy title/focus matching
- [ ] 4.2 Mark legacy inferred matches as low confidence and avoid treating them as authoritative for new coach-program advancement
- [ ] 4.3 Implement deterministic initial strategy selection in blueprint seeding from template defaults and user context
- [ ] 4.4 Represent later strategy changes as explicit program revisions with a reason

## 5. Validation

- [ ] 5.1 Add regression tests for a completed workout whose name does not string-match its source block
- [ ] 5.2 Add tests proving exercise-level block metadata alone is not required for session attribution
- [ ] 5.3 Run targeted shared contract and mobile database/repository tests through Nx
- [ ] 5.4 Validate this OpenSpec change with `openspec validate add-coach-program-attribution --strict`
