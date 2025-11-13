## 1. Implementation
- [x] 1.1 Add server generator util `apps/server/src/lib/generator.ts` that:
  - Calls the AI provider with strict “JSON-only” instructions
  - Parses/cleans content, validates with `todayPlanSchema`, ensures `source: 'ai'` and stable IDs
  - Throws typed errors on invalid output or network failures
- [x] 1.2 Update `POST /api/workouts/generate` to:
  - Prefer `x-openai-key` header, else `process.env.OPENAI_API_KEY`
  - When a key is present, call the generator; otherwise return a deterministic mock plan derived from request inputs
  - Harden error handling + fallback paths so the endpoint always returns either a valid plan or a structured error
- [x] 1.3 (Optional) Mobile BYOK:
  - Store BYOK key in SecureStore and send as `x-openai-key` header when present
  - Do not change default flow for users without a key
- [x] 1.4 Logging & observability:
  - Log provider failures and schema-parse issues (avoid leaking secrets)
- [x] 1.5 Enrich generation requests with client context (include quick-action choices + recent history notes from mobile)

## 2. Tests
- [x] 2.1 Unit tests for generator (mock provider): valid JSON, invalid JSON, network error
- [x] 2.2 Route tests: key present happy path, missing key in HOSTED → `BYOK_REQUIRED`, fallback in OSS/dev, validation errors
- [ ] 2.3 Mobile (if BYOK header added): API client header logic unit test

## 3. QA
- [ ] 3.1 Manual
  - Generate with env key
  - Generate with BYOK header
  - Generate without any key (fallback mock)
  - Provider invalid output (fallback)
  - Hosted mode without key (`BYOK_REQUIRED`)
- [ ] 3.2 Run: `nx run-many --target=test --projects=server,mobile` and `npm run dev`

## 4. Docs
- [x] 4.1 Add README snippet on BYOK header vs env and local run instructions
