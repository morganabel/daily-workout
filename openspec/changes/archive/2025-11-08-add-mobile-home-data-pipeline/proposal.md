# add-mobile-home-data-pipeline

## Why
- The mobile app home experience ships with static mocks, so users cannot fetch real plans, see logged history, or respect BYOK/offline status.
- We need a single data contract that unifies server responses and shared types so both Expo and Next.js stay in sync.
- Wiring the hero card, quick actions, and preview view to live data unlocks the next iteration of demo + internal dogfooding.

## What Changes
- Define a dedicated home data capability that exposes today's plan, quick presets, and the last three sessions through typed endpoints.
- Update the mobile UI spec so CTAs really execute: generate, start, preview, log, quick-log, and BYOK setup flows.
- Add an implementation checklist covering shared types, server routes, client hooks, and offline handling.

## Success Criteria
1. Specs describe the data payloads, error states, and CTA side effects needed for the home and preview screens to function with real inputs.
2. Tasks outline incremental work for shared contracts, server plumbing, Expo hooks/UI wiring, and QA.
3. `openspec validate add-mobile-home-data-pipeline --strict` passes.

## Risks & Mitigations
- **Data drift between client/server:** ground everything in shared Zod schemas living in `packages/shared/contracts` to avoid mismatch.
- **Offline & BYOK edge cases:** explicitly cover them in requirements and unit tests so the UI does not allow actions the backend rejects.
- **Scope explosion:** keep timers, advanced history, and logging analytics out of this change; focus on fetching/displaying core data + CTA wiring.

## Decisions
- Quick actions stage locally until the next `Generate` submission so users can tweak multiple parameters before sending a request.
- Logging flows (hero `Log done`, `Quick log`, backfill) use optimistic updates and store data locally while awaiting server confirmation.
