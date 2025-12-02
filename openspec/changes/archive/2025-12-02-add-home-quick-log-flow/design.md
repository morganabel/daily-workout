## Context
- The `mobile-ui` spec already defines:
  - **Home CTA Execution → Quick log bottom bar entry:** tapping `Quick log` should post a short workout summary, clear the sheet, and prepend the response to Recent Activity.
- The current Home implementation (`apps/mobile/src/app/HomeScreen.tsx`) renders:
  - A bottom `Quick log` button wired to the `backfill` quick action.
  - An `ActionSheet` case for `backfill` that currently shows “Coming soon: Date picker and quick log form.”
- The data layer is already local‑first:
  - `WorkoutRepository` persists generated plans and completed workouts in WatermelonDB.
  - `useHomeData` observes `observeRecentSessions()` and maps rows to `WorkoutSessionSummary`.
  - Logging a generated plan uses `workoutRepository.completeWorkoutById` without going through a remote endpoint.

This change fills the gap between the existing specs and the stubbed Quick log UI by defining a concrete Quick Log sheet and data flow, and by removing the separate Backfill chip in favor of a simpler Quick Log entry point.

## Goals
- Enable users to log an ad‑hoc workout directly from the Home screen via the `Quick log` button, without touching the generation flow.
- Keep the Quick Log flow **offline‑first** and fast, using the local database as the source of truth.
- Reuse the same plumbing for:
  - “I just did something” (Quick log from bottom bar).
  - “I did something earlier today” (Backfill quick action).

## Non‑Goals
- Free‑text / AI‑parsed logging (e.g., “elliptical for 30 minutes”) — this change uses a simple structured form.
- Arbitrary backfill across days or detailed set/rep logging.
- Any server‑side changes to the logging endpoint beyond what is already specified in `home-data`.

## Data Model & Flow
1. **Quick Log payload (client‑side)**
   - `name` / `label`: short descriptor shown in Recent Activity (e.g., “Walk”, “Elliptical”, “Upper body circuit”).
   - `focus`: coarse focus tag (e.g., “Cardio”, “Full body”, “Upper body”) used to populate `WorkoutSessionSummary.focus`.
   - `durationMinutes`: numeric duration used to derive `durationSeconds`.
   - `when`: enum for now vs earlier today; maps to a concrete `completedAt` timestamp.
   - `note` (optional): free‑form text stored only in the local workout JSON for future use.

2. **Repository helper**
   - Add `quickLogManualSession` (name TBD) to `WorkoutRepository`:
     - Creates a new `Workout` row with:
       - `status = 'completed'`
       - `source = 'manual'`
       - `name`, `focus`, `summary` (optional), `durationSeconds`, `completedAt`, `scheduledDate` (default to the same day).
       - No associated `Exercise` / `Set` rows in the initial version.
     - Ensures `archivedAt = null` so new sessions are visible in `observeRecentSessions`.
   - Reuse `toSessionSummary` so manual sessions match the shape of generated ones in the UI.

3. **Optional API helper**
   - Add a `quickLogWorkout` helper in `services/api.ts` that:
     - Delegates to `WorkoutRepository.quickLogManualSession` for local persistence.
     - Optionally, in a later iteration, POSTs a quick log payload to `/api/workouts/quick-log` (or similar) when a backend is configured.
   - For this change, server sync is explicitly optional; local behavior must be complete on its own.

## UI & UX
- **Entry points**
  - Bottom bar `Quick log` button: opens the Quick Log sheet with `when = now` by default.

- **Quick Log sheet behavior**
  - Appears as a bottom sheet over the Home screen; dismissible via Cancel or tapping outside.
  - Minimal fields:
    - “What did you do?” — short text or preset buttons for common activities.
    - “Duration” — numeric input or picker in minutes.
    - “When” — toggle between “Just now” and “Earlier today”.
    - Optional note field.
  - Primary CTA: `Save log`.
  - On submit:
    - Validate required fields (at least duration and a label/focus).
    - Call `quickLogWorkout` / repository helper.
    - Close the sheet on success; show a lightweight confirmation (toast or similar) on failure via `Alert`.

- **Recent Activity behavior**
  - Because `useHomeData` subscribes to `observeRecentSessions`, newly inserted sessions:
    - Automatically appear at the top of Recent Activity.
    - Respect existing filters (archived and deleted sessions remain hidden).

## Error Handling & Edge Cases
- If the repository write fails:
  - Show an `Alert` with a generic error message.
  - Keep the sheet open so the user can retry or cancel.
- If the device is offline:
  - Quick Log should still function, since it writes to local storage only.
  - No BYOK/API key requirement is enforced for Quick Log.
- If the user submits an empty or invalid form:
  - Prevent submission and surface inline validation messages (e.g., “Please enter a duration”).

## Open Questions
- Do we want to capture any structured “intensity” field now, or keep that implicit in the note/label?
- Should “Earlier today” allow picking a specific time window (via a picker) in this change, or stay as a coarse option that simply backdates `completedAt` by a fixed offset?
- Users can still backfill earlier‑today sessions via the “When” field in the Quick Log sheet, without a dedicated Backfill chip.
