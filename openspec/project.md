# Project Context (Updated for Open Source + Freemium Model)

## Purpose

🎯 **Mission**

An open-source, AI-powered workout companion that plans, adapts, and logs your workouts automatically — learning your preferences, performance, and schedule over time.
It should feel like a **personal trainer with memory**, not a static tracker.

💡 **Core Idea**

Automatic daily workouts, but if you don’t like those: “You just tell it what’s up — how you feel, what time you have, and what equipment is around — and it instantly generates a perfect workout for that moment.”

⚖️ **Core Philosophy: Radical Simplicity**

Workout planning and tracking is annoying — we fix that.
The app should make doing the right thing effortless:

- Generate a workout from a few quick taps (focus, time, equipment, intensity, constraints).
- One-tap logging via **Done** or a single phrase like “legs” or “elliptical for 30 minutes” when you just want to record completion.
- Quick-edit: check off sets, nudge weights/reps in-place.
- Voice/free-text logging that can be parsed into structure when you want details.
- Forgot to start? Backfill with a single tap to log that you did the thing.
- Every interaction should feel **fast, intuitive, and private-by-default**, with optional encrypted sync.

---

## Open Source & Hosting Philosophy

The project follows a **freemium open-core model**:

- 🧩 **Community Edition (CE)**

  - Fully open-source and self-hostable under the AGPL license.
  - Includes all workout logging, planning, and AI generation logic.
  - Works entirely offline or with a user-provided API key (e.g., OpenAI).
  - No artificial limits when self-hosted — usage and cost are entirely up to you.

- ☁️ **Hosted Edition (Managed Service)**

  - The default backend used by the App Store version.
  - Runs the same open-source backend but connects to our managed AI providers.
  - We pay inference costs — so usage is metered and limited under a **freemium model**.
  - Free users get a base allowance of AI-generated workouts per month.
  - Paid plans lift those limits or unlock higher-tier models and faster inference.

- Freemium tiers:

  - **Free:** core generation + basic history, generous AI allowance on lighter models, BYOK always.
  - **Paid:** higher-tier models, faster queues, optional plugins/analytics — real value, not artificial restrictions.

- 🏢 **Commercial Add-Ons (future)**

  - Built on top of the same open codebase for advanced analytics, data sync, or team plans.
  - Introduced only if they genuinely enhance value — not to restrict the open-source core.

### Hosting Options

| Mode                       | Description                                                     | Backend URL                    |
| -------------------------- | --------------------------------------------------------------- | ------------------------------ |
| **Local Mode**             | Runs entirely on-device with local storage and your own API key | none                           |
| **Self-Hosted Mode**       | Run the open-source backend yourself (Docker or npm)            | your own base URL              |
| **Managed Mode (Default)** | App Store version using our hosted backend (freemium limits)    | `https://api.workoutagent.com` |

- Local + API key mode is **fully functional and private**.
- Self-hosting is easy and free beyond your own infra and API costs.
- The Managed (hosted) version monetizes by usage — similar to most AI apps.

---

## Tech Stack

- **Monorepo:** Nx 22
- **Language:** TypeScript 5.9
- **Server:** Next.js 16 App Router (`server/app/api/*`)
- **Database:** PostgreSQL + Prisma (`packages/db`)
- **Mobile:** Expo + React Native 0.82 (`mobile`) with `@nx/expo`
- **Shared contracts:** Zod 4 schemas (`packages/shared`)
- **AI:** OpenAI Responses API (JSON mode) with deterministic mock fallback; BYOK supported; prompt export mode for zero-cost generation when desired
- **Tooling:** Prettier 3, SWC, Babel preset expo, Docker Compose for Postgres

### Deployment Targets

- **Community Edition (CE)** — open-source, self-hostable
- **Managed Service** — our hosted instance with billing & rate-limiting overlays

---

## Project Conventions

### Code Style

_(same as before)_
TypeScript, Zod validation, early returns, Prettier, Nx tasks, etc.

### Architecture Patterns

- **Nx workspace projects:**

  - `server`: Next.js API backend (open-source)
  - `mobile`: Expo app
  - `packages/shared`: schemas & types
  - `packages/db`: Prisma schema

- **Auth:** device bootstrap creates a `DeviceToken`; requests use `Authorization: Bearer <token>`
- **Data:** workout plans/logs, user memory/preferences, equipment profiles
- **AI abstraction:** `server/lib/ai/provider.ts` for OpenAI or mock providers; cost-aware routing and prompt export mode for zero-cost generation when desired
- **Environment config:** `server/lib/env.ts`
- **Edition toggle:** `process.env.EDITION=CE|HOSTED`
- **Usage limits:** enforced server-side via rate limits, quotas, and billing integration (only active in hosted edition)

### Installing packages

For mobile the right command is like this `npx nx run mobile:install --packages=@react-navigation/native,@react-navigation/native-stack`

---

## Testing Strategy

- P0: Runtime validation at API boundaries using Zod
- Manual integration testing via the mobile app and HTTP clients (curl/Postman)
- Mobile testing scaffolded with `jest-expo` (no tests committed yet)
- Future: add route handler tests using Next.js request/response mocks; DB tests with Prisma against ephemeral Postgres

## Git & Licensing Model

- **Public repo (`workout-agent-ce`)**

  - License: AGPL
  - Everything required for local or self-hosted use lives here.
  - Contributions welcome under DCO or CLA.

- **Private overlay (`workout-agent-hosted`)**

  - Imports the public repo as a Git submodule.
  - Adds billing, usage metering, and quota enforcement code.
  - Builds with `EDITION=HOSTED`.

---

### Git Workflow

- Default branch: `main`
- Short-lived feature branches with PR review before merge
- Prefer Conventional Commits (recommended; not enforced)
- Use Nx to run affected tasks before merge where applicable

## Domain Context

- `User`: root account; may have `EquipmentProfile`, `WorkoutSession`, `Memory`, `DeviceToken`
- `DeviceToken`: bearer token tied to a user; created via `/api/auth/device-bootstrap`; used for auth
- `WorkoutSession`: plan/log JSON for each session; `source` is `generated` or `manual`; optional `completedAt`
- `Memory`: user-specific notes/summaries/preferences stored as JSON
- `EquipmentProfile`: named list of available equipment for planning

---

## Important Constraints (Revised)

- `DATABASE_URL` required only for server mode.
- `OPENAI_API_KEY` optional — if missing, runs with a deterministic mock.
- When using the hosted server:

  - API requests count toward free/paid quotas.
  - Over-limit requests return `429` or a structured quota-error payload.

- Mobile app base URL (`EXPO_PUBLIC_BACKEND_URL`) defaults to `https://api.workoutagent.com`, but users can override to any self-hosted backend.
- All inputs validated by Zod schemas.
- BYOK is supported in CE and local modes; hosted supports BYOK where appropriate.
- Cost-aware behavior: hosted free tier may route to lighter models; graceful fallbacks and “prompt export mode” allow zero-cost generation when needed.

---

## External Dependencies

- OpenAI Responses API (`https://api.openai.com/v1/responses`)
- PostgreSQL (Docker image `postgres:16` in `docker-compose.yml`)
- Prisma Client (`@prisma/client`) generated from `packages/db/prisma/schema.prisma`
- Expo Secure Store (optional, used if available on device) for token storage
- Nx core and `@nx/expo` plugin for project orchestration

---

## Summary of the Open Source + Freemium Model

| Layer                      | Visibility / License      | Purpose                                                           |
| -------------------------- | ------------------------- | ----------------------------------------------------------------- |
| **Community Edition (CE)** | Public (AGPL)             | Fully functional, self-hostable core                              |
| **Managed Hosted Server**  | Open code, private deploy | Default backend for app store users; usage-metered freemium model |
| **Billing Overlay**        | Private add-on            | Stripe or usage metering, quota enforcement                       |

> ✅ Anyone can run the open-source app locally or self-host it with their own API key.
> 💰 Our hosted version covers model costs via usage-based billing — just like most freemium AI apps.

---
