## Why
- The Home screen already surfaces a `Quick log` CTA in the bottom bar and a `Backfill` quick action, but the flow is stubbed: users cannot actually record an ad‑hoc session or backfill history from this entry point.
- The `mobile-ui` and `home-data` specs already define quick‑log and backfill behavior, but the current implementation only supports logging generated plans via `Log done`, and the dedicated Backfill chip adds UI noise without providing a clear benefit over a focused Quick Log flow.
- Fast, low‑friction logging is core to the project mission (“one‑tap logging when you just want to record completion”) and is critical for real‑world dogfooding and demo flows.

## What Changes
- Add a dedicated Quick Log sheet on the Home screen that opens from the bottom `Quick log` button, replacing the need for a separate Backfill quick action chip.
- Allow users to capture a minimal manual session (what they did, for how long, and when) without leaving Home, and persist it as a completed workout in the local database.
- Wire the Quick Log flow into the existing home data pipeline so recent activity updates immediately and remains fully offline‑capable.
- Align the implementation with existing `mobile-ui` and `home-data` requirements, adding a focused UI requirement for the Quick Log sheet and updating the Home quick‑actions requirement to remove the Backfill chip.

## Impact
- Affected specs: `mobile-ui` (new Quick Log sheet requirement), `home-data` (implemented via existing Workout Logging requirements; no semantic change expected).
- Affected code:
  - Mobile UI: `apps/mobile/src/app/HomeScreen.tsx`, new Quick Log sheet component under `apps/mobile/src/app/components/*`.
  - Data layer: `apps/mobile/src/app/db/repositories/WorkoutRepository.ts` for manual session writes.
  - API client: `apps/mobile/src/app/services/api.ts` for an optional `quickLogWorkout` helper aligned with the logging contract.
  - Tests: `apps/mobile/src/app/HomeScreen.test.tsx`, `apps/mobile/src/app/App.spec.tsx`, and any new Quick Log component tests.

## Success Criteria
1. Tapping `Quick log` on the Home bottom bar opens a Quick Log sheet without navigating away.
2. Submitting the form persists a manual workout session locally (source `manual`) and prepends it to Recent Activity, satisfying the “Quick log bottom bar entry” scenario in `mobile-ui`.
3. Quick log works fully offline and does not require an API key; if a remote logging endpoint is added later, local persistence remains the source of truth.
4. The flow feels fast and focused: a user can log “I walked for 30 minutes” in under 10 seconds from app launch.

## Risks & Mitigations
- **Scope creep into full text parsing or rich templates:** limit this change to a structured, minimal form (what, duration, when, optional note). Future AI or free‑text parsing can build on top.
- **Inconsistent data shape vs generated sessions:** centralize manual session creation in `WorkoutRepository` so both generated and manual sessions share the same `WorkoutSessionSummary` shape.
- **UX confusion between Quick log and `Log done`:** keep labels and copy clear (Quick log = “I did something ad‑hoc”, Log done = “I completed today’s plan”) and ensure both show up consistently in Recent Activity.

## Decisions
- Treat Quick log as a local‑first operation: this change writes manual sessions to WatermelonDB; any server logging or sync will be layered on later without blocking the UX.
- Use a dedicated Quick Log sheet rather than overloading the existing quick action sheet UI, and remove the separate Backfill chip in favor of a simple “When” field inside Quick Log.
- Keep the first version focused on “today” (now vs earlier today); more advanced backfill (arbitrary dates) can be handled in a follow‑up change if needed.
