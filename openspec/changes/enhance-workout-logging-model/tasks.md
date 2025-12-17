## 1. Contracts & API
- [x] 1.1 Update `packages/shared` with `WorkoutSessionSet` and detailed `WorkoutSession` schemas
- [x] 1.2 Update `packages/shared` logging request schema to include detailed set data
- [x] 1.3 Implement unit semantics in contracts: load is `{ weight, unit: 'kg' | 'lb' }`
- [x] 1.4 Add `preferredWeightUnit` field to `UserPreferences` schema with default `kg`
- [x] 1.5 Define response shape for logging endpoint (includes `recentSessions` + `loggedSession`)

## 2. Mobile Implementation
- [x] 2.1 Update `WorkoutRepository` to support saving/updating individual sets
- [x] 2.2a Create `SetRow` component skeleton with weight and reps text inputs
- [x] 2.2b Add RPE input (optional, numeric 1-10) to `SetRow`
- [x] 2.2c Add completion checkbox/toggle to `SetRow`
- [x] 2.2d Add weight unit selector (kg/lb dropdown) to `SetRow`
- [x] 2.3 Implement "Add Set" / "Remove Set" functionality in UI
- [x] 2.4 Wire up `ActiveWorkoutScreen` to save set data to `sets` table
- [x] 2.5 Implement "Finish Workout" to bundle detailed data for API submission
- [x] 2.6a Add schema migration (v3 → v4): add `weight_unit` column to `sets` table (type: string, optional)
- [x] 2.6b Update `Set` model to include `unit` field with `@field('weight_unit')` decorator
- [x] 2.6c Add `sync_pending` column to `workouts` table (type: boolean, default false)
- [x] 2.6d Add `started_at` column to `workouts` table (type: number, optional) for timer timestamp
- [x] 2.7 Add input validation for set fields (reps >= 1, weight >= 0, rpe 1-10)
- [x] 2.8 Persist `startedAt` timestamp for session timer; calculate elapsed time from timestamp on restore
- [x] 2.9 Ensure in-progress set edits restore after app restart (local-first durability)
- [x] 2.10 Implement "Last time" history query (case-insensitive name match, most recent completed session)
- [x] 2.11 Implement offline sync: set `sync_pending` flag when completing workout offline
- [x] 2.12 Implement sync retry logic with exponential backoff (max 3 attempts)
- [x] 2.13 Add user preference UI for `preferredWeightUnit` in profile/settings screen
- [ ] 2.14 Add unit/UI tests for set editing, persistence, and validation (as appropriate for the repo)

## 3. Server Implementation
- [x] 3.1 Update logging endpoint to validate and store detailed session data (if persistent storage exists)
- [x] 3.2 Implement an in-memory per-device session store (similar to `generation-store`) for session summaries + detailed payloads
- [x] 3.3 Add validation for `unit` field (must be present when `weight` is present; must be omitted otherwise)
- [x] 3.4 Implement response shape with `recentSessions` + `loggedSession` detailed object
- [x] 3.5 Add server tests for detailed logging payload validation and backward compatibility (quick log)
- [x] 3.6 Add server tests for partial completion (some sets incomplete) and validation edge cases
