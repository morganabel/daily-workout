# home-data Specification

## Purpose
Define the aggregated data contract that powers the mobile home + preview experience, including endpoints for fetching today's plan, generating workouts, and logging sessions.

## ADDED Requirements
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
The system MUST accept staged quick-action parameters and return an updated plan payload.

#### Scenario: Generate with presets
- **GIVEN** a request body containing time, focus, equipment, energy, and optional backfill flags
- **WHEN** the client POSTs to `/api/workouts/generate`
- **THEN** the server validates inputs, triggers AI/mock generation, stores the plan, and responds with the shared `TodayPlan` object

#### Scenario: Offline/BYOK rejection
- **GIVEN** the server detects missing provider credentials (hosted) or the user is over quota
- **THEN** the endpoint responds with a structured error `{ code: 'BYOK_REQUIRED' | 'QUOTA_EXCEEDED', message, retryAfter? }`

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
