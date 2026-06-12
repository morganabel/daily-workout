## ADDED Requirements

### Requirement: Adaptive Plan Migration Preserves Behavior

The system MUST migrate existing adaptive training plan data into a coach-program-aware representation while preserving blocks, target ranges, typical week preferences, pinned sessions, recommendation settings, source template id, coach notes, rationale, status, and updated timestamp.

#### Scenario: V1 plan migrates

- **WHEN** an existing adaptive training plan is loaded after this change
- **THEN** the migrated data preserves the plan fields needed by current recommendation logic

#### Scenario: Recommendation behavior remains stable

- **WHEN** a migrated plan has no new session attribution inputs
- **THEN** the next recommendation remains consistent with the previous adaptive-plan behavior

### Requirement: Metadata-First History Attribution

Adaptive training plan history interpretation MUST use session-level coach attribution before exercise-level block metadata or legacy title/focus matching.

#### Scenario: Session attribution drives history

- **WHEN** a completed workout has session-level source block attribution
- **THEN** resolver history uses that source block to count the completed exposure

#### Scenario: Combined session attribution drives target progress

- **WHEN** a completed workout has session-level primary and add-on block attribution
- **THEN** resolver target progress counts all attributed source blocks that contribute to the target

#### Scenario: Exercise block metadata is secondary

- **WHEN** exercise-level block ids exist but session-level attribution points to a different source block
- **THEN** resolver history uses the session-level attribution for coach-program state
