## ADDED Requirements
### Requirement: BYOK Provider Selection
The mobile app MUST let users choose which AI provider (OpenAI or Gemini) to use for workout generation, store the BYOK key per provider, and send the correct headers while keeping legacy OpenAI-only flows working.

#### Scenario: Provider selection and key capture
- **GIVEN** the user opens the BYOK/config sheet
- **WHEN** they pick a provider (OpenAI or Gemini) and enter a key
- **THEN** the app stores the provider choice and key securely and marks them as the active provider for future generations

#### Scenario: Requests include provider headers
- **GIVEN** a provider + key has been configured
- **WHEN** the app calls `/api/workouts/generate`
- **THEN** it sends `x-ai-provider` with the chosen provider and the matching key header (`x-ai-key` or provider-specific alias), so the server uses that provider

#### Scenario: Legacy OpenAI key still works
- **GIVEN** an existing user only has an OpenAI key saved from the old flow
- **WHEN** they generate a workout without reconfiguring
- **THEN** the app defaults to provider=openai and sends `x-openai-key`, so the request succeeds without prompting

#### Scenario: Invalid provider feedback
- **GIVEN** the server responds with `INVALID_PROVIDER`
- **WHEN** the app receives the error
- **THEN** it surfaces an inline message in the BYOK sheet and keeps staged values so the user can correct the provider choice
