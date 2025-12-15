## 1. Contracts & API
- [ ] 1.1 Update `packages/shared` with `WorkoutSessionSet` and detailed `WorkoutSession` schemas
- [ ] 1.2 Update `packages/shared` logging request schema to include detailed set data

## 2. Mobile Implementation
- [ ] 2.1 Update `WorkoutRepository` to support saving/updating individual sets
- [ ] 2.2 Create `SetRow` component for `ActiveWorkoutScreen` with inputs for weight, reps, RPE
- [ ] 2.3 Implement "Add Set" / "Remove Set" functionality in UI
- [ ] 2.4 Wire up `ActiveWorkoutScreen` to save set data to `sets` table
- [ ] 2.5 Implement "Finish Workout" to bundle detailed data for API submission

## 3. Server Implementation
- [ ] 3.1 Update logging endpoint to validate and store detailed session data (if persistent storage exists)
