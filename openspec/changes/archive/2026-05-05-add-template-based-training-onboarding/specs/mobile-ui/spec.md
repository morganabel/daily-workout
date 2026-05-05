## ADDED Requirements

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

The mobile app MUST display blueprint-owned planned workout slots in the plan/calendar experience and let the user generate or open detailed workouts from those slots.

#### Scenario: Planned slots render in agenda

- **WHEN** the user views a day or week with blueprint-owned planned workout events
- **THEN** the UI shows the slot label, scheduled day, target duration, detail state, and action affordance without requiring a generated workout yet

#### Scenario: Generate from planned slot

- **WHEN** the user taps Generate on a planned slot without a linked workout
- **THEN** the app starts concrete workout generation for that slot and shows pending/error/success state without losing the planned-slot intent

#### Scenario: Linked detailed workout opens

- **GIVEN** a planned slot has a linked generated workout
- **WHEN** the user taps the slot
- **THEN** the app opens the detailed workout preview or active workout flow for the linked plan

## MODIFIED Requirements

### Requirement: Mobile Home Screen Layout

The mobile app MUST present a single-scroll home screen that surfaces today's workout or today's next planned slot, quick generation controls, and recent activity without navigating away. When a training blueprint exists, the Home screen MAY treat the relevant planned slot as the source of today's workout intent.

#### Scenario: Screen structure

- **GIVEN** the user opens the app
- **THEN** the UI shows today's workout or next planned slot, generation controls, and recent activity within one scroll view

#### Scenario: Loading and empty state

- **GIVEN** the app has not fetched any plan data yet
- **THEN** the hero card shows a skeleton state, quick actions remain tappable, and the activity list shows placeholders or "No workouts yet"

#### Scenario: Planned slot appears before detailed workout exists

- **GIVEN** the user has a training blueprint and today's planned slot has no detailed workout
- **WHEN** the Home screen renders
- **THEN** it shows the planned-slot intent and a CTA to generate the concrete workout for that slot
