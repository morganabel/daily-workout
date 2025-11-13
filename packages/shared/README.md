# @workout-agent/shared

Shared contracts for the Workout Agent monorepo. The Zod schemas exported from this package are the single source of truth for the home snapshot payload, workout plans, and quick-action/generation inputs.

## Usage

- **Server** (`apps/server`): import from `@workout-agent/shared` inside API route handlers to validate request bodies (`generationRequestSchema`) and ensure responses match `homeSnapshotSchema`.
- **Mobile** (`apps/mobile`): import the associated TypeScript types (e.g., `HomeSnapshot`, `TodayPlan`) to type hooks/components instead of duplicating interfaces, and reuse `createHomeSnapshotMock` for mocks/storybook fixtures.
- Quick action flows can call `normalizeQuickActionValue` / `buildGenerationRequestFromQuickActions` to sanitize staged chip values before issuing a generation request, ensuring time/focus/equipment/energy inputs stay within supported bounds.

## Building

Run `nx build @workout-agent/shared` to build the library.

## Running unit tests

Run `nx test @workout-agent/shared` to execute the unit tests via [Jest](https://jestjs.io).

## Nx Targets

This package exposes the following Nx targets:

- `build` - Compiles TypeScript to JavaScript in the `dist/` folder
- `test` - Runs Jest unit tests (depends on `build`)
- `lint` - Runs ESLint on the project
- `typecheck` - Runs TypeScript type checking (depends on `build`)

## Run Locally

- Run `npx nx dev server` to start the backend server
- Run `npx nx run-ios mobile` or `npx nx run-android mobile` to run the app
