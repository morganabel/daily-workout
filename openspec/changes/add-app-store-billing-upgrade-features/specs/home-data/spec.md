## MODIFIED Requirements

### Requirement: Workout Generation Endpoint

The system MUST accept quick-action parameters and route the generation request to a selectable AI provider (OpenAI or Gemini) using either a managed key or BYOK. It SHALL validate structured output against `TodayPlan`, update per-device generation status before and after the call, and fall back to a deterministic mock when no key or a provider error occurs (except when hosted mode requires BYOK). In hosted mode, entitlement policy MUST be enforced before provider invocation; over-limit requests MUST return `QUOTA_EXCEEDED` so clients can route users to upgrade flows. BYOK requests bypass entitlement quota checks (users providing their own keys are self-funding inference costs); platform-level rate limiting is a separate concern outside this spec.

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

#### Scenario: Hosted entitlement limit exceeded

- **GIVEN** `EDITION=HOSTED` and policy evaluation determines the user is over their included allowance and the request does not include BYOK keys
- **WHEN** the client requests generation
- **THEN** the server responds with `{ code: 'QUOTA_EXCEEDED' }` (and optional upgrade metadata) so the client can open an upgrade flow

#### Scenario: Quota denial bypasses provider invocation

- **GIVEN** policy evaluation fails with `QUOTA_EXCEEDED`
- **WHEN** the generation handler processes the request
- **THEN** it does not invoke any model provider and records an error status for the current generation attempt

#### Scenario: BYOK request bypasses entitlement quota

- **GIVEN** `EDITION=HOSTED` and the user has exceeded their included allowance but provides a valid BYOK key
- **WHEN** the client requests generation
- **THEN** the server skips the entitlement policy check and proceeds with generation using the BYOK key
