## Why
OpenAI is hard-coded as the only LLM provider and the base URL comes solely from environment variables. We cannot switch the server to Gemini or let users choose a provider with their own key, which blocks BYOK flexibility and vendor choice.

## What Changes
- Add a pluggable AI provider abstraction with first-class OpenAI and Gemini implementations (using `@google/genai`).
- Introduce config + headers to select provider/model per request, with env defaults and backward-compatible OpenAI BYOK.
- Extend shared contracts and mobile BYOK flow so users can pick a provider, store the key, and send the right headers.
- Update tests, .env examples, and monitoring paths for provider-specific errors/fallbacks.

## Impact
- Affected specs: home-data, mobile-ui
- Affected code: server generator + `/api/workouts/generate`, shared contracts, mobile API client/BYOK UI, env samples/readme
