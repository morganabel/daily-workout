## ADDED Requirements

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

## MODIFIED Requirements

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
