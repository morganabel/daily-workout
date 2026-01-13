## 1. Implementation

- [x] 1.1 Add shared contract schemas/types for set-level logs (set, exercise log, session detail, and a log payload) including `weightUnit: 'lb' | 'kg'` and integer `RPE`, in `@workout-agent/shared`.
- [x] 1.2 Mobile DB: persist per-set performance for each exercise (create default sets on workout start; update sets as user edits) and create WatermelonDB schema migration for `weight_unit` column.
- [x] 1.3 Mobile UI: update Active Workout screen to edit per-set `weight` + unit, `reps`, and optional integer `RPE`, toggle set completion, and add/remove sets.
- [x] 1.4 Mobile UI: add a workout session detail screen reachable from History/Recent Activity to review set-level logs and support post-completion edits (edit mode).
- [x] 1.5 Progressive overload helpers: surface “last time” performance per exercise (read-only hints and/or prefill) using local history queries.
- [x] 1.6 Logging semantics: support completion-only logging (no set data) and detailed logging (set data) without breaking existing flows.
- [x] 1.7 Tests: add unit tests for new shared schemas and mobile repository queries/mutations; update any route tests impacted by contract changes.
- [x] 1.8 Run `nx test`/`nx lint` as appropriate and update docs/screenshots if needed.
