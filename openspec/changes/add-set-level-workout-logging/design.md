## Context

- Users need set-level tracking (weight, reps, RPE) to support progressive overload.
- The mobile app is local-first (WatermelonDB) and already has `workouts`, `exercises`, and `sets` tables, but the Active Workout UI currently only supports checkbox completion.
- Server-side workout persistence is currently minimal/stubbed; the mobile data layer is the practical source of truth for logging.

## Goals / Non-Goals

- Goals:
  - Capture set-level performance during an Active Workout: `reps`, `weight`, optional `RPE`, completion state, and stable ordering.
  - Support both `lb` and `kg` for recorded weights.
  - Keep “radical simplicity”: users can still finish a workout quickly without entering details.
  - Enable review of logged performance (per-exercise, per-set) from history.
  - Allow post-completion edits of set logs so users can correct mistakes.
- Non-Goals (for this change):
  - Full analytics (charts, PR detection) and automatic progressive overload prescriptions.
  - Multi-device sync and conflict resolution (can be added later once the session log contract exists).
  - Rich non-strength modalities (distance/time sets) beyond basic notes.

## Decisions

- Data model:
  - Persist sets as first-class records tied to an exercise (local-first).
  - Each set stores `order`, `completed`, optional `reps`, optional `weight`, optional integer `RPE` (1-10).
  - Weight units: store a `weightUnit` per set (`lb` or `kg`). If `weight` is present, `weightUnit` MUST be present.
- UX:
  - Starting a workout seeds default sets per exercise (from `prescription` when parseable; otherwise a conservative default like 3 sets).
  - Set editing is optimized for speed: tap-to-edit, quick increment/decrement, and one-tap completion.
  - “Last time” hints are computed by matching exercise name (normalized) against the most recent _completed_ session that contains at least one completed set for the matching exercise name.
  - Completed workouts remain editable for set logs (weight/reps/RPE/completed + add/remove sets) while preserving the original `completedAt`.
- API:
  - Completion-only flows remain valid (no set payload required).
  - If/when a server sync endpoint is added, it uses the shared “session detail” contract to avoid ad-hoc JSON.

## Risks / Trade-offs

- Additional UI complexity may slow down the “fast log” experience → mitigate by making set logging optional and keeping a prominent “Finish” action.
- Exercise name matching can be noisy (“DB Bench” vs “Dumbbell Bench Press”) → mitigate with simple normalization now and a future canonical exercise ID system.
- Weight unit decision impacts data integrity → mitigate by deciding storage semantics before rollout and documenting migration rules.

## Migration Plan

- Existing completed sessions remain valid; they simply have no set data.
- Planned workouts created before this change gain sets lazily when the user starts the workout (seed sets on first open of Active Workout).
- Add a WatermelonDB schema migration for `Set.weightUnit` with a safe default:
  - Existing set rows with `weight` unset: `weightUnit` MAY be null/undefined.
  - Existing set rows with `weight` present: treat missing `weightUnit` as `lb` for backward compatibility.

## Open Questions

- (Optional) Should we add a user-level default unit preference (for example in `user-profile`) to reduce per-set unit picking?
