## Why
Users want to choose their preferred AI provider for workout generation, either to use a model they prefer (e.g., Gemini) or to use their own API keys for other providers (e.g., DeepSeek, Mistral) to reduce costs or access different capabilities. Currently, the system is hardcoded to OpenAI.

## What Changes
- Add support for multiple AI providers: OpenAI (default), Gemini (via `@google/genai`), and OpenAI-compatible providers (DeepSeek, Mistral, Groq).
- Update the mobile app to allow users to select a provider and enter their BYOK API key.
- Update the server to route requests to the selected provider based on headers or environment variables.
- Add configuration for new environment variables (`AI_PROVIDER`, `GOOGLE_GENAI_API_KEY`, etc.).

## Impact
- **Affected Specs**: `home-data` (Workout Generation Endpoint).
- **Affected Code**: `apps/server/src/lib/generator.ts`, `apps/server/src/app/api/workouts/generate/route.ts`, `apps/mobile/src/app/HomeScreen.tsx`, `apps/mobile/src/app/services/api.ts`.
- **Breaking Changes**: None. Backward compatibility for `x-openai-key` header will be maintained (mapped to OpenAI provider).
