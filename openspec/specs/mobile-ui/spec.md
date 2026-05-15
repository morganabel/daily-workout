# mobile-ui Specification

## Purpose
TBD - created by archiving change add-initial-mobile-ui. Update Purpose after archive.
## Requirements
### Requirement: Template-Based Onboarding Flow
The mobile app MUST provide a guided first-run onboarding flow that asks goal, experience level, and training environment/equipment before recommending a starter training week. The UI MUST be skippable, use large tactile controls, and match the app's current light calendar/trainer companion visual style.

#### Scenario: Goal question
- **WHEN** the onboarding flow asks what the user is training for
- **THEN** it presents simple goal choices such as general fitness, build muscle, build strength, lose fat, run/cardio, and mobility

#### Scenario: Experience question
- **WHEN** the onboarding flow asks about experience
- **THEN** it presents beginner, intermediate, and advanced options with short descriptions

#### Scenario: Environment and equipment question
- **WHEN** the onboarding flow asks where the user trains
- **THEN** it presents environment choices and equipment chips using the shared equipment options

#### Scenario: Recommendation before commitment
- **WHEN** the user completes the three questions
- **THEN** the app shows a recommended starter week instead of asking for preferred days/windows, strength/cardio counts, split selection, or slot ordering

#### Scenario: Setup can be skipped
- **WHEN** the user taps Skip during onboarding
- **THEN** the app records skipped setup state and routes the user to the existing app experience

### Requirement: Recommended Starter Week
The mobile app MUST show a recommended starter week derived from the user's onboarding answers and inferred template defaults. The recommendation MUST be easy to accept and MAY expose a secondary adjustment path for users who want more control.

#### Scenario: Starter week summarizes template rhythm
- **WHEN** the recommendation screen renders
- **THEN** it shows a 7-day starter rhythm using slot labels such as pull, push, legs, sprint, mobility, recovery, full body, or flexible

#### Scenario: Accept recommendation creates blueprint and slots
- **WHEN** the user taps Use this plan
- **THEN** the app saves the training blueprint and creates the 7-day planned workout slots

#### Scenario: Adjustment path is secondary
- **WHEN** the recommendation screen renders
- **THEN** the primary action is accepting the suggestion and any adjustment action is visually secondary

### Requirement: Planned Slot UI
The mobile app MUST NOT depend on blueprint-owned planned workout slots for the plan/calendar experience. Adaptive recommendations and user-owned planned events are the supported planning surfaces.

#### Scenario: User-owned planned events render in agenda
- **WHEN** the user views a day or week with user-owned planned events
- **THEN** the UI shows those events as schedule context without treating them as starter-week workout slots

#### Scenario: Generate from schedule event
- **WHEN** the user taps Generate on a user-owned planned workout event without a linked workout
- **THEN** the app starts concrete workout generation using event context and normal generation inputs, not planned-slot intent

#### Scenario: Linked detailed workout opens
- **GIVEN** a planned event has a linked generated workout
- **WHEN** the user taps the event
- **THEN** the app opens the detailed workout preview or active workout flow for the linked plan

### Requirement: Mobile Home Screen Layout
The mobile app MUST present a single-scroll home screen that surfaces today's generated workout, today's adaptive recommendation, or one-off generation controls without navigating away. When an adaptive training plan exists and focus is Auto, the Home screen MUST treat the recommendation as the source of today's workout intent.

#### Scenario: Screen structure
- **GIVEN** the user opens the app
- **THEN** the UI shows today's workout, adaptive recommendation, or generation controls within one scroll view

#### Scenario: Loading and empty state
- **GIVEN** the app has not fetched any plan data yet
- **THEN** the hero card shows a skeleton state, quick actions remain tappable, and the activity list shows placeholders or "No workouts yet"

#### Scenario: Adaptive recommendation appears before detailed workout exists
- **GIVEN** the user has an adaptive training plan and no detailed workout for today
- **WHEN** the Home screen renders in Auto mode
- **THEN** it shows the adaptive recommendation and a CTA to generate the concrete workout for that recommendation

### Requirement: Hero Workout Card Interactions
The hero card MUST adapt to whether a generated plan exists and let users generate or log with a single tap.

#### Scenario: Generated plan available
- **GIVEN** a `generated` workout exists for today
- **THEN** the card displays focus, duration, equipment badge, and AI source tag, plus `Start workout` and `Log done` buttons that call their respective handlers

#### Scenario: No plan yet
- **GIVEN** no plan exists for today
- **THEN** the card invites the user to "Generate a workout" with a primary CTA and a `Customize` secondary action that opens the unified customization sheet

#### Scenario: Offline/BYOK warning
- **GIVEN** the app detects missing connectivity or API key while the user tries to generate
- **THEN** the card blocks the action, surfaces an inline warning, and links to the BYOK/setup sheet defined for onboarding

### Requirement: Generation Customization Sheet
The mobile app MUST provide a unified generation customization sheet used for both initial generation and regeneration, exposing the full set of options available in the regenerate flow.

#### Scenario: Customize opens unified sheet
- **WHEN** the user taps `Customize` on the hero card before generating
- **THEN** the unified customization sheet opens with all option groups and helper text stating the changes apply to the next generated workout

#### Scenario: Regenerate opens unified sheet
- **GIVEN** a generated workout exists
- **WHEN** the user taps `Regenerate` or `Retry`
- **THEN** the same customization sheet opens with current plan values prefilled and a CTA to regenerate using the staged overrides

#### Scenario: Staged values persist across entry points
- **GIVEN** the user has staged overrides via quick actions
- **WHEN** they open the unified customization sheet
- **THEN** the staged selections are prefilled and match the quick action indicators

### Requirement: Generation Inputs & Activity Context
Users MUST be able to set core generation inputs in context with the Generate CTA and see at least the last three logged sessions from the home screen.

#### Scenario: Generation inputs integrated with CTA
- **GIVEN** the home screen renders the hero card
- **THEN** the generation input controls are visually grouped with the Generate/Customize actions so they read as pre-generation configuration, not separate quick actions

#### Scenario: Generation input chips
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

### Requirement: Generation Input Sheets Drive Generation
Generation input chips and the generation customization sheet MUST stage preset changes in local UI state, display the chosen values on each chip, and feed those overrides directly into the next generation request. The UI SHALL highlight unsynced edits and let users apply changes without immediately generating.

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

#### Scenario: Staged values sync with unified sheet
- **GIVEN** staged overrides exist in either a quick action sheet or the unified customization sheet
- **WHEN** the user opens the other entry point
- **THEN** the selections are prefilled and the staged indicators remain consistent across both surfaces

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

### Requirement: Training Plan Setup UI
The mobile UI MUST present adaptive setup as a flexible training plan rather than a fixed starter week for templates that support adaptive planning.

#### Scenario: Adaptive onboarding avoids fixed-week framing
- **WHEN** the recommended template creates an adaptive training plan
- **THEN** onboarding describes a flexible starting plan in plain language instead of exposing internal blocks, target ranges, or requiring the user to accept seven fixed days

#### Scenario: Simple setup remains concise
- **WHEN** a new user completes first-run onboarding
- **THEN** adaptive planning setup does not require advanced scheduling details before the user can reach Home

### Requirement: Plan Settings For Weekly Guidance
Plan Settings MUST allow users to inspect and edit weekly plan guidance without rerunning onboarding, while keeping internal adaptive training blocks and target ranges behind user-friendly labels.

#### Scenario: User edits weekly guidance
- **WHEN** a user changes Lift from 3-5 to 4-5 in Plan Settings
- **THEN** future recommendations use the updated guidance

#### Scenario: User edits typical week preference
- **WHEN** a user marks Friday as a preferred Legs day
- **THEN** weekly projections can bias toward Legs on Friday unless recovery or schedule context suggests a better swap

### Requirement: Home Recommendation Presentation
Home MUST show the recommended next session with a concise coach rationale and a clear path to generate, customize, or choose an alternative.

#### Scenario: Recommendation explains schedule swap
- **WHEN** Friday Legs is normally preferred but Saturday has a high lower-body hike
- **THEN** Home can show a coach note explaining that Legs was moved or swapped to protect the hike

#### Scenario: Combined session is visible
- **WHEN** the recommendation includes a primary block and add-on block
- **THEN** Home presents both parts before generation

### Requirement: Projection And Pinning Language
The mobile UI MUST distinguish projected suggestions from pinned commitments and user-owned events.

#### Scenario: Projected session can reflow
- **WHEN** a projected Friday workout changes after a new Saturday hike is added
- **THEN** the UI communicates the change as a coach adjustment rather than a user deletion

#### Scenario: Pinned session remains clear
- **WHEN** a user pins a workout to a date
- **THEN** the UI labels it as pinned or otherwise committed and does not present it as freely reflowing
