## Why
Workout logging is currently binary (completed/not completed). This prevents users from tracking progressive overload (weight, reps, RPE) and makes it hard to review or repeat successful sessions. Competitors (Strong, Fitbod) support granular set-level logging and are better suited for strength progression.

## What Changes
- Add a set-level performance model for workout sessions (sets with reps, weight + unit, optional integer RPE).
- Update Active Workout UX to capture and persist set performance while keeping a fast “finish” path.
- Add a session detail view so users can review (and edit) what they did per exercise/set after completion.
- Extend shared contracts to represent set logs for future sync/export and type-safe UI.
- Extend workout logging semantics to accept detailed logs without breaking completion-only flows.

## Impact
- Affected specs: `home-data`, `mobile-ui` (optional: `user-profile` if we add weight unit preferences)
- Affected code (expected):
  - `apps/mobile/src/app/ActiveWorkoutScreen.tsx`
  - `apps/mobile/src/app/HistoryScreen.tsx` (plus a new session detail screen)
  - `apps/mobile/src/app/db/models/Set.ts` and WatermelonDB schema/migrations (if adding weight units)
  - `packages/shared/src/lib/contracts/workouts.ts`
  - `apps/server/src/app/api/workouts/[id]/log/route.ts` and `packages/server-core/src/handlers/log-workout.ts`
