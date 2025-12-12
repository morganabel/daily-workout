# home-data Specification

## Purpose

TBD - created by archiving change add-mobile-home-data-pipeline. Update Purpose after archive.
## Requirements
### Requirement: Home Snapshot Endpoint

The backend MUST expose a single authenticated endpoint that returns today's plan, quick-action presets, and the last three session summaries. Snapshot responses SHALL now include a `generationStatus` object describing the latest generation attempt (`state: 'idle' | 'pending' | 'error'`, `submittedAt`, optional `etaSeconds` + `message`) so the client can mirror pending/error states even if the plan is still the previous one.

**Reason**: We are moving to a local-first architecture where the home screen state is derived from the local database, not a server snapshot.
**Migration**: The endpoint will be deprecated or repurposed for sync only. The client will no longer call this on load.

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

The system MUST accept quick-action parameters and route the generation request to a selectable AI provider (OpenAI or Gemini) using either a managed key or BYOK. It SHALL validate structured output against `TodayPlan`, update per-device generation status before and after the call, and fall back to a deterministic mock when no key or a provider error occurs (except when hosted mode requires BYOK).

#### Scenario: Status transitions to pending

- **GIVEN** a valid generation request
- **WHEN** the server begins processing it
- **THEN** it immediately records `{ state: 'pending', submittedAt=now }` in the store so any concurrent snapshot reflects the in-flight status

#### Scenario: Successful generation persists plan

- **GIVEN** the selected provider returns a valid `TodayPlan`
- **WHEN** the route completes
- **THEN** the plan (with IDs) is stored against the DeviceToken, `generationStatus` resets to `idle`, and the response body matches the stored plan

#### Scenario: Provider failure retains context

- **GIVEN** the provider call throws or returns invalid JSON
- **WHEN** the route handles the error
- **THEN** it logs the failure, sets `generationStatus.state` to `error` with a human-readable message, keeps the last good plan available, and returns the deterministic mock plan (unless hosted BYOK enforcement blocks it)

#### Scenario: Default provider selection

- **GIVEN** no provider override is sent
- **WHEN** the server handles generation
- **THEN** it chooses the provider from server config (`AI_PROVIDER`, defaulting to OpenAI) and applies per-provider model/base defaults before invoking the call

#### Scenario: BYOK provider override

- **GIVEN** the client sends `x-ai-provider: gemini` plus a BYOK key via `x-ai-key` or `x-gemini-key`
- **WHEN** the request is processed
- **THEN** the server uses the Gemini provider with that key (ignoring any OpenAI env key) and returns the validated `TodayPlan`

#### Scenario: Backward-compatible OpenAI BYOK

- **GIVEN** the client only sends `x-openai-key`
- **WHEN** the request is processed
- **THEN** the server infers `provider=openai` and uses that key without requiring `x-ai-provider`, preserving existing clients

#### Scenario: Unsupported provider rejected

- **GIVEN** a request declares `x-ai-provider` outside the supported list
- **WHEN** the server validates the request
- **THEN** it returns `400 INVALID_PROVIDER`, does not invoke any provider, and the generation status records an error state

#### Scenario: Hosted edition without key

- **GIVEN** `EDITION=HOSTED` and no key for the chosen provider (neither env nor BYOK)
- **WHEN** the client requests generation
- **THEN** the server responds with `{ code: 'BYOK_REQUIRED' }` instead of issuing a mock plan

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

### Requirement: Local Data Persistence

The mobile application MUST persist all user data (workouts, history, preferences) locally using WatermelonDB.

#### Scenario: Offline data access

- **GIVEN** the device has no network connection
- **WHEN** the user opens the app
- **THEN** the Home Screen loads the current plan and history from the local database instantly

#### Scenario: Data persistence across restarts

- **GIVEN** the user logs a workout and closes the app
- **WHEN** the user reopens the app
- **THEN** the logged workout appears in the history list

### Requirement: Workout History Archiving and Deletion
The home data layer SHALL support archiving (soft delete) and permanent deletion of workout sessions so users can clean up test data and prevent noisy sessions from influencing future plans. Archived sessions remain stored but are excluded from default recency-based views and from any history passed into the AI `GenerationContext`.

#### Scenario: Archive workout session
- **GIVEN** a completed workout session appears in `recentSessions` on the Home snapshot
- **WHEN** the client sends a request to archive that session
- **THEN** the system marks the session as archived, removes it from `recentSessions` and other default snapshot activity lists, and ensures it is not included in any future `GenerationContext.recentSessions`

#### Scenario: Unarchive workout session
- **GIVEN** a workout session has previously been archived
- **WHEN** the client sends a request to unarchive that session
- **THEN** the system clears the archived flag so the session becomes eligible again for inclusion in history lists and `GenerationContext.recentSessions` (subject to existing recency limits)

#### Scenario: Delete workout session
- **GIVEN** a workout session exists in storage (archived or not)
- **WHEN** the client sends a request to delete that session
- **THEN** the system permanently removes the session from the backing store (or marks it as deleted such that it is never returned), and it no longer appears in snapshot responses, history lists, or `GenerationContext.recentSessions`

#### Scenario: History queries exclude archived by default
- **GIVEN** the backend (or local-only data layer) powers any endpoint or query that returns workout history or recent activity
- **WHEN** the client requests the default history (without an explicit "include archived" flag)
- **THEN** only non-archived, non-deleted sessions are returned so that archived test data does not clutter the UI or model context

