## Why
Testing and real-world usage quickly produce many experimental or low-quality workout logs. Today there is no way to clean up these sessions or prevent them from influencing future AI plans while still preserving a truthful personal history. Users need explicit controls to archive noisy sessions (soft delete) and permanently delete mistakes.

## What Changes
- Add first-class workout archiving semantics so a session can be marked as "ignored for context" without losing its details in local storage.
- Add deletion semantics for permanently removing sessions (for example test logs or obvious mistakes) from local data, home snapshot responses, and any derived statistics.
- Update snapshot, history, and generation flows so archived sessions are excluded from "recent activity" and `GenerationContext.recentSessions` by default.
- Expose archive/unarchive/delete controls in the mobile UI from the recent activity / history surfaces.
- Add tests exercising archive vs delete behavior across the local database, home snapshot, and generation context.

## Impact
- Affected specs: `home-data`, `mobile-ui`, `user-profile`
- Affected code: mobile Home screen and history surfaces (`apps/mobile/src/app/*`), WatermelonDB models/migrations for workouts, backend snapshot/generation/logging routes (`apps/server/app/api/*`), and shared `WorkoutSession` / `GenerationContext` contracts in `packages/shared`.

