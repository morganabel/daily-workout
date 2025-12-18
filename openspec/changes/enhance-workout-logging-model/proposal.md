## Why
Current workout logging is binary (completed/not completed), which is insufficient for users who need to track progressive overload (weight, reps, RPE). Competitors like Strong and Fitbod provide granular tracking. To support this, the system needs a rich data model and UI for capturing detailed set-level performance.

## Goals
- Capture set-level performance during an active workout (reps, weight, optional RPE, completion state).
- Persist set edits locally (WatermelonDB) so users can resume after navigation/app restart.
- Sync detailed session data to the server via existing logging endpoint.

## Non-Goals
- Building full analytics (PR detection, trend charts) beyond showing recent history context.
- Complex unit systems (assume a single stored unit for weight in the payload; conversion UI can follow later).
- Advanced set types (warm-up, drop sets, supersets) unless already representable in the current plan model.

## What Changes
- **Data Model**: Leverage the existing (but unused) `sets` table in the mobile database to store granular performance data.
- **Contracts**: Update shared Zod schemas to include `WorkoutSessionSet` and detailed session payloads for API synchronization.
- **Mobile UI**: Enhance `ActiveWorkoutScreen` to support inline set editing (add/remove sets, modify reps/weight/RPE) and history visualization.
- **API**: Update the workout logging endpoint to accept detailed session payloads instead of just summary data.

## Key Decisions / Constraints
- Set rows are user-editable and may be partially complete; “Finish Workout” submits all sets with completion state.
- Local-first behavior: editing a set MUST be durable (no loss on app restart).
- The server endpoint MUST continue to support quick logging without a plan.
- For plan-based logs, set data MUST be attributable to a specific exercise (prefer plan exercise `id`; otherwise fall back to block/order/name).

## Decisions
- **Weight units**: Represent load as `{ weight: number, unit: 'kg' | 'lb' }` in shared contracts and API payloads. On-device storage MUST retain both the numeric value and its unit. The UI defaults to the user's preferred unit (or `kg` if unset) and can optionally override per set.
- **User weight unit preference**: The user's preferred weight unit (kg or lb) is stored in `UserPreferences` as `preferredWeightUnit`. The mobile UI defaults to this preference when displaying and editing set data. If unset, the system defaults to `kg`.
- **Exercise identity**: For plan-based sessions, sets are associated to exercises using the plan exercise `id` (no composite keys).
- **Database schema migration**: Adding the `weight_unit` column to the `sets` table requires a schema version bump from v3 to v4. The migration preserves existing weight values and sets `weight_unit` to `null` for any pre-existing rows (none expected, as the table is currently unused).
- **Server persistence**: The mobile database is the source of truth. The server stores session summaries and detailed sessions in an in-memory per-device store (similar to `generation-store`) until a real database exists; server restart may clear history.
- **History visualization (minimum)**: On Active Workout, show "Last time" context per exercise based on the most recent completed session on-device matching by exercise name (case-insensitive exact match). If no history exists, no context is displayed.
- **Offline sync behavior**: When a workout is completed offline, it is persisted locally with a `sync_pending` flag. The mobile app retries sync on next app launch or connectivity restore using exponential backoff (max 3 attempts). No conflict resolution is implemented (mobile is source of truth for workouts created on-device).
- **Timer state on restore**: The session timer persists `startedAt` timestamp (not elapsed seconds). On app restart or return from background, the UI recalculates elapsed time from `startedAt` to `now` to ensure accuracy.
- **Validation constraints**: `reps` must be >= 1 if provided (0 is invalid; omit if not entered). `weight` must be >= 0 if provided (0 is valid for bodyweight tracking). `rpe` must be 1-10 if provided. `unit` is required when `weight` is present and must be omitted when `weight` is absent.

## Future Work (Out of Scope)
The decisions above are sufficient for “log this plan I just generated” workflows, but they do not fully solve long-lived, cross-device identity in a local-first world.

Follow-up work (separate change proposal) should address:
- **Stable exercise identity across edits**: if plans can be edited (rename/reorder/replace exercises) or if templates exist, define a canonical exercise identity that survives those mutations.
- **Local-first sync semantics**: if detailed sessions sync across devices, define how to reconcile concurrent edits (e.g., set rows added/removed offline) and how exercise identity participates in merges.
- **Server persistence model**: move from in-memory storage to a real database and decide what the server treats as canonical IDs vs client-generated IDs.
- **Mapping layer**: if needed, introduce an `exercise_instance_id` (per-session) separate from an `exercise_definition_id` (catalog/template) so logs remain consistent even when display names change.

## Impact
- Affected specs: `home-data`, `mobile-ui`
- Affected code:
    - `packages/shared/src/lib/contracts/workouts.ts`
    - `apps/mobile/src/app/ActiveWorkoutScreen.tsx`
    - `apps/mobile/src/app/db/repositories/WorkoutRepository.ts`
    - `apps/server/app/api/workouts/[id]/log/route.ts` (implied)
