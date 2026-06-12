## ADDED Requirements

### Requirement: Blueprint Strategy Defaults

Training blueprint definitions MUST declare deterministic defaults for the initial coach-program schedule strategy. Blueprint seeding MUST choose the initial strategy from those defaults and user context without requiring a strategy picker in standard onboarding.

#### Scenario: General fitness seeds weekly balance

- **WHEN** a general fitness template prioritizes balanced exposures over strict sequence
- **THEN** blueprint seeding can choose weekly target balance as the initial strategy

#### Scenario: Split template seeds ordered rotation

- **WHEN** a template depends on a sequence of training blocks
- **THEN** blueprint seeding can choose ordered rotation as the initial strategy

### Requirement: Blueprint Strategy Selection Is Explainable

Blueprint strategy selection MUST produce a concise reason that can be stored for diagnostics or future UI explanation without exposing internal strategy mechanics as required setup choices.

#### Scenario: Strategy reason is recorded

- **WHEN** blueprint seeding chooses an initial strategy
- **THEN** it records a short reason based on the template and user context
