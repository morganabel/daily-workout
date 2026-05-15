# Workout Agent CE

Workout Agent CE is the open-source community edition of a daily workout planner. It ships with a Next.js backend and an Expo mobile app that calls AI providers (OpenAI or Gemini) to generate personalized plans.

## Tech stack

- Nx monorepo tooling
- Next.js API routes (server)
- Expo / React Native client
- TypeScript + Zod contracts
- Jest + Testing Library for tests
- ESLint, Prettier, and EditorConfig for consistency

## Repository layout

- `apps/server` – Next.js API routes that generate plans and serve home snapshot data.
- `apps/mobile` – Expo client that renders the plan, quick actions, and BYOK (bring-your-own-key) provider selection.
- `packages/shared` – Shared Zod schemas and helpers for requests/responses used by both apps.

## Quickstart

1. Install dependencies: `npm install`
2. Start the backend:
   - **Stub auth (no DB)**: `npm run start` (Next.js on port 3000)
   - **Better Auth + Postgres (recommended)**: `npm run dev:server:db`
3. Start the mobile app:
   - **Simulator/emulator**: `npm run dev:mobile` (Expo) and press `i`/`a`, or run `npx nx run mobile:run-ios` / `npx nx run mobile:run-android`.
   - **Physical device (dev build)**: set `EXPO_PUBLIC_BACKEND_URL` to a URL reachable from your phone (use your machine’s LAN IP for local dev), then run `npx nx run mobile:run-ios -- --device` or `npx nx run mobile:run-android -- --device`.
4. Provide an AI key either via environment variables (see below) or BYOK from the app’s Home → BYOK screen.

## Common scripts

- `npm run lint` – Lint all projects
- `npm run test` – Run all configured tests
- `npm run build` – Build server and mobile apps
- `npm run start` – Start the Next.js API in dev mode
- `npm run dev:server:db` – Start Postgres (Docker) + Next.js with Better Auth enabled
- `npm run db:migrate` – Apply Drizzle migrations (Better Auth tables) to the local Postgres
- `npm run db:down` – Stop Postgres
- `npm run validate:generation-scenarios` – Validate the curated workout-generation scenario corpus
- `npm run evaluate:generation -- --provider mock --limit 10` – Run the evaluation workflow and write review reports

## Environment configuration

Create a `.env` file (or `.env.local` for Next.js) using the template below:

```
# Default provider when BYOK headers are missing
AI_PROVIDER=openai
OPENAI_API_KEY=
GEMINI_API_KEY=

# Hosted mode toggles an HTTP 402 BYOK_REQUIRED response if no key is available
EDITION=CE

# Optional: use Vertex AI for Gemini
GOOGLE_GENAI_USE_VERTEXAI=false
GOOGLE_CLOUD_PROJECT=
GOOGLE_CLOUD_LOCATION=
#
# When GOOGLE_GENAI_USE_VERTEXAI=true, both GOOGLE_CLOUD_PROJECT and
# GOOGLE_CLOUD_LOCATION are required.

# Mobile app API target
# For a physical device, this must be reachable from the phone (use your machine’s LAN IP for local dev).
EXPO_PUBLIC_BACKEND_URL=http://localhost:3000

# Better Auth (optional; enabled automatically when DATABASE_URL is set)
DATABASE_URL=postgres://user:password@localhost:5432/workout_agent
BETTER_AUTH_SECRET=dev-secret-dev-secret-dev-secret-dev-secret
BETTER_AUTH_URL=http://localhost:3000
```

- Server BYOK headers: `x-ai-provider`, `x-openai-key`, `x-gemini-key`, or `x-ai-key` (generic fallback). When using `x-ai-key`, also send `x-ai-provider` to specify which provider to route to.
- If `EDITION=HOSTED` and no key is available for the chosen provider, `/api/workouts/generate` responds with `{ code: 'BYOK_REQUIRED' }` (HTTP 402).
- When no key is present in CE mode, the server falls back to deterministic mock plans so the app still works for demos.

## Running tests and lint checks

Use Nx targets to keep the workspace healthy:

- Unit tests for shared contracts: `npx nx test @workout-agent/shared`
- Lint the Next.js API: `npx nx lint server`
- Lint the Expo app: `npx nx lint mobile`

## Workout generation evaluation

Use the scenario-driven evaluator to review many backend inputs quickly:

- Mock/plumbing run: `npm run evaluate:generation -- --provider mock --limit 12`
- Live OpenAI run: `npm run evaluate:generation -- --provider openai --runs 2 --tag regeneration`
- Multi-provider comparison: `npm run evaluate:generation -- --provider all --scenario regen-too-hard-bodyweight`

The evaluator writes three report formats to `reports/generation-evaluation/<timestamp>/`:

- `report.html` - the visual review surface for fast founder inspection
- `report.json` - structured output that is easy to feed into another AI model
- `report.jsonl` - one-entry-per-line output that is ideal for bulk AI review or downstream scripting
- `report.md` - a compact text summary for quick sharing or diffing

Notes:

- In `CE`, live providers without configured keys automatically warn and fall back to mock behavior.
- In `HOSTED`, missing keys warn that runs are expected to fail with BYOK requirements.
- The evaluator reuses the real generation handler, so request validation, context merging, provider routing, and fallback semantics match the production flow.
- The report now explicitly calls out mock-only runs vs mixed/live coverage so it is harder to mistake plumbing validation for real model evaluation.

## Two-stage planner notes

The generation flow now supports an optional stage-1 planner pass before the final workout-generation call.

- Activation is ambiguous-only in v1. The extra planner call is considered for Smart focus, recent-session plus upcoming-event conflicts, dense free-form notes, and regeneration requests with feedback.
- Stage 1 is advisory only. Hard constraints such as equipment, contraindications, avoid lists, and planner-safe candidate filtering remain server-owned.
- Disable the feature with `ENABLE_STAGE_ONE_PLANNER=false` to force the legacy single-pass path for comparison or rollback.
- Planner model defaults are intentionally cheaper than the final generation model: `OPENAI_PLANNER_MODEL` defaults to `gpt-5.4-nano` and `GEMINI_PLANNER_MODEL` defaults to `gemini-3.1-flash-lite-preview`.
- In `HOSTED`, eligible requests may incur an extra provider call and extra latency because stage 1 runs before stage 2. In `CE`, the staged path still follows the same BYOK/mock-fallback rules as normal generation.

For staged-vs-single-pass comparisons, run the evaluator twice against the same live slice, once with the default config and once with stage 1 disabled:

- Staged: `npm run evaluate:generation -- --provider openai --tag smart-focus --tag regeneration`
- Single-pass: `ENABLE_STAGE_ONE_PLANNER=false npm run evaluate:generation -- --provider openai --tag smart-focus --tag regeneration`

When keys are available, use the HTML and JSON reports to compare hard-check deltas, stage-1 usage rate, and stage-1/stage-2 latency splits.

## API surface

- `GET /api/meta` → server capabilities (auth methods, protocol version). Does not require auth.
- `POST /api/workouts/generate` → generates a `TodayPlan` using the selected provider; respects BYOK headers and falls back to mock data in CE mode.
- `POST /api/workouts/{id}/log` → records a workout session summary (currently stubbed pending persistence).

## Current limitations before going public

- DB-backed auth is still early: local dev uses Postgres via Docker and Better Auth sessions; persistence beyond auth tables is still limited.
- Server-side workout logging/persistence is not implemented; the mobile app uses local persistence for Home state, workout versions, and recent activity.
- Several API handlers contain TODOs for ownership checks and persistence—review before relying on them in production.

## License & Ownership

Copyright © 2024 OpenVibe Labs LLC. All rights reserved.

This project (Workout Agent CE) is licensed under the [GNU Affero General Public License v3.0 (AGPLv3)](./LICENSE).

**OpenVibe Labs LLC** retains the copyright to the source code. The Community Edition is open-source, but OpenVibe Labs LLC reserves the right to offer this software (and its extensions, such as billing, subscriptions, and metering) under other license terms, including proprietary commercial licenses.

If you are interested in a commercial license, partnership, or building proprietary extensions that do not comply with the AGPLv3, please contact OpenVibe Labs LLC.
