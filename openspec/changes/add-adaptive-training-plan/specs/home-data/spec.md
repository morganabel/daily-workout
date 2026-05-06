## ADDED Requirements

### Requirement: Home Adaptive Plan State
Home data MUST expose the active adaptive plan state when available, including target range progress, recent relevant exposures, upcoming schedule constraints, projected or pinned sessions for the active date, and the current recommendation.

#### Scenario: Home loads recommendation from plan state
- **WHEN** a user with an adaptive plan opens Home
- **THEN** Home data includes the recommended primary block, optional add-on blocks, rationale, and alternatives for the active planning date

#### Scenario: Home falls back without adaptive plan
- **WHEN** a user has no adaptive plan
- **THEN** Home preserves the existing one-off Today generation and starter planned-slot behavior

### Requirement: Home Generation Uses Adaptive Recommendation
When a user generates from an adaptive recommendation, Home MUST build a generation request containing structured adaptive plan intent derived from the recommendation.

#### Scenario: Generate from combined recommendation
- **WHEN** Home recommends Pull plus Easy Cardio and the user taps Generate
- **THEN** the generation request includes the primary Pull block and Easy Cardio add-on intent

#### Scenario: User override beats recommendation
- **WHEN** the user explicitly changes the focus before generation
- **THEN** Home sends the explicit focus while retaining adaptive plan context only as background context where applicable
