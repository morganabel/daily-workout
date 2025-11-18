# home-data Specification

## Purpose
TBD - created by archiving change add-mobile-home-data-pipeline. Update Purpose after archive.
## Requirements
### Requirement: Home Snapshot Endpoint
The backend MUST expose a single authenticated endpoint that returns today's plan, quick-action presets, and the last three session summaries. Snapshot responses SHALL now include a `generationStatus` object describing the latest generation attempt (`state: 'idle' | 'pending' | 'error'`, `submittedAt`, optional `etaSeconds` + `message`) so the client can mirror pending/error states even if the plan is still the previous one.

#### Scenario: Snapshot exposes pending generation state
- **GIVEN** the user triggered generation within the last 30 seconds and the AI call is still running
- **WHEN** the snapshot endpoint responds
- **THEN** it includes `{ generationStatus: { state: 'pending', submittedAt, etaSeconds } }` plus the most recently available plan (if any) so the client can show progress without losing the previous plan

#### Scenario: Snapshot surfaces persisted plan
- **GIVEN** the latest generation completed successfully
- **WHEN** the client fetches the snapshot after a reload
- **THEN** the `plan` field contains the stored `TodayPlan` (until it is logged/cleared) and `generationStatus.state` returns to `idle`

#### Scenario: Snapshot reports last error
- **GIVEN** the last generation failed (e.g., provider timeout)
- **WHEN** the snapshot endpoint responds
- **THEN** it sets `generationStatus` to `{ state: 'error', message }` while leaving the last good plan untouched so the UI can prompt a retry without discarding context

#### Scenario: Snapshot quick actions stay deterministic
- **GIVEN** no server-side storage of quick-action overrides
- **WHEN** the snapshot endpoint responds
- **THEN** it returns the default quick action presets (or ones derived from the stored plan) so the mobile client can layer its locally staged values on top deterministically

### Requirement: Workout Generation Endpoint
The system MUST accept quick-action parameters and return an updated plan payload. When a provider key is present it SHALL invoke the AI provider; otherwise it SHALL fall back to a deterministic mock. The endpoint MUST now update the per-device generation store: set status to `pending` before invoking the provider, persist the resulting plan + metadata when successful, and reset status/error messages appropriately.

#### Scenario: Status transitions to pending
- **GIVEN** a valid generation request
- **WHEN** the server begins processing it
- **THEN** it immediately records `{ state: 'pending', submittedAt=now }` in the store so any concurrent snapshot reflects the in-flight status

#### Scenario: Successful generation persists plan
- **GIVEN** the provider returns a valid `TodayPlan`
- **WHEN** the route completes
- **THEN** the plan (with IDs) is stored against the DeviceToken, `generationStatus` resets to `idle`, and the response body matches the stored plan

#### Scenario: Provider failure retains context
- **GIVEN** the provider call throws or returns invalid JSON
- **WHEN** the route handles the error
- **THEN** it logs the failure, sets `generationStatus.state` to `error` with a human-readable message, keeps the last good plan available, and returns the deterministic mock plan (unless hosted BYOK enforcement blocks it)

### Requirement: Workout Logging Endpoint
Users MUST be able to mark a plan complete or quick-log an ad-hoc session, and the response refreshes recent activity.

#### Scenario: Log generated plan
- **GIVEN** a plan ID returned by the snapshot
- **WHEN** the client POSTs to `/api/workouts/{id}/log`
- **THEN** the server writes a `WorkoutSession`, timestamps `completedAt`, and returns the updated session summary list

#### Scenario: Quick log without plan
- **GIVEN** no active plan
- **WHEN** the user submits a quick log payload (focus, duration, note)
- **THEN** the server creates a manual session and returns it at the top of `recentSessions`

### Requirement: Preview Payload Persistence
The snapshot MUST include enough detail to render the workout preview offline within the same session.

#### Scenario: Preview fields shipped
- **GIVEN** a generated plan contains blocks/exercises
- **WHEN** the snapshot or generation endpoint returns the plan
- **THEN** it includes `blocks` data (title, focus, duration, exercises with prescription/detail) so the mobile app can render the preview screen without another fetch

#### Scenario: Cache invalidation after log
- **GIVEN** a plan is logged via the logging endpoint
- **WHEN** the client requests a new snapshot
- **THEN** `plan` becomes `null` (or next generated plan), and the completed session appears in `recentSessions`

