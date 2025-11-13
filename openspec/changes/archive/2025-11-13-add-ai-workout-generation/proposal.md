## Why
We currently return a static mock plan when the user taps Generate. To deliver a convincing MVP and de-risk integration, we will wire the server’s generation endpoint to a real AI provider while preserving today’s UX and keeping a safe mock fallback.

## What Changes
- Server: Add a minimal AI generation utility that calls the provider and returns a `TodayPlan` validated by shared Zod schemas.
- Server: Update `POST /api/workouts/generate` to use AI when a key is present (BYOK header or env var), otherwise fall back to the mock response derived from the request.
- Server: Keep existing error model and add clear fallback behavior on provider failures (invalid output, network errors).
- Mobile (optional): Allow passing a BYOK key via header for self-hosted users; keep current flow otherwise.
- Tests: Cover happy-path AI generation, missing key in hosted mode, invalid provider output fallback, and validation errors.

## Impact
- Specs: `home-data` capability — modifies the Generation requirement to define AI invocation, BYOK header, and fallback semantics.
- Code: `apps/server` generation route and a new server generator utility; optional small change in `apps/mobile` API client to send BYOK header.
- Operations: Uses `OPENAI_API_KEY` or a BYOK header (`x-openai-key`) for provider auth; no database changes.

