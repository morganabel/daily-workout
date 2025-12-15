## Why
Current workout logging is binary (completed/not completed), which is insufficient for users who need to track progressive overload (weight, reps, RPE). Competitors like Strong and Fitbod provide granular tracking. To support this, the system needs a rich data model and UI for capturing detailed set-level performance.

## What Changes
- **Data Model**: Leverage the existing (but unused) `sets` table in the mobile database to store granular performance data.
- **Contracts**: Update shared Zod schemas to include `WorkoutSessionSet` and detailed session payloads for API synchronization.
- **Mobile UI**: Enhance `ActiveWorkoutScreen` to support inline set editing (add/remove sets, modify reps/weight/RPE) and history visualization.
- **API**: Update the workout logging endpoint to accept detailed session payloads instead of just summary data.

## Impact
- Affected specs: `home-data`, `mobile-ui`
- Affected code:
    - `packages/shared/src/lib/contracts/workouts.ts`
    - `apps/mobile/src/app/ActiveWorkoutScreen.tsx`
    - `apps/mobile/src/app/db/repositories/WorkoutRepository.ts`
    - `apps/server/app/api/workouts/[id]/log/route.ts` (implied)
