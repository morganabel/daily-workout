# mobile-ui Specification

## Purpose
TBD - created by archiving change add-initial-mobile-ui. Update Purpose after archive.
## Requirements
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
- **GIVEN** the user taps a chip (Time, Focus, Equipment, Energy)
- **THEN** a lightweight sheet appears allowing them to adjust the chosen parameter and dismiss without leaving the screen

#### Scenario: Activity list summary
- **GIVEN** at least one past workout exists
- **THEN** the list shows the last three sessions with name/focus, completion timestamp, and duration, plus a "View history" CTA

#### Scenario: Empty history guidance
- **GIVEN** no past workouts exist
- **THEN** the activity section shows a friendly nudge explaining that completed workouts will appear here after the first log

### Requirement: Workout Preview Screen
The mobile app MUST provide a dedicated preview view of the suggested workout before starting any timers or logging.

#### Scenario: Preview button navigation
- **WHEN** the user taps the `Preview` button on the Home hero card
- **THEN** the app navigates to the workout preview screen

#### Scenario: Preview layout mirrors active workout
- **WHEN** the preview screen renders
- **THEN** it shows the workout title, duration, equipment badges, energy indicator, and block-by-block exercise details with prescriptions while leaving controls non-interactive

#### Scenario: Back returns to Home
- **WHEN** the user taps Back on the preview screen
- **THEN** the app returns to the Home screen without starting the workout

### Requirement: Home CTA Execution
The hero buttons and quick log affordances MUST invoke real data mutations and keep the UI state in sync with the latest snapshot.

#### Scenario: Generate workout submits context
- **GIVEN** the user taps `Generate workout` (or `Customize ➝ Generate`)
- **WHEN** the app has a network connection and a configured API key
- **THEN** it sends the staged quick-action parameters to the generator endpoint, disables the CTA until the response arrives, and refreshes the hero card with the returned plan

#### Scenario: Log done refreshes activity list
- **GIVEN** a plan is in `ready` state
- **WHEN** the user taps `Log done`
- **THEN** the app marks the workout complete via the logging endpoint, shows a transient loading state, and updates the Recent Activity list with the new entry

#### Scenario: Quick log bottom bar entry
- **GIVEN** the user taps `Quick log`
- **WHEN** they submit a bodyweight/cardio entry without an active plan
- **THEN** the app posts a short workout summary, clears the sheet, and prepends the response to Recent Activity

#### Scenario: Offline or BYOK missing
- **GIVEN** the user taps any networked CTA while offline or without an API key
- **THEN** the action is blocked, the inline BYOK banner appears, and no network request is attempted

### Requirement: Quick Action Sheets Drive Generation
Quick action chips MUST stage preset changes in local UI state, display the chosen values on each chip, and feed those overrides directly into the next generation request. The UI SHALL highlight unsynced edits and let users apply changes without immediately generating.

#### Scenario: Chip label reflects staged value
- **GIVEN** the user edits the Time sheet to 45 minutes and taps `Apply`
- **WHEN** the sheet closes
- **THEN** the Time chip updates to “45 min” and shows a subtle staged indicator until a new plan is generated or the value is cleared

#### Scenario: Apply vs Apply & Generate
- **GIVEN** a sheet is open with a new selection
- **WHEN** the user taps `Apply & Generate`
- **THEN** the client writes the staged value locally, immediately builds a generation request using all staged overrides, and calls the generator; tapping `Apply` alone only stores the value for future generations

#### Scenario: Stage cleared after successful generation
- **GIVEN** staged overrides exist for focus and time
- **WHEN** a generation succeeds
- **THEN** the chips drop their staged indicator, move the persisted plan values into local defaults, and the overrides reset so the UI reflects the plan that was just generated

### Requirement: Generation Feedback & Recovery
The mobile hero experience MUST provide perceivable progress, disable conflicting actions while generation is pending, and surface actionable errors without losing context.

#### Scenario: Loading overlay after delay
- **GIVEN** the user triggers generation
- **WHEN** the request remains unresolved for >400 ms
- **THEN** the hero card shows an ActivityIndicator overlay with copy from `generationStatus` (e.g., “Generating with OpenAI… 12s elapsed”) and disables Generate/Customize buttons until the status returns to `idle`

#### Scenario: Pending state disables quick actions
- **GIVEN** `generationStatus.state` is `pending`
- **WHEN** the home screen renders
- **THEN** quick action chips become read-only with a tooltip explaining that edits resume after the current plan finishes, preventing conflicting staged state

#### Scenario: Error surfaces with retry
- **GIVEN** `generationStatus.state` is `error` with a message
- **WHEN** the user returns to the home screen
- **THEN** the hero card shows inline error text, the chips retain their staged values, and the Generate button becomes a `Retry` CTA that reuses the staged context

#### Scenario: Successful generation hydrates from snapshot
- **GIVEN** a generation completes and the client refetches `/api/home/snapshot`
- **WHEN** the screen refreshes
- **THEN** the hero card renders the persisted plan without requiring another manual fetch, and the Preview/Log buttons operate on that plan even after an app restart

### Requirement: BYOK Provider Selection
The mobile app MUST let users choose which AI provider (OpenAI or Gemini) to use for workout generation, store the BYOK key per provider, and send the correct headers while keeping legacy OpenAI-only flows working.

#### Scenario: Provider selection and key capture

- **GIVEN** the user opens the BYOK/config sheet
- **WHEN** they pick a provider (OpenAI or Gemini) and enter a key
- **THEN** the app stores the provider choice and key securely and marks them as the active provider for future generations

#### Scenario: Requests include provider headers

- **GIVEN** a provider + key has been configured
- **WHEN** the app calls `/api/workouts/generate`
- **THEN** it sends `x-ai-provider` with the chosen provider and the matching key header (`x-ai-key` or provider-specific alias), so the server uses that provider

#### Scenario: Legacy OpenAI key still works

- **GIVEN** an existing user only has an OpenAI key saved from the old flow
- **WHEN** they generate a workout without reconfiguring
- **THEN** the app defaults to provider=openai and sends `x-openai-key`, so the request succeeds without prompting

#### Scenario: Invalid provider feedback

- **GIVEN** the server responds with `INVALID_PROVIDER`
- **WHEN** the app receives the error
- **THEN** it surfaces an inline message in the BYOK sheet and keeps staged values so the user can correct the provider choice

### Requirement: Active Workout Mode
The app SHALL provide an active mode for executing a workout plan, tracking time, and logging completion.

#### Scenario: Start workout
- **GIVEN** a generated plan is visible on the Preview screen
- **WHEN** the user taps "Start workout"
- **THEN** the app navigates to the Active Workout screen and starts the session timer

#### Scenario: Track progress
- **GIVEN** the Active Workout screen is open
- **WHEN** the user completes an exercise
- **THEN** they can toggle a completion state (checkbox) for that item

#### Scenario: Finish workout
- **GIVEN** the user is in an active workout
- **WHEN** they tap "Finish Workout"
- **THEN** the current workout record in the local database is updated with `status: 'completed'` and `completedAt: <now>`, and the user is returned to the Home Screen

### Requirement: Workout History Management UI
The mobile app MUST provide controls from the Home screen and/or history views to archive (soft delete) and permanently delete individual workout sessions, with clear feedback and alignment to the data-layer semantics.

#### Scenario: Archive from recent activity
- **GIVEN** a completed workout appears in the Recent Activity list on the Home screen
- **WHEN** the user opens its context menu and taps `Archive`
- **THEN** the app calls the archive operation for that session, removes it from the Recent Activity list, shows a lightweight confirmation (for example a toast), and future generations treat that session as excluded from `recentSessions`

#### Scenario: Unarchive from history
- **GIVEN** the user navigates to a workout history view that can show archived sessions
- **WHEN** they choose `Unarchive` on an archived session
- **THEN** the app calls the unarchive operation, updates the UI so the session appears in the normal (non-archived) history view again, and it becomes eligible for inclusion in `recentSessions` and future generation context

#### Scenario: Delete with confirmation
- **GIVEN** a workout session is visible in Recent Activity or the history view
- **WHEN** the user chooses `Delete` and confirms the action
- **THEN** the app calls the delete operation, removes the session from all local lists, and shows a confirmation that the action cannot be undone

#### Scenario: Archived sessions clearly labeled
- **GIVEN** a history view includes archived sessions
- **WHEN** the list renders those items
- **THEN** each archived session is visually distinguished (for example with an "Archived" badge and de-emphasized styling) so users understand it will not affect future recommendations

### Requirement: Quick Log Sheet
The mobile Home screen MUST present a dedicated Quick Log sheet when users want to record an ad‑hoc workout, so they can capture a minimal session without leaving Home.

#### Scenario: Quick log opens sheet
- **GIVEN** the user is on the Home screen
- **WHEN** they tap the `Quick log` button in the bottom bar
- **THEN** a Quick Log sheet slides up from the bottom with fields for what they did, how long it took, and when it happened

#### Scenario: Minimal structured fields
- **GIVEN** the Quick Log sheet is visible
- **WHEN** the user enters a short activity label and a duration (in minutes), and optionally chooses when it happened and adds a note
- **THEN** the form validates that at least a label/focus and duration are present before enabling `Save log`

#### Scenario: Quick log creates manual session
- **GIVEN** the user submits a valid Quick Log entry
- **WHEN** the app processes the submission
- **THEN** it creates a completed manual workout session with the provided label/focus and duration, closes the sheet, and prepends the new entry to the Recent Activity list

#### Scenario: Offline quick log
- **GIVEN** the device is offline or has no API key configured
- **WHEN** the user completes and submits the Quick Log form
- **THEN** the app still records the session locally and updates Recent Activity, without attempting any network request

#### Scenario: Backfill via Quick log
- **GIVEN** the Quick Log sheet is visible
- **WHEN** the user sets the “When” field to an earlier‑today option and submits the form
- **THEN** the app records the session with a `completedAt` timestamp reflecting the chosen time window, without requiring a separate Backfill quick action chip

