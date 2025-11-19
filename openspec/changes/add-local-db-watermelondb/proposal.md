## Why

The current implementation relies on a server-side mock store for workout plans and history. To fulfill the "Local-first" and "Private-by-default" vision, the mobile app needs a robust local database to store workouts, history, and user preferences independently of the server.

## What Changes

- **Add WatermelonDB:** Integrate WatermelonDB into the mobile app as the primary data store.
- **Local Schema:** Define schemas for `User`, `Workout`, `Exercise`, and `Set`.
- **Data Migration:** Move the "source of truth" for the Home Screen from the API to the local database.
- **Offline Capability:** Enable full offline functionality for viewing history, logging workouts, and managing settings.
- **AI Integration:** Update the generation flow to fetch context from the local DB and save generated plans to it.

## Impact

- **Affected specs:** `home-data`, `mobile-ui`
- **Affected code:** `apps/mobile`, `packages/shared` (contracts may need updates to align with DB models)
