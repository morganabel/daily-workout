# adaptive-coach-program Specification

## Purpose

Define the durable coach-program state that lets workout history, generated sessions, manual logs, skips, and future projection repair connect back to the plan that produced them.

## Requirements
### Requirement: Session-Level Program Attribution

The system MUST persist coach-program attribution at the workout session level for workouts generated from, logged against, completed from, or skipped from a coach program. Attribution MUST be available from the session record without requiring exercise-level logs.

Attribution MUST include program id, program version, primary source block id when known, add-on source block ids when a session combines blocks, optional template id, optional projection id, schedule strategy, source kind, and attribution confidence. Source kind MUST distinguish generated, manual-log, quick-log, substitution, and legacy-inferred sources so substituted work is not recorded as normal completion of the original block.

#### Scenario: Generated workout stores attribution

- **WHEN** a workout is generated from a coach-program recommendation
- **THEN** the saved workout session stores coach-program attribution for the source program and block

#### Scenario: Manual log can attach to coach source

- **WHEN** a user manually logs against a coach-projected or coach-recommended session
- **THEN** the saved workout session stores attribution to that coach source

#### Scenario: Attribution does not require exercise logs

- **WHEN** a workout session has no detailed exercise logs
- **THEN** the system can still identify its coach-program source from session-level attribution

#### Scenario: Combined session stores add-on attribution

- **WHEN** a generated workout combines a primary coach block with add-on blocks
- **THEN** the saved workout session stores the primary source block and add-on source blocks for target-progress accounting

### Requirement: Attribution Confidence

The system MUST distinguish explicitly stamped attribution from inferred legacy attribution. Explicitly stamped attribution MUST be preferred by program state derivation. Legacy inference from title, focus, or substring matching MUST be marked lower confidence.

#### Scenario: Explicit attribution wins

- **WHEN** a workout title conflicts with the session's stamped source block id
- **THEN** the system uses the stamped source block id

#### Scenario: Legacy inference is lower confidence

- **WHEN** an older workout lacks session-level attribution
- **THEN** the system may infer attribution from legacy fields but marks the result as lower confidence

### Requirement: Deterministic Initial Strategy Selection

The system MUST choose the initial coach-program schedule strategy deterministically during blueprint or template seeding. The strategy selection MUST use template defaults and available user context such as goal, availability, equipment, and constraints. The primary user experience MUST NOT require the user to choose internal strategy ids.

#### Scenario: Template selects strategy

- **WHEN** a user accepts a template-derived coach program
- **THEN** the stored program includes an initial schedule strategy chosen by deterministic template rules

#### Scenario: User is not asked for strategy id

- **WHEN** the standard setup flow asks the user for plan inputs
- **THEN** it asks for outcomes and constraints rather than internal strategy labels

### Requirement: Explicit Program Revisions

The system MUST represent strategy changes after initial seeding as explicit program revisions with a reason. The system MUST NOT silently mutate the stored strategy in response to an LLM response or background recommendation.

#### Scenario: Strategy change creates revision

- **WHEN** the coach changes a program from one schedule strategy to another
- **THEN** the program version increments and records the reason for the revision

#### Scenario: LLM cannot silently mutate strategy

- **WHEN** a model suggests a different planning strategy
- **THEN** the stored program strategy remains unchanged unless the system creates an explicit program revision

### Requirement: Forward-Compatible Generation Intent

The system MUST keep client-local coach intent metadata compatible with self-hosted server version skew. Generation API payloads MUST send only fields supported by the server-compatible adaptive intent contract unless a capability check allows newer fields. Local persistence, attribution stamping, and debug traces MAY retain richer client-local intent metadata.

#### Scenario: Client-only intent metadata stays local

- **WHEN** adaptive intent includes coach metadata newer than the server-compatible generation contract
- **THEN** the generation API payload omits those client-only fields
- **AND** local persistence still retains them for attribution and debugging
