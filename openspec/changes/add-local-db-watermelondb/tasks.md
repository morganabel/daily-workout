## 1. Setup & Schema

- [ ] 1.1 Install `@nozbe/watermelondb` and dependencies in `apps/mobile`
- [ ] 1.2 Configure Babel for decorators support in `apps/mobile`
- [ ] 1.3 Define WatermelonDB schema (`schema.ts`) for `workouts`, `exercises`, `sets`, `users`
- [ ] 1.4 Create Model classes (`Workout`, `Exercise`, `Set`, `User`)
- [ ] 1.5 Initialize Database provider in `apps/mobile/src/app/db/index.ts`

## 2. Data Access Layer

- [ ] 2.1 Create `WorkoutRepository` for creating/fetching workouts
- [ ] 2.2 Create `UserRepository` for managing preferences
- [ ] 2.3 Implement `useHomeData` hook to observe DB instead of API

## 3. Feature Migration

- [ ] 3.1 Update `HomeScreen` to use observable data
- [ ] 3.2 Implement "Log Workout" action using `WorkoutRepository`
- [ ] 3.3 Create `SettingsScreen` to manage User preferences
- [ ] 3.4 Create `HistoryScreen` to list past workouts

## 4. AI Integration

- [ ] 4.1 Update `generateWorkout` service to save response to DB
- [ ] 4.2 Ensure generation context is read from `UserRepository`
