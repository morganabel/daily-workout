## ADDED Requirements

### Requirement: Adaptive Plan Seeding From Templates
The system MUST allow template-based onboarding to seed an adaptive training plan when the selected template is better represented by blocks, target ranges, and flexible preferences than by a fixed starter-week slot sequence.

#### Scenario: PPL template seeds adaptive plan
- **WHEN** onboarding selects a PPL + conditioning style template
- **THEN** the resulting setup can create an adaptive training plan with Push, Pull, Legs, cardio, sprint, recovery, and accessory blocks instead of relying only on seven fixed starter slots

#### Scenario: Starter-week templates remain valid
- **WHEN** a user selects or already has a simple starter-week template
- **THEN** the existing starter-week slot workflow remains valid until the user opts into or migrates to an adaptive training plan

### Requirement: Template Definitions Support Plan Blueprints
Training template definitions MUST be able to describe plan blueprints that include blocks, target ranges, typical week preferences, and recommendation rules in addition to or instead of starter-week slot sequences.

#### Scenario: Template can describe ranges
- **WHEN** a template represents flexible fitness training
- **THEN** it can define target ranges such as 3-5 lift exposures and 2-3 cardio exposures over a rolling planning window

#### Scenario: Template can describe flexible ordering
- **WHEN** a template includes a preferred rotation such as Push, Pull, Legs
- **THEN** it can mark the rotation as coach-flexible rather than strict calendar ordering
