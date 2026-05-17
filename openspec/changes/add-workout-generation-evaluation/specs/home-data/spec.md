## MODIFIED Requirements

### Requirement: Workout Generation Endpoint

The system MUST accept quick-action parameters and route the generation request to a selectable AI provider (OpenAI or Gemini) using either a managed key or BYOK. It SHALL validate structured output against `TodayPlan`, update per-device generation status before and after model calls, and return explicit provider configuration errors when no usable provider credentials are available. The generation flow MUST also remain reusable by evaluation tooling: the same request parsing, context merge, provider selection, and configuration semantics used in production generation SHALL be exercisable with fixed scenario inputs, and any execution metadata exposed for evaluation MUST be sanitized so secrets are never returned or persisted in reports.

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
- **THEN** it logs the failure, sets `generationStatus.state` to `error` with a human-readable message, keeps the last good plan available, and returns a structured generation error without fabricating a workout plan

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
- **THEN** the server responds with `{ code: 'BYOK_REQUIRED' }` instead of issuing a workout plan

#### Scenario: Fixed evaluation scenario reuses production semantics

- **GIVEN** evaluation tooling submits a fixed scenario request against the generation flow
- **WHEN** the server processes that request
- **THEN** it uses the same validation, context merge, provider-selection, and fallback rules as normal production generation rather than a separate evaluation-only code path for workout creation

#### Scenario: Evaluation-visible metadata is sanitized

- **GIVEN** evaluation tooling captures execution metadata for a generation run
- **WHEN** metadata is returned or written to an evaluation report
- **THEN** it includes only sanitized values such as provider name, response identifiers, schema version, request shape, and generation outcome, and excludes API keys or other secrets

#### Scenario: Regeneration scenarios use the same endpoint

- **GIVEN** evaluation tooling exercises regeneration with `previousResponseId`, feedback, and request overrides
- **WHEN** the server processes that request
- **THEN** it uses the same regeneration path and prompt-construction behavior as production requests so evaluation results reflect real regeneration behavior
