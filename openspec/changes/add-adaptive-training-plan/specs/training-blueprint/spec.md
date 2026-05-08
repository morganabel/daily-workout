## ADDED Requirements

### Requirement: Adaptive Plan Seeding From Templates
The system MUST allow template-based onboarding to seed an adaptive training plan for every selectable template.

#### Scenario: Template seeds adaptive plan
- **WHEN** onboarding selects any training template
- **THEN** the resulting setup creates an active adaptive training plan with reusable blocks, target ranges, typical week preferences, and recommendation settings

#### Scenario: Starter-week planned slots are not created
- **WHEN** onboarding saves a template-derived plan
- **THEN** the system does not create app-owned starter-week planned events for compatibility

### Requirement: Template Definitions Support Plan Blueprints
Training template definitions MUST be able to produce plan blueprints that include blocks, target ranges, typical week preferences, and recommendation rules.

#### Scenario: Template can describe ranges
- **WHEN** a template represents flexible fitness training
- **THEN** it can define target ranges such as 3-5 lift exposures and 2-3 cardio exposures over a rolling planning window

#### Scenario: Template can describe flexible ordering
- **WHEN** a template includes a preferred rotation such as Push, Pull, Legs
- **THEN** it can mark the rotation as coach-flexible rather than strict calendar ordering

## MODIFIED Requirements

### Requirement: Template-Based Training Blueprint
The system MUST create an adaptive training plan from simple onboarding answers instead of requiring users to manually design a weekly plan during first-run setup. The setup MUST identify a recommended training template, inferred rhythm, default duration assumptions, equipment/location assumptions, reusable blocks, target ranges, and whether the user accepted, adjusted, skipped, or later edited the recommendation.

#### Scenario: Onboarding answers map to an adaptive template
- **WHEN** a user completes onboarding with a goal, experience level, and training environment/equipment
- **THEN** the system maps those answers to one recommended training template and stores the resulting adaptive training plan locally

#### Scenario: Power-user structure is not required during onboarding
- **WHEN** a user completes the standard onboarding flow
- **THEN** the user is not required to choose strength-day counts, cardio-day counts, split type, preferred training windows, or slot ordering before seeing the recommended training rhythm

#### Scenario: Adaptive rhythm remains editable after onboarding
- **WHEN** a user opens plan settings after onboarding
- **THEN** they can adjust target ranges and inspect the template-derived rhythm without re-running onboarding

#### Scenario: Skipped onboarding does not block app use
- **WHEN** a user skips onboarding
- **THEN** the system records skipped setup state and preserves the existing one-off Today generation path

### Requirement: Starter-Week Planned Workout Slots
The system MUST NOT create app-owned starter-week planned workout slots from onboarding. Planned events are user-owned schedule context or later explicit projections, not compatibility artifacts for template onboarding.

#### Scenario: Accepted template does not create starter slots
- **WHEN** a user accepts a recommended training rhythm
- **THEN** the system stores an adaptive training plan and does not create app-owned planned workout events for a fixed 7-day starter week

#### Scenario: User-owned events are preserved
- **WHEN** adaptive recommendations read planned events for context
- **THEN** the system does not overwrite planned events that were created by the user or imported as life events

### Requirement: Template Rhythm And Spacing
The resolver MUST select recommended blocks based on the adaptive training plan, target ranges, preferred rotation, recent history, and upcoming events rather than blindly repeating fixed daily slots. For split templates, the resolver MUST use the template's preferred rotation. For conditioning templates, the resolver MUST preserve intended cardio or sprint frequency when feasible.

#### Scenario: PPL template includes push pull legs rhythm
- **WHEN** the adaptive plan uses a push/pull/legs rhythm
- **THEN** recommendations include push, pull, and legs blocks in the template-informed rotation when recovery and schedule context allow

#### Scenario: Sprint exposure is preserved when feasible
- **WHEN** the adaptive plan targets one sprint or high-intensity cardio exposure per week
- **THEN** recommendations include one sprint or equivalent conditioning block when spacing allows

#### Scenario: Sprint avoids adjacent leg stress
- **WHEN** the resolver recommends sprint and legs inside the same rolling window
- **THEN** it avoids stacking them when another valid placement exists

### Requirement: Planned Slot Detail Generation
The system MUST NOT require planned-slot generation intent. Concrete workout generation from the adaptive plan MUST use adaptive plan intent, planning date, equipment assumptions, recent sessions, user constraints, and nearby planned events.

#### Scenario: Adaptive generation passes block intent
- **WHEN** a user generates a detailed workout from a Pull recommendation
- **THEN** the generation request includes Pull block intent so the resulting planning brief resolves to a pull-oriented workout unless safety or explicit user changes override it

#### Scenario: Planned slots remain unnecessary for workout generation
- **WHEN** adaptive recommendations are computed
- **THEN** the system does not call an AI provider or create planned-slot records solely to place starter-week workouts
