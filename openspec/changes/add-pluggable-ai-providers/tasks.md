## 1. Implementation
- [ ] 1.1 Introduce an AI provider interface + registry; refactor generator to depend on it while keeping OpenAI behavior unchanged by default.
- [ ] 1.2 Add Gemini provider using `@google/genai`, including structured output validation and sensible default model/base env vars.
- [ ] 1.3 Update `/api/workouts/generate` to accept provider selection + BYOK headers, enforce supported providers, and keep mock/402 fallback semantics.
- [ ] 1.4 Extend shared contracts to carry optional provider/model metadata and wire it through server + mobile request payloads.
- [ ] 1.5 Update mobile BYOK storage/UI to let users pick provider and send the right headers; keep legacy `x-openai-key` flow working.
- [ ] 1.6 Add tests for provider selection (server + mobile), refresh .env example/README, and ensure CI passes.
