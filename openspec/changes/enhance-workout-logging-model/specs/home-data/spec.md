## MODIFIED Requirements
### Requirement: Workout Logging Endpoint

Users MUST be able to mark a plan complete or quick-log an ad-hoc session with detailed set data, and the response refreshes recent activity.

#### Scenario: Log generated plan
- **GIVEN** a plan ID returned by the snapshot and a payload containing executed sets (reps, weight, RPE)
- **WHEN** the client POSTs to `/api/workouts/{id}/log`
- **THEN** the server writes a detailed `WorkoutSession` (including sets), timestamps `completedAt`, and returns the updated session summary list

#### Scenario: Quick log without plan
- **GIVEN** no active plan
- **WHEN** the user submits a quick log payload (focus, duration, note)
- **THEN** the server creates a manual session and returns it at the top of `recentSessions`
