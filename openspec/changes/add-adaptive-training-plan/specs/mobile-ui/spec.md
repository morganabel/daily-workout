## ADDED Requirements

### Requirement: Training Rhythm Setup UI
The mobile UI MUST present adaptive setup as training rhythm rather than a fixed starter week for templates that support adaptive planning.

#### Scenario: Adaptive onboarding avoids fixed-week framing
- **WHEN** the recommended template creates an adaptive training plan
- **THEN** onboarding describes blocks, target ranges, and flexible weekly preferences instead of requiring the user to accept seven fixed days

#### Scenario: Simple setup remains concise
- **WHEN** a new user completes first-run onboarding
- **THEN** adaptive planning setup does not require advanced scheduling details before the user can reach Home

### Requirement: Plan Settings For Blocks And Ranges
Plan Settings MUST allow users to inspect and edit adaptive training blocks, target ranges, and typical week preferences without rerunning onboarding.

#### Scenario: User edits target range
- **WHEN** a user changes Lift from 3-5 to 4-5 in Plan Settings
- **THEN** future recommendations use the updated range

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
