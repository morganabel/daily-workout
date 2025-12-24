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
2. Start the backend: `npm run start` (Next.js on port 3000)
3. Start the mobile app: `npm run dev:mobile` (Expo) and press `i`/`a` for iOS/Android, or use `npx nx run mobile:run-ios` for a simulator build.
4. Provide an AI key either via environment variables (see below) or BYOK from the app’s Home → BYOK screen.

## Common scripts
- `npm run lint` – Lint all projects
- `npm run test` – Run all configured tests
- `npm run build` – Build server and mobile apps
- `npm run start` – Start the Next.js API in dev mode

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

# Mobile app API target
EXPO_PUBLIC_BACKEND_URL=http://localhost:3000
```

- Server BYOK headers: `x-ai-provider`, `x-openai-key`, `x-gemini-key`, or `x-ai-key` (generic fallback). When using `x-ai-key`, also send `x-ai-provider` to specify which provider to route to.
- If `EDITION=HOSTED` and no key is available for the chosen provider, `/api/workouts/generate` responds with `{ code: 'BYOK_REQUIRED' }` (HTTP 402).
- When no key is present in CE mode, the server falls back to deterministic mock plans so the app still works for demos.

## Running tests and lint checks
Use Nx targets to keep the workspace healthy:

- Unit tests for shared contracts: `npx nx test @workout-agent/shared`
- Lint the Next.js API: `npx nx lint server`
- Lint the Expo app: `npx nx lint mobile`

## API surface
- `GET /api/home/snapshot` → returns today’s plan (or null), quick actions, and recent sessions. Requires `Authorization: Bearer <DeviceToken>`.
- `POST /api/workouts/generate` → generates a `TodayPlan` using the selected provider; respects BYOK headers and falls back to mock data in CE mode.
- `POST /api/workouts/{id}/log` → records a workout session summary (currently stubbed pending persistence).

## Current limitations before going public
- Auth is DeviceToken-only and backed by in-memory stubs—no user database yet.
- Workout logging/persistence is not implemented; snapshot recent sessions are mocked.
- Several API handlers contain TODOs for ownership checks and persistence—review before relying on them in production.

## License & Ownership

Copyright © 2024 OpenVibe Labs LLC. All rights reserved.

This project (Workout Agent CE) is licensed under the [GNU Affero General Public License v3.0 (AGPLv3)](./LICENSE).

**OpenVibe Labs LLC** retains the copyright to the source code. The Community Edition is open-source, but OpenVibe Labs LLC reserves the right to offer this software (and its extensions, such as billing, subscriptions, and metering) under other license terms, including proprietary commercial licenses.

If you are interested in a commercial license, partnership, or building proprietary extensions that do not comply with the AGPLv3, please contact OpenVibe Labs LLC.
