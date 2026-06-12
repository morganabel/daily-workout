## ADDED Requirements

### Requirement: Optional Slot Template Seeding

Training blueprint definitions MUST be able to seed optional exercise-slot templates for programs where repeated exercises or movement roles matter. Blueprints MUST omit slot templates when the program does not need exercise stability.

#### Scenario: Strength blueprint seeds slots

- **WHEN** a strength-oriented blueprint depends on repeated main lifts or movement patterns
- **THEN** it can seed stable main slots and coach-rotatable accessory slots

#### Scenario: Flexible blueprint omits slots

- **WHEN** a general fitness blueprint does not require repeated exercises
- **THEN** it omits exercise-slot templates

### Requirement: Slot Policy Defaults

Blueprint-seeded slots MUST declare a stability policy. User-locked slots MUST only be created from an explicit user action, not from default template seeding.

#### Scenario: Template creates coach policy

- **WHEN** a blueprint seeds slot templates
- **THEN** default slots are stable or coach-rotatable rather than user-locked

#### Scenario: User lock is explicit

- **WHEN** a slot is marked user-locked
- **THEN** that lock came from an explicit user action
