## Context
- Server generation currently hard-codes OpenAI via `openai` SDK and only reads base URL/model from env. No way to pick Gemini or any other provider.
- BYOK in the mobile app only stores a single OpenAI key and always sends `x-openai-key`, so users cannot choose a different provider or model.
- Gemini now ships an official JavaScript SDK (`@google/genai`) with structured output support, making it feasible to add without custom HTTP plumbing.

## Goals / Non-Goals
- Goals: pluggable provider interface; support OpenAI and Gemini with env defaults; allow per-request provider + BYOK selection; keep deterministic mock fallback and hosted BYOK guardrails.
- Non-Goals: adding every provider; allowing arbitrary user-supplied base URLs (limit to known providers/env overrides); changing queueing/billing logic.

## Decisions
- Provider registry with keys `openai` and `gemini`; default comes from `AI_PROVIDER` (falls back to OpenAI).
- Request-level override via header `x-ai-provider` plus BYOK key headers: generic `x-ai-key` and provider-specific aliases `x-openai-key`/`x-gemini-key` for compatibility.
- OpenAI provider stays on Responses API + zod parsing; Gemini provider uses `@google/genai` with `responseMimeType: 'application/json'` and JSON schema derived from `llmTodayPlanSchema`.
- Per-provider env config: `OPENAI_MODEL`, `OPENAI_API_BASE`, `GEMINI_MODEL`, optional `GEMINI_API_BASE`; keys `OPENAI_API_KEY` / `GEMINI_API_KEY`. **Default Gemini model is `gemini-2.5-flash` (not 1.5).**
- Shared contract gains optional `provider` block `{ name: 'openai' | 'gemini'; model?: string }` to carry model overrides from the client.
- Unknown provider → 400 `INVALID_PROVIDER`; missing key in hosted edition → 402 `BYOK_REQUIRED`; provider error → mock fallback with logged status.

## Risks / Trade-offs
- Structured output fidelity differs between providers; need robust schema enforcement and explicit error messaging.
- Additional dependency (`@google/genai`) increases bundle size in server layer; acceptable for feature gain.
- Allowing client model overrides can increase cost—scope it to whitelisted providers/models and ignore invalid values.

## Migration Plan
- Keep legacy `x-openai-key` path working; map it to provider=openai when no `x-ai-provider` is sent.
- Add env sample + README guidance for Gemini keys/models.
- Ship server-side validation + tests before updating mobile UI to avoid broken requests during rollout.

## Open Questions
- Do we need to expose model selection in the UI or keep it server-side only?
- Should we allow custom base URLs for enterprise/self-hosted proxies if restricted to an allowlist?
