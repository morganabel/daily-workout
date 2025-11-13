# home-data Specification

## Purpose
TBD - created by archiving change add-mobile-home-data-pipeline. Update Purpose after archive.
## Requirements
### Requirement: Home Snapshot Endpoint
The backend MUST expose a single authenticated endpoint that returns today's plan, quick-action presets, and the last three session summaries in one call.

#### Scenario: Successful response
- **GIVEN** a valid `DeviceToken`
- **WHEN** the client calls `GET /api/home/snapshot`
- **THEN** the server returns `{ plan|null, quickActions, recentSessions[≤3], isOfflineHint }` validated by shared Zod schemas

#### Scenario: Mock fallback
- **GIVEN** no generated plan exists yet
- **THEN** the endpoint returns `plan: null`, keeps quick actions at defaults, and surfaces an empty history message while still returning `200`

### Requirement: Workout Generation Endpoint
The system MUST accept staged quick-action parameters and return an updated plan payload. When a provider key is present, the server SHALL invoke the AI provider; otherwise it SHALL fall back to a deterministic mock derived from the request inputs. Persistence is not required for the MVP; the endpoint MAY return the plan without storing it.

#### Scenario: Generate with presets
- **GIVEN** a request body containing time, focus, equipment, energy, and optional backfill flags
- **WHEN** the client POSTs to `/api/workouts/generate`
- **THEN** the server validates inputs, invokes the AI provider when a key is available or falls back to mock generation, and responds with the shared `TodayPlan` object

#### Scenario: BYOK header overrides env
- **GIVEN** the client sends `x-openai-key: <key>` and a valid body
- **WHEN** the server handles the request
- **THEN** the server uses that key for the provider call (not persisted), validates the JSON against `TodayPlan`, and returns the plan

#### Scenario: Invalid provider output → fallback
- **GIVEN** the AI provider responds with invalid or non-JSON output
- **WHEN** the server validates the response
- **THEN** the server logs the issue and returns a deterministic mock `TodayPlan` derived from the request inputs

#### Scenario: Offline/network error → fallback
- **GIVEN** a transient provider or network error
- **WHEN** the server cannot obtain a valid provider response
- **THEN** the server returns a deterministic mock `TodayPlan` derived from the request inputs (unless hosted BYOK applies)

#### Scenario: Hosted edition without a key
- **GIVEN** the server is in hosted mode and no provider key is available (no env key and no BYOK)
- **THEN** the endpoint responds with a structured error `{ code: 'BYOK_REQUIRED', message, retryAfter? }`

#### Scenario: Quota exceeded (reserved)
- **GIVEN** the provider or platform enforces a quota
- **WHEN** limits are exceeded
- **THEN** the endpoint MAY respond with `{ code: 'QUOTA_EXCEEDED', message, retryAfter }`

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

