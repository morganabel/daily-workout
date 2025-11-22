## 1. Setup & Schema

- [x] 1.1 Install `@nozbe/watermelondb` and dependencies in `apps/mobile`
- [x] 1.2 Configure Babel for decorators support in `apps/mobile`
- [x] 1.3 Define WatermelonDB schema (`schema.ts`) for `workouts`, `exercises`, `sets`, `users`
- [x] 1.4 Create Model classes (`Workout`, `Exercise`, `Set`, `User`)
- [x] 1.5 Initialize Database provider in `apps/mobile/src/app/db/index.ts`

## 2. Data Access Layer

- [x] 2.1 Create `WorkoutRepository` for creating/fetching workouts
- [x] 2.2 Create `UserRepository` for managing preferences
- [x] 2.3 Implement `useHomeData` hook to observe DB instead of API

## 3. Feature Migration

- [x] 3.1 Update `HomeScreen` to use observable data
- [x] 3.2 Implement "Log Workout" action using `WorkoutRepository`
- [x] 3.3 Create `SettingsScreen` to manage User preferences
- [x] 3.4 Create `HistoryScreen` to list past workouts

## 4. AI Integration

- [x] 4.1 Update `generateWorkout` service to save response to DB
- [x] 4.2 Ensure generation context is read from `UserRepository`
