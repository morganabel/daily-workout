## MODIFIED Requirements
### Requirement: Workout Generation Endpoint
The system MUST accept quick-action parameters and return an updated plan payload. It SHALL select an AI provider based on the `x-ai-provider` header (BYOK) or the `AI_PROVIDER` environment variable, defaulting to OpenAI. When a valid provider key is present (via header or env), it SHALL invoke the selected provider; otherwise it SHALL fall back to a deterministic mock. The endpoint MUST update the per-device generation store: set status to `pending` before invoking the provider, persist the resulting plan + metadata when successful, and reset status/error messages appropriately.

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

#### Scenario: Select provider from header
- **GIVEN** the request includes `x-ai-provider: deepseek` and `x-ai-key: <key>`
- **WHEN** the generation starts
- **THEN** the system routes the request to the DeepSeek provider using the provided key
