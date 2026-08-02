# Workout Agent CE

Workout Agent CE is the open-source community edition of a daily workout planner. It ships with a Next.js backend and an Expo mobile app that calls AI providers (OpenAI, Gemini, or OpenRouter) to generate personalized plans.

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
4. Provide an AI key either via environment variables (see below) or BYOK from the app’s Launch → Advanced screen.

## Common scripts

- `npm run lint` – Lint all projects
- `npm run test` – Run all configured tests
- `npm run build` – Build server and mobile apps
- `npm run start` – Start the Next.js API in dev mode
- `npm run dev:server:db` – Start Postgres (Docker) + Next.js with Better Auth enabled
- `npm run db:migrate` – Apply Drizzle migrations (Better Auth tables) to the local Postgres
- `npm run db:down` – Stop Postgres
- `npm run validate:generation-scenarios` – Validate the curated workout-generation scenario corpus
- `npm run evaluate:generation -- --provider fixture --limit 10` – Run the evaluation workflow and write review reports

## Environment configuration

Create a `.env` file (or `.env.local` for Next.js) using the template below:

```
# Default provider when BYOK headers are missing
AI_PROVIDER=openai
OPENAI_API_KEY=
GEMINI_API_KEY=
OPENROUTER_API_KEY=

# Defaults; override these only when intentionally changing models
OPENAI_MODEL=gpt-5.6-luna
OPENAI_PLANNER_MODEL=gpt-5.6-luna
OPENROUTER_MODEL=deepseek/deepseek-v4-flash-0731
OPENROUTER_PLANNER_MODEL=deepseek/deepseek-v4-flash-0731
OPENROUTER_TIMEOUT_MS=60000

# Hosted mode toggles an HTTP 402 BYOK_REQUIRED response if no key is available
EDITION=CE

# Hosted billing (RevenueCat + entitlement gating)
HOSTED_BILLING_ENABLED=false
HOSTED_SHOW_UPGRADE_UI=true
HOSTED_FREE_GENERATION_LIMIT=25
HOSTED_PRO_GENERATION_LIMIT=1000
HOSTED_QUOTA_WINDOW_DAYS=30
REVENUECAT_DEFAULT_OFFERING_ID=
REVENUECAT_WEBHOOK_SECRET=
REVENUECAT_ALLOW_UNSIGNED_WEBHOOKS=false

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

# Mobile RevenueCat SDK
EXPO_PUBLIC_REVENUECAT_API_KEY=

# Better Auth (optional; enabled automatically when DATABASE_URL is set)
DATABASE_URL=postgres://user:password@localhost:5432/workout_agent
BETTER_AUTH_SECRET=dev-secret-dev-secret-dev-secret-dev-secret
BETTER_AUTH_URL=http://localhost:3000
```

- Server BYOK headers: `x-ai-provider`, `x-openai-key`, `x-gemini-key`, or `x-ai-key` (generic fallback). OpenRouter uses `x-ai-provider: openrouter` with `x-ai-key`. When using `x-ai-key`, always send `x-ai-provider` to specify which provider to route to.
- If `EDITION=HOSTED` and no key is available for the chosen provider, `/api/workouts/generate` responds with `{ code: 'BYOK_REQUIRED' }` (HTTP 402).
- When no key is present in CE mode, configure a server key or add BYOK in the app before requesting AI generation.

### Hosted paywall test setup

Use this command to boot the local server in hosted mode with billing and upgrade UI enabled, plus a very low free generation limit so the paywall is easy to trigger:

```bash
EDITION=HOSTED \
HOSTED_BILLING_ENABLED=true \
HOSTED_SHOW_UPGRADE_UI=true \
HOSTED_FREE_GENERATION_LIMIT=1 \
HOSTED_PRO_GENERATION_LIMIT=1000 \
HOSTED_QUOTA_WINDOW_DAYS=30 \
OPENAI_API_KEY=sk-your-managed-test-key \
EXPO_PUBLIC_BACKEND_URL=http://localhost:3000 \
npm run dev:server:db
```

BYOK requests bypass hosted quota because the user funds inference directly. To exercise the quota-to-paywall path, use a server-managed key such as `OPENAI_API_KEY`, `GEMINI_API_KEY`, or `OPENROUTER_API_KEY` and do not configure a BYOK key in the app.

The hosted billing runtime in this repository is intended for local/test flows and deployment-specific swapping. Production deployments should provide durable quota, entitlement, and RevenueCat synchronization implementations.

## Running tests and lint checks

Use Nx targets to keep the workspace healthy:

- Unit tests for shared contracts: `npx nx test @workout-agent/shared`
- Lint the Next.js API: `npx nx lint server`
- Lint the Expo app: `npx nx lint mobile`

## Workout generation evaluation

Use the scenario-driven evaluator to review many backend inputs quickly:

- Fixture/plumbing run: `npm run evaluate:generation -- --provider fixture --limit 12`
- Live OpenAI run: `npm run evaluate:generation -- --provider openai --runs 2 --tag regeneration`
- Multi-provider comparison: `npm run evaluate:generation -- --provider all --scenario regen-too-hard-bodyweight`

The evaluator writes three report formats to `reports/generation-evaluation/<timestamp>/`:

- `report.html` - the visual review surface for fast founder inspection
- `report.json` - structured output that is easy to feed into another AI model
- `report.jsonl` - one-entry-per-line output that is ideal for bulk AI review or downstream scripting
- `report.md` - a compact text summary for quick sharing or diffing

Notes:

- In `CE`, live providers without configured keys warn and fail with `AI_PROVIDER_NOT_CONFIGURED`; use `--provider fixture` only for explicit plumbing checks.
- In `HOSTED`, missing keys warn that runs are expected to fail with BYOK requirements.
- The evaluator reuses the real generation handler, so request validation, context merging, provider routing, and configuration errors match the production flow.
- The report explicitly calls out fixture-only runs vs mixed/live coverage so it is harder to mistake plumbing validation for real model evaluation.

## Two-stage planner notes

The generation flow now supports an optional stage-1 planner pass before the final workout-generation call.

- Activation is ambiguous-only in v1. The extra planner call is considered for Smart focus, recent-session plus upcoming-event conflicts, dense free-form notes, and regeneration requests with feedback.
- Stage 1 is advisory only. Hard constraints such as equipment, contraindications, avoid lists, and planner-safe candidate filtering remain server-owned.
- Disable the feature with `ENABLE_STAGE_ONE_PLANNER=false` to force the legacy single-pass path for comparison or rollback.
- OpenAI uses `gpt-5.6-luna` for both planning and final generation by default. OpenRouter uses `deepseek/deepseek-v4-flash-0731` for both phases. Gemini retains `gemini-3.1-flash-lite` for planning and `gemini-3.5-flash` for final generation. Each default can be overridden with its corresponding `*_MODEL` or `*_PLANNER_MODEL` variable.
- Direct OpenAI regeneration can reuse stored response continuity. Gemini and OpenRouter rebuild regeneration context from the baseline workout and feedback instead.
- In `HOSTED`, eligible requests may incur an extra provider call and extra latency because stage 1 runs before stage 2. In `CE`, the staged path follows the same provider-configuration requirements as normal generation.

For staged-vs-single-pass comparisons, run the evaluator twice against the same live slice, once with the default config and once with stage 1 disabled:

- Staged: `npm run evaluate:generation -- --provider openai --tag smart-focus --tag regeneration`
- Single-pass: `ENABLE_STAGE_ONE_PLANNER=false npm run evaluate:generation -- --provider openai --tag smart-focus --tag regeneration`

When keys are available, use the HTML and JSON reports to compare hard-check deltas, stage-1 usage rate, and stage-1/stage-2 latency splits.

## API surface

- `GET /api/meta` → server capabilities (auth methods, protocol version). Does not require auth.
- `POST /api/workouts/generate` → generates a `TodayPlan` using the selected provider; respects BYOK headers. In CE mode, requests without a configured provider key return `AI_PROVIDER_NOT_CONFIGURED` unless a local catalog workout can satisfy the request.

## Current limitations before going public

- DB-backed auth is still early: local dev uses Postgres via Docker and Better Auth sessions; persistence beyond auth tables is still limited.
- Server-side workout logging/persistence is not implemented; the mobile app uses local persistence for Home state, workout versions, quick logs, and recent activity.
- Several API handlers contain TODOs for ownership checks and persistence—review before relying on them in production.

## License & Ownership

Copyright © 2024 OpenVibe Labs LLC. All rights reserved.

This project (Workout Agent CE) is licensed under the [GNU Affero General Public License v3.0 (AGPLv3)](./LICENSE).

**OpenVibe Labs LLC** retains the copyright to the source code. The Community Edition is open-source, but OpenVibe Labs LLC reserves the right to offer this software (and its extensions, such as billing, subscriptions, and metering) under other license terms, including proprietary commercial licenses.

If you are interested in a commercial license, partnership, or building proprietary extensions that do not comply with the AGPLv3, please contact OpenVibe Labs LLC.
