## MODIFIED Requirements

### Requirement: Home Snapshot Endpoint

**Reason**: We are moving to a local-first architecture where the home screen state is derived from the local database, not a server snapshot.
**Migration**: The endpoint will be deprecated or repurposed for sync only. The client will no longer call this on load.

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

## ADDED Requirements

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
