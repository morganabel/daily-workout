## MODIFIED Requirements
### Requirement: Workout Logging Endpoint

Users MUST be able to mark a plan complete or quick-log an ad-hoc session with detailed set data, and the response refreshes recent activity.

For plan-based logs, the request payload MUST support including executed sets per exercise with:
- the plan exercise identifier `exerciseId` (the `id` from the generated plan)
- set ordering (index) and completion state
- numeric fields for reps, optional RPE (when provided), and load as `{ weight, unit }`

Validation constraints:
- `reps` is an integer >= 1 when present (0 is invalid; omit field if not entered)
- `weight` is a number >= 0 when present (0 is valid for bodyweight tracking)
- `unit` is one of `kg | lb` when `weight` is present; MUST be omitted if `weight` is omitted
- `rpe` is an integer in [1, 10] when present
- Partially complete sets (missing reps or weight) are valid; the `completed` flag on each set indicates user intent

The system MUST accept partially completed sessions (some sets incomplete) and persist completion state per set.

Rationale: `exerciseId` exists to reliably group submitted sets under the correct exercise, especially when exercise names repeat within a workout or across blocks.

For rollout safety, the endpoint SHOULD remain backward compatible with the legacy “summary-only” log payload for a transition period.

#### Scenario: Log generated plan
- **GIVEN** a plan ID returned by the snapshot and a payload containing executed sets keyed by `exerciseId`, including reps and optional load (`{ weight, unit }`) and RPE
- **WHEN** the client POSTs to `/api/workouts/{id}/log`
- **THEN** the server writes a detailed `WorkoutSession` (including sets), timestamps `completedAt`, and returns HTTP 200 with a JSON body containing:
  - `recentSessions`: updated list of session summaries (including the just-logged session at the top)
  - `loggedSession`: the full detailed session object, including all submitted sets with their final state

#### Scenario: Log partially completed workout
- **GIVEN** a plan ID and a payload where some sets are marked incomplete
- **WHEN** the client POSTs to `/api/workouts/{id}/log`
- **THEN** the server stores the full set list with completion flags intact, and the session is still considered completed at the workout level

#### Scenario: Accept legacy summary-only payload
- **GIVEN** a client sends the legacy log payload without set-level details
- **WHEN** the client POSTs to `/api/workouts/{id}/log`
- **THEN** the request succeeds, and the server records a completed session without sets (or with empty sets), returning an updated session summary list

#### Scenario: Quick log without plan
- **GIVEN** no active plan
- **WHEN** the user submits a quick log payload (focus, duration, note)
- **THEN** the server creates a manual session and returns it at the top of `recentSessions`

#### Scenario: Sync workout completed offline
- **GIVEN** a completed workout was saved locally with `sync_pending: true` due to offline mode
- **WHEN** the mobile app regains connectivity and attempts background sync
- **THEN** the app POSTs the detailed payload to `/api/workouts/{id}/log`, clears the `sync_pending` flag on success, and retries on failure (exponential backoff, max 3 attempts)

#### Scenario: Response includes detailed session
- **GIVEN** a client POSTs a detailed log payload with set data
- **WHEN** the server successfully processes the request
- **THEN** the response includes both `recentSessions` (summary list) and `loggedSession` (full detailed object with exercises and sets)

**Example response shape**:
```json
{
  "recentSessions": [
    {
      "id": "session-123",
      "name": "Upper Body Push",
      "completedAt": "2025-12-17T14:30:00Z",
      "durationMinutes": 30,
      "focus": "Chest & Shoulders",
      "source": "ai"
    }
  ],
  "loggedSession": {
    "id": "session-123",
    "workoutId": "plan-456",
    "completedAt": "2025-12-17T14:30:00Z",
    "durationSeconds": 1823,
    "exercises": [
      {
        "exerciseId": "ex-1",
        "name": "Bench Press",
        "sets": [
          { "order": 1, "reps": 10, "weight": 135, "unit": "lb", "rpe": 7, "completed": true },
          { "order": 2, "reps": 8, "weight": 135, "unit": "lb", "rpe": 8, "completed": true }
        ]
      }
    ]
  }
}
```
