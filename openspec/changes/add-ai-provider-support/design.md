## Context
The current system hardcodes OpenAI usage. We need to support multiple providers (Gemini, DeepSeek, Mistral, Groq) both for server-side configuration (Environment Variables) and client-side BYOK (Headers).

## Decisions
- **Provider Abstraction**: Create a generic `AiProvider` interface with a `generatePlan` method.
- **Provider Registry**: A static registry mapping provider IDs ('openai', 'gemini', 'deepseek', 'mistral', 'groq') to their implementations and configuration (e.g., base URLs).
- **Google Gen AI SDK**: Use `@google/genai` for Gemini support, as it unifies Vertex AI and AI Studio access.
- **Configuration Precedence**:
  1. Header `x-ai-provider` (BYOK)
  2. Environment variable `AI_PROVIDER` (Server Config)
  3. Default to 'openai'
- **BYOK Headers**:
  - `x-ai-provider`: Provider ID (e.g., 'gemini', 'deepseek').
  - `x-openai-key`: Maintained for backward compatibility (implies provider='openai' if `x-ai-provider` missing).
  - `x-ai-key`: Generic key header for other providers (or reusing `x-openai-key` if we want to keep it simple, but `x-ai-key` is cleaner). *Decision: Use `x-openai-key` as the generic key carrier for OpenAI-compatible providers to minimize client changes, but for Gemini maybe use a distinct header or just `x-ai-key`. Let's use `x-ai-key` for new providers and fallback to `x-openai-key` for OpenAI.*
  - **Correction**: To simplify mobile implementation, we can just use `x-ai-key` for everyone, but we must respect `x-openai-key` for existing installs.
- **Mobile UI**: A "Provider Settings" sheet replaces "BYOK" sheet. It has a dropdown for provider and an input for the key. Base URLs for known providers are hardcoded in the server registry, so the user doesn't need to enter them.

## Risks / Trade-offs
- **Gemini Response Format**: Gemini's JSON mode might behave differently than OpenAI's. We need to ensure the schema validation is robust. `@google/genai` supports structured output which should help.
- **Model Capabilities**: Smaller models (like some on Groq/Mistral) might struggle with the complex workout plan schema. Users selecting them accept this risk.

## Open Questions
- None.
