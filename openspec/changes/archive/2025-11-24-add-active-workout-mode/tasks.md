## 1. Navigation & Setup

- [x] 1.1 Create `ActiveWorkoutScreen` component scaffold.
- [x] 1.2 Update `RootStackParamList` to include `ActiveWorkout` route (passing `planId` or `plan` object).
- [x] 1.3 Enable navigation from `WorkoutPreviewScreen` -> `ActiveWorkoutScreen` on "Start workout" press.

## 2. Active Workout UI

- [x] 2.1 Implement the header with a live timer (mm:ss) tracking session duration.
- [x] 2.2 Render the list of blocks and exercises (similar to Preview but optimized for execution).
- [x] 2.3 Add toggleable checkboxes for each exercise/set.
- [x] 2.4 Add a "Finish Workout" button at the bottom (sticky or scroll).

## 3. Logic & Persistence

- [x] 3.1 Connect the "Finish Workout" button to update the local `Workout` record status to `completed` and set `completedAt` timestamp.
- [x] 3.2 Ensure `useHomeData` hook on Home Screen picks up the completion (via existing `workoutRepository` observation).
- [x] 3.3 Navigate back to Home Screen after saving.

## 4. Polish

- [x] 4.1 Add a simple confirmation dialog before finishing if not all items are checked (optional, or just allow it).
- [x] 4.2 Verify back-button behavior (alert "End workout?" to prevent accidental exit).
