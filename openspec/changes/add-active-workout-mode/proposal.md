## Why
Currently, users can generate and preview a workout, but they cannot "perform" it within the app. The "Start workout" button on the Preview screen is disabled. We need to close the loop by allowing users to execute the workout, track their progress, and log it to their local history.

## What Changes
- Add a new `ActiveWorkoutScreen` for the live workout experience.
- Enable the "Start workout" button on `WorkoutPreviewScreen`.
- Implement timer functionality (session duration).
- Add checkbox logic for exercises/sets (local state only for now).
- Add "Finish Workout" logic that updates the `Workout` record in WatermelonDB to `completed` status.
- Redirect to Home Screen upon completion, triggering a refresh of the recent sessions list.

## Impact
- Affected specs: `mobile-ui`
- Affected code: `apps/mobile/src/app/`, `apps/mobile/src/app/navigation/`

