## 1. UX & Data Prep
- [ ] 1.1 Create a `HomeScreen` route wired into the Expo navigation stack with mocked session/query hooks.
- [ ] 1.2 Define shared types/selectors for `TodayPlan`, `WorkoutSessionSummary`, and quick action metadata inside `packages/shared` (or co-locate temporarily in the mobile app with TODOs).

## 2. Hero Workout Card
- [ ] 2.1 Implement the hero card that swaps between loading, empty, and populated states.
- [ ] 2.2 Show key metadata: focus (e.g., "Upper Body"), estimated time, equipment badge, and AI source tag.
- [ ] 2.3 Add explicit buttons for `Generate workout` and `Log done` with disabled/offline handling.

## 3. Quick Actions Rail
- [ ] 3.1 Build scrollable chips for presets ("Time", "Focus", "Equipment", "Energy", "Backfill").
- [ ] 3.2 Ensure tapping a chip opens the appropriate lightweight sheet (stubs are acceptable for v1).

## 4. Activity & Guidance
- [ ] 4.1 Render the last 3 sessions with summary stats plus a CTA to view history.
- [ ] 4.2 Display an offline/BYOK banner when no API key or network is configured, following the spec copy.

## 5. QA
- [ ] 5.1 Add Jest/Storybook (or Expo preview) coverage for each state, or document manual test steps if automation is deferred.
- [ ] 5.2 Run `nx run mobile:lint` and `nx run mobile:test` (or `expo start --tunnel` if tests unavailable) to verify the screen renders without runtime errors.
