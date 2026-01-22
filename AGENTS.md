<!-- OPENSPEC:START -->

# OpenSpec Instructions

These instructions are for AI assistants working in this project.

Always open `@/openspec/AGENTS.md` when the request:

- Mentions planning or proposals (words like proposal, spec, change, plan)
- Introduces new capabilities, breaking changes, architecture shifts, or big performance/security work
- Sounds ambiguous and you need the authoritative spec before coding

Use `@/openspec/AGENTS.md` to learn:

- How to create and apply change proposals
- Spec format and conventions
- Project structure and guidelines

Keep this managed block so 'openspec update' can refresh the instructions.

<!-- OPENSPEC:END -->

<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

# General Guidelines for working with Nx

- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- You have access to the Nx MCP server and its tools, use them to help the user
- When answering questions about the repository, use the `nx_workspace` tool first to gain an understanding of the workspace architecture where applicable.
- When working in individual projects, use the `nx_project_details` mcp tool to analyze and understand the specific project structure and dependencies
- For questions around nx configuration, best practices or if you're unsure, use the `nx_docs` tool to get relevant, up-to-date docs. Always use this instead of assuming things about nx configuration
- If the user needs help with an Nx configuration or project graph error, use the `nx_workspace` tool to get any errors
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.

<!-- nx configuration end-->

# Workout Agent CE - Agent Notes

## Quick Orientation

- Read `VISION.md` for product principles before making UX changes.
- Workspace manager: Nx monorepo with `apps/` and `packages/` workspaces.
- Primary apps: `apps/server` (Next.js API) and `apps/mobile` (Expo/React Native).
- Shared contracts: `packages/shared` with Zod schemas and helpers.

## Build, Lint, and Test Commands

### Install + Dev

- Install dependencies: `npm install`
- Start Next.js API (stub auth): `npm run start`
- Start Next.js API + Postgres auth: `npm run dev:server:db`
- Start Expo dev server: `npm run dev:mobile`
- Run iOS simulator build: `nx run mobile:run-ios`
- Run Android emulator build: `nx run mobile:run-android`

### Lint

- Lint all projects: `npm run lint`
- Lint a single project: `nx lint <project>`

### Unit Tests

- Run all tests: `npm run test`
- Run tests for a project: `nx test <project>`
- Run a single test file: `nx test <project> --testPathPattern=apps/.../file.test.ts`
- Run a single test name: `nx test <project> --testNamePattern="My test name"`

### E2E (Playwright)

- Run an e2e target: `nx run <project>:e2e`
- List available projects/targets: `nx show projects` then `nx show project <project>`

### Build

- Build all projects: `npm run build`
- Build a project: `nx build <project>`
- Typecheck a project: `nx run <project>:typecheck`

## Code Style Guidelines

### Formatting

- Indentation: 2 spaces (see `.editorconfig`).
- Quotes: single quotes in JS/TS (see `.prettierrc`).
- Keep trailing whitespace trimmed and end files with newline.

### TypeScript

- Strict mode is enabled; avoid `any` and prefer explicit types.
- Use `type` imports for types (e.g., `import type { Foo } from '...'`).
- Export schemas and types together (Zod schema + `z.infer`).

### Imports & Modules

- Prefer absolute imports for server routes using `@/` alias.
- Prefer package imports for shared contracts: `@workout-agent/shared`.
- Group imports: external, internal, local; keep type imports with their source.

### React / Expo

- Use functional components and hooks.
- Define styles via `StyleSheet.create` and avoid inline styles unless dynamic.
- Keep screen components focused on orchestration; extract complex UI into components.

### API / Server

- API routes are named exports: `export async function GET/POST`.
- Use `createErrorResponse` from `apps/server/src/lib/errors.ts` for structured errors.
- Return JSON via `Response.json(...)` with explicit status codes.

### Tests

- Jest tests use `.test.ts/.spec.ts` naming.
- Prefer testing behavior over implementation details.
- For React Native tests, use Testing Library queries (screen, getBy*, findBy*).

## Error Handling Patterns

- Favor typed error payloads (`ApiErrorCode`) for API responses.
- Keep retry metadata explicit (`retryAfter`) when applicable.
- Avoid throwing raw errors across API boundaries; map to response payloads.

## Environment Configuration

- Create `.env` or `.env.local` with `AI_PROVIDER`, `OPENAI_API_KEY`, `GEMINI_API_KEY`.
- Set `EXPO_PUBLIC_BACKEND_URL` to reach the local API (default `http://localhost:3000`).
- Use `EDITION=HOSTED` to enforce BYOK-only mode; `EDITION=CE` uses mock data when keys are missing.
- DB-backed auth relies on `DATABASE_URL`, `BETTER_AUTH_SECRET`, and `BETTER_AUTH_URL`.
- BYOK headers: `x-ai-provider`, `x-openai-key`, `x-gemini-key`, or `x-ai-key`.

## Database + Auth Helpers

- Start Postgres: `npm run db:up`
- Stop Postgres: `npm run db:down`
- Apply migrations: `npm run db:migrate`
- Reset DB volume: `npm run db:reset`
- Regenerate Better Auth schema: `npm run better-auth:generate`

## Tooling Notes

- Use Nx MCP tools (`nx_workspace`, `nx_project_details`) for project discovery.
- Jest config is per-project; pass Jest args through `nx test`.
