## MODIFIED Requirements
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

