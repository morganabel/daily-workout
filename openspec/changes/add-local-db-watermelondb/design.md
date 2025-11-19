## Context

The app currently relies on a stateless server mock for data. We are moving to a "Local-First" architecture where the mobile device holds the source of truth in a SQLite database, managed by WatermelonDB.

## Goals

- **Offline First:** All core features (viewing plan, logging, history, settings) must work without network.
- **Performance:** Instant load times for the Home Screen.
- **Sync Ready:** The architecture should support future sync with a backend.

## Decisions

- **Database:** WatermelonDB (built on SQLite). Chosen for performance (lazy loading) and sync capabilities.
- **Schema:**
  - `users`: Stores profile and preferences. Single row for now.
  - `workouts`: Stores generated plans and completed sessions.
  - `exercises`: Exercises within a workout.
  - `sets`: Sets within an exercise.
- **Migration:** We will stop fetching `home/snapshot` for the plan. Instead, we will query the `workouts` table for a workout scheduled for "today".

## Risks

- **Complexity:** Managing local state and observables adds complexity to the UI components.
- **Data Migration:** If we had existing users, we'd need a migration strategy. Since we are pre-MVP, we can start fresh.
