## ADDED Requirements
### Requirement: Mobile Home Screen Layout
The mobile app MUST present a single-scroll home screen that surfaces today's plan, quick actions, and recent activity without navigating away.

#### Scenario: Screen structure
- **GIVEN** the user opens the app
- **THEN** the UI shows (top-to-bottom) a hero workout card, a horizontal quick-action rail, and a recent activity list within one scroll view

#### Scenario: Loading and empty state
- **GIVEN** the app has not fetched any plan data yet
- **THEN** the hero card shows a skeleton state, quick actions remain tappable, and the activity list shows placeholders or "No workouts yet"

### Requirement: Hero Workout Card Interactions
The hero card MUST adapt to whether a generated plan exists and let users generate or log with a single tap.

#### Scenario: Generated plan available
- **GIVEN** a `generated` workout exists for today
- **THEN** the card displays focus, duration, equipment badge, and AI source tag, plus `Start workout` and `Log done` buttons that call their respective handlers

#### Scenario: No plan yet
- **GIVEN** no plan exists for today
- **THEN** the card invites the user to "Generate a workout" with a primary CTA and a `Customize` secondary action opening presets

#### Scenario: Offline/BYOK warning
- **GIVEN** the app detects missing connectivity or API key while the user tries to generate
- **THEN** the card blocks the action, surfaces an inline warning, and links to the BYOK/setup sheet defined for onboarding

### Requirement: Quick Actions & Activity Context
Users MUST be able to tweak core parameters quickly and see at least the last three logged sessions from the home screen.

#### Scenario: Quick action chips
- **GIVEN** the user taps a chip (Time, Focus, Equipment, Energy, Backfill)
- **THEN** a lightweight sheet appears allowing them to adjust the chosen parameter and dismiss without leaving the screen

#### Scenario: Activity list summary
- **GIVEN** at least one past workout exists
- **THEN** the list shows the last three sessions with name/focus, completion timestamp, and duration, plus a "View history" CTA

#### Scenario: Empty history guidance
- **GIVEN** no past workouts exist
- **THEN** the activity section shows a friendly nudge explaining that completed workouts will appear here after the first log
