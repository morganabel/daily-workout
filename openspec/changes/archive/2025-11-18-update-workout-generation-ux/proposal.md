# Change Proposal — `update-workout-generation-ux`

## Why
- Generating a workout currently takes 10–20 seconds when calling the OpenAI Responses API, yet the mobile hero card only swaps button text (`apps/mobile/src/app/HomeScreen.tsx:688`). Users experience a frozen screen with no feedback, which feels broken.
- Quick action chips render static placeholder copy (`QuickActionRail` reads `action.description` only) so editing presets in the sheets appears to do nothing. The staged values never persist beyond the current process because the server snapshot is mock-only (`apps/server/src/app/api/home/snapshot/route.ts`) and ignores user intent.
- The generator endpoint returns a plan but never stores it; refreshing the home snapshot wipes out the result, forcing every action to hit the slow path again. There is no way to recover from mid-generation failures without re-entering context.

## Current Behavior
1. `GET /api/home/snapshot` always returns `createHomeSnapshotMock`, so `quickActions` descriptions never reflect staged values and `plan` is always `null`.
2. `POST /api/workouts/generate` validates presets and calls OpenAI, but the response is only returned to that request — nothing is cached or associated with the user/device (`apps/server/src/app/api/workouts/generate/route.ts`).
3. On mobile, `useHomeData` keeps staged values purely in memory, meaning a pull-to-refresh or app restart loses them; chips never show the staged state, and long-running generations provide no spinner, countdown, or toast.

## Goals
1. Deliver a polished “Generate workout” loop with perceivable loading states, progress hints, and resilient error handling so users trust the long-running call.
2. Make quick action presets first-class: edits persist per device, the UI mirrors staged inputs, and the generator consumes the latest context automatically.
3. Persist the latest generated plan + status server-side so the snapshot can refresh the hero card, logging works after a reload, and pending generations can be surfaced.

## Non-Goals
- Implementing multi-user synchronization or cross-device preference sharing (we will scope persistence to the current DeviceToken for now).
- Building a background job queue/notifications; generations still happen inline but now expose richer status.
- Redesigning the hero card visuals beyond the states required for better UX (no major layout overhaul).

## Proposed Changes
1. **Shared contracts**
   - Extend `HomeSnapshot` with a `generationStatus` object (`state: 'idle' | 'pending' | 'error'`, `submittedAt`, `etaSeconds`, `message?`) so clients can render pending/error overlays without waiting for the generator call to finish.
   - Add shared helpers to normalize quick-action values (time/focus/equipment/energy) before building generation requests, ensuring that staged overrides stay within supported bounds.
2. **Server experience**
   - Add an in-memory (or file-backed) `GenerationStateStore` keyed by DeviceToken that tracks the last generated plan and the most recent status update/duration.
   - Update `/api/home/snapshot` to read from the store: return the persisted plan (if any), keep quick actions deterministic (defaults derived from plan/mock), and surface `generationStatus`.
   - Extend `/api/workouts/generate` to (a) mark the status as `pending`, (b) persist the successful plan + metadata, and (c) gracefully retain the last good plan when the provider fails.
3. **Mobile UX**
   - Refresh `useHomeData` to consume the new snapshot fields, merge them with in-memory quick-action overrides, and expose a single `generationStatus` state for the hero card.
   - Enhance the hero card with a loading overlay + progress chip after 400 ms, disable quick actions while `pending`, and show inline BYOK/offline messaging pulled from the snapshot hints.
   - Rebuild the quick action chips to show the current staged value (e.g., “Time · 45 min”), keep staged overrides in component state, and offer an “Apply & Generate” vs “Apply only” flow that simply determines whether to immediately call the generator.
   - Add CTA-level toasts + retry affordances when generation/logging fails, keeping the staged context intact.
4. **QA + Observability**
   - Cover the new store, routes, and React hook with tests, and log generation durations/client-side analytics (console/table for now) to understand latency.

## Risks / Open Questions
- Without a real database we’ll rely on an in-memory store for generated plans/status; we need to confirm whether eviction per process restart is acceptable for CE. (Proposed mitigation: simple file cache under `tmp/` guarded by ENV toggle.)
- Need to ensure client-staged values are validated before sending to the server (we’ll sanitize in the generator request builder).
- Long-running operations may still exceed client timeouts; we might consider adding a `maxWaitSeconds` guard so the UI can suggest manual refresh if needed.

## Success Criteria
- Triggering `Generate workout` immediately shows a spinner/overlay, transitions through pending → success, and the resulting plan persists across app restarts until logged.
- Editing a preset updates the chip label right away, survives app refresh, and the generator request body matches those values without manual recomputation.
- Snapshot responses expose `generationStatus` and quick action state verified by unit tests; route tests cover BYOK, pending, and reset scenarios.
