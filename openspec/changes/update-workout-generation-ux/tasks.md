## 1. Shared Contracts & Tooling

- [ ] 1.1 Extend `HomeSnapshot` schema/types with a `generationStatus` object (`state`, `submittedAt`, `etaSeconds?`, `message?`) plus helper factories in `packages/shared`.
- [ ] 1.2 Add shared helpers for normalizing quick-action values (time, focus, equipment, energy) so the client request builder can sanitize staged overrides before sending them to the server.
- [ ] 1.3 Document the contract changes in `packages/shared/README.md` and ensure `nx test shared` covers the new helpers.

## 2. Server APIs & State

- [ ] 2.1 Implement an in-memory/file-backed `GenerationStateStore` keyed by DeviceToken that tracks the latest plan and the most recent generation status (idle/pending/error metadata).
- [ ] 2.2 Update `GET /api/home/snapshot` to read from the store: include `generationStatus`, return the persisted plan when present, and leave quick actions as defaults that the client can override locally.
- [ ] 2.3 Enhance `POST /api/workouts/generate` to mark status `pending`, call the AI provider, persist the successful plan + metadata, and reset status on completion/failure.
- [ ] 2.4 Add structured logging + route tests covering pending state transitions, BYOK failures, and fallback paths (`nx test server`).

## 3. Mobile Experience

- [ ] 3.1 Update `useHomeData` to expose `generationStatus`, derive quick-action display values from either the persisted plan or in-memory overrides, and refetch after generation/log completes.
- [ ] 3.2 Add a hero overlay + progress indicator that appears after 400 ms of pending generation, disables CTAs, and shows status copy drawn from `generationStatus`.
- [ ] 3.3 Rebuild quick action chips/sheets to show the current staged value, highlight unsynced changes, support “Apply” vs “Apply & Generate”, and keep overrides in component-level state (wiped on restart).
- [ ] 3.4 Ensure the generator request body is derived from the staged values (validated via shared helpers) and refetch snapshot after success so the persisted plan populates the hero card.
- [ ] 3.5 Add toasts/alerts + retry affordances for generation/log failures that keep staged context intact, plus a `reset to defaults` escape hatch.

## 4. QA, Telemetry & Docs

- [ ] 4.1 Cover the new store, snapshot route, generation route, and quick action endpoint with Jest tests and mock timers for duration tracking.
- [ ] 4.2 Add component/hook tests for the mobile loading overlay + chip states (jest-expo + testing-library).
- [ ] 4.3 Write a manual QA script documenting BYOK/offline, stage-only, stage+generate, long-call, and failure recovery flows.
- [ ] 4.4 Capture generation latency metrics (server logs + client console) and document how to read them before handing off for review; run `nx run-many --target=test --projects=shared,server,mobile`.
