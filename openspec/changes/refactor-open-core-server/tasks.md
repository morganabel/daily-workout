## 1. Design
- [ ] 1.1 Define the dependency direction (`server-core` → interfaces only; implementations live in adapter packages) and confirm no cycles.
- [ ] 1.2 Specify the public API surface for the core (handler factories + dependency types) and for the default LLM router package.
- [ ] 1.3 Document private-repo (submodule) consumption expectations: build outputs, package exports, and wiring entry points.

## 2. Package Scaffolding
- [ ] 2.1 Create `packages/server-core` with build/test/lint/typecheck targets consistent with existing `packages/shared`.
- [ ] 2.2 Create `packages/server-ai` (or equivalent) to host OpenAI/Gemini providers, prompts, and the transformer as an implementation of `ModelRouter`.
- [ ] 2.3 Add minimal READMEs describing how CE and hosted Next apps import and compose these packages.

## 3. Extract Core + DI
- [ ] 3.1 Move request parsing + shared route logic into `packages/server-core`, exposing handler factories for:
  - `GET /api/home/snapshot`
  - `POST /api/workouts/generate`
  - `POST /api/workouts/:id/log`
- [ ] 3.2 Introduce interfaces in `packages/server-core` for `AuthProvider`, `GenerationStore`, `ModelRouter`, `UsagePolicy` (with optional `getEntitlements`), and `MeteringSink`.
- [ ] 3.3 Export `PROTOCOL_VERSION` constant from `packages/server-core` for future `/meta` endpoint compatibility.
- [ ] 3.4 Remove reliance on global registries/side effects (e.g., provider init) by injecting concrete instances.
- [ ] 3.5 Ensure the core does not read `process.env` directly; pass config from the wiring layer.

## 4. Extract Shareable LLM Implementation
- [ ] 4.1 Move `apps/server/src/lib/ai-providers/*`, `apps/server/src/lib/llm-transformer.ts`, prompts, and any tightly-coupled utilities into `packages/server-ai`.
- [ ] 4.2 Ensure package boundaries avoid cycles (keep transformer + ID attachment utilities co-located).
- [ ] 4.3 Expose a default `ModelRouter` implementation that both OSS and hosted can reuse without changes to prompts/provider logic.
- [ ] 4.4 (Optional) Move server-only LLM schemas/types out of `packages/shared` into `packages/server-ai` so `shared` remains truly cross-platform.

## 5. Wire `apps/server` (OSS)
- [ ] 5.1 Replace route implementations with thin adapters that call `server-core` handler factories.
- [ ] 5.2 Provide OSS default deps (stub auth, in-memory generation store, default `ModelRouter`) in the wiring layer.
- [ ] 5.3 Preserve existing behavior and error semantics as defined by current route tests and the `home-data` specification.

## 6. BYOK Safety + Policy Hooks
- [ ] 6.1 Enforce “key-as-secret” handling: no logging/persistence; redact in errors/telemetry.
- [ ] 6.2 Ensure no client-controlled upstream base URLs; keep base URL configurable only server-side.
- [ ] 6.3 Add policy hook points for rate limiting/quota gating and metering recording around model calls (OSS defaults are no-op).

## 7. Verification
- [ ] 7.1 Update/move unit tests alongside extracted code and keep route tests passing.
- [ ] 7.2 Run Nx tests/typecheck for affected projects (`server`, `server-core`, `server-ai`, `shared`).
- [ ] 7.3 Manual smoke: mobile app still generates/logs against local server; BYOK headers still work; hosted-mode BYOK remains supported.
