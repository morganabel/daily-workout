# @leveza/shared

Shared contracts for the Leveza monorepo. The Zod schemas exported from this package are the single source of truth for workout plans, generation inputs, debug payloads, and local-first mobile data contracts.

## Usage

- **Server** (`apps/server`): import from `@leveza/shared` inside API route handlers to validate request bodies (`generationRequestSchema`) and generated workout responses (`todayPlanSchema`).
- **Mobile** (`apps/mobile`): import the associated TypeScript types (e.g., `TodayPlan`, `QuickActionPreset`, `GenerationStatus`) to type hooks/components instead of duplicating interfaces.
- Quick action flows can call `normalizeQuickActionValue` / `buildGenerationRequestFromQuickActions` to sanitize staged chip values before issuing a generation request, ensuring time/focus/equipment/energy inputs stay within supported bounds.

## Building

Run `nx build @leveza/shared` to build the library.

## Running unit tests

Run `nx test @leveza/shared` to execute the unit tests via [Jest](https://jestjs.io).

## Nx Targets

This package exposes the following Nx targets:

- `build` - Compiles TypeScript to JavaScript in the `dist/` folder
- `test` - Runs Jest unit tests (depends on `build`)
- `lint` - Runs ESLint on the project
- `typecheck` - Runs TypeScript type checking (depends on `build`)

## Run Locally

- Run `npx nx dev server` to start the backend server
- Run `npx nx run-ios mobile` or `npx nx run-android mobile` to run the app
