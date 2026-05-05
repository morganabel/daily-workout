# training-blueprint Specification

## Purpose

Define the local training blueprint that maps simple onboarding answers into editable starter-week plans and planned workout slots.

## Requirements

### Requirement: Template-Based Training Blueprint
The system MUST create a local training blueprint from simple onboarding answers instead of requiring users to manually design a weekly plan during first-run setup. The blueprint MUST identify a recommended training template, inferred weekly rhythm, default duration assumptions, equipment/location assumptions, starter-week slot roles, horizon settings, and whether the user accepted, adjusted, skipped, or later edited the recommendation.

#### Scenario: Onboarding answers map to a starter template
- **WHEN** a user completes onboarding with a goal, experience level, and training environment/equipment
- **THEN** the system maps those answers to one recommended training template and stores the resulting training blueprint locally

#### Scenario: Power-user structure is not required during onboarding
- **WHEN** a user completes the standard onboarding flow
- **THEN** the user is not required to choose strength-day counts, cardio-day counts, split type, preferred training windows, or slot ordering before seeing the recommended starter week

#### Scenario: Blueprint remains editable after onboarding
- **WHEN** a user opens plan settings after onboarding
- **THEN** they can adjust the template-derived rhythm and default assumptions without re-running onboarding

#### Scenario: Blueprint stores horizon settings
- **WHEN** a blueprint is created
- **THEN** it records the starter horizon length, defaulting to 7 days for v1 while allowing a later 14-day coach horizon without changing ownership semantics

#### Scenario: Skipped onboarding does not block app use
- **WHEN** a user skips onboarding
- **THEN** the system records skipped setup state and preserves the existing one-off Today generation path

### Requirement: Starter-Week Planned Workout Slots
The system MUST create lightweight planned workout slots from the accepted training blueprint. V1 MUST create a 7-day starter week. The slots MUST be represented as app-owned planned workout events that describe intent such as pull, push, legs, sprint, conditioning, mobility, recovery, full body, or flexible.

#### Scenario: Accepted blueprint creates starter slots
- **WHEN** a user accepts a recommended starter week
- **THEN** the system creates app-owned planned workout events for the 7-day starter week according to the blueprint

#### Scenario: Planned slot metadata is minimal and versioned
- **WHEN** the starter-week service creates a blueprint-owned planned workout event
- **THEN** the event metadata includes schema version, ownership/source marker, template id, slot id, slot role or label, planned date, target duration, equipment/location assumptions, detail state, and locked/user-edited marker

#### Scenario: User-owned events are preserved
- **WHEN** starter-week slots are created or updated
- **THEN** the system does not overwrite planned events that lack blueprint ownership metadata or that the user manually edited

#### Scenario: Linked detailed workout stays attached
- **WHEN** a planned workout slot has a linked generated workout
- **THEN** the system preserves that link when reading or updating blueprint-owned slot metadata

### Requirement: Template Rhythm And Spacing
The starter-week service MUST select planned slot roles based on the training blueprint and template defaults rather than blindly repeating the same daily focus. For split templates, the service MUST use the template's ordered role sequence. For conditioning templates, the service MUST preserve intended cardio or sprint frequency when feasible.

#### Scenario: PPL template includes push pull legs rhythm
- **WHEN** the blueprint uses a push/pull/legs rhythm
- **THEN** the recommended starter week includes push, pull, and legs slots in the template-defined order

#### Scenario: Sprint day is preserved when feasible
- **WHEN** the blueprint includes one sprint or high-intensity cardio day per week
- **THEN** the starter week includes one sprint or equivalent conditioning slot when spacing allows

#### Scenario: Sprint avoids adjacent leg day
- **WHEN** the service places a sprint slot and a legs slot in the same starter week
- **THEN** it avoids scheduling them on adjacent days when another valid placement exists

### Requirement: Planned Slot Detail Generation
The system MUST support turning a planned workout slot into a concrete workout using the existing workout generation flow. The concrete workout generation request MUST include optional planned-slot intent, planning date, equipment/location assumptions, recent sessions, user constraints, and nearby planned events.

#### Scenario: Slot generation passes slot intent
- **WHEN** a user generates a detailed workout from a pull planned slot
- **THEN** the generation request includes pull slot intent so the resulting planning brief resolves to a pull-oriented workout unless safety or explicit user changes override it

#### Scenario: Generated workout links back to planned slot
- **WHEN** a detailed workout is generated from a planned slot
- **THEN** the resulting planned workout is linked to the source planned event so the starter-week surface can open it later

#### Scenario: Planned slots remain cheaper than workout generation
- **WHEN** the starter-week planned slots are created or updated
- **THEN** the system does not call an AI provider solely to place planned workout slots
