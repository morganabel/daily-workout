## ADDED Requirements

### Requirement: Planner-Facing Candidate Queries

The exercise library query surface MUST support planner-facing candidate selection for block-level workout planning. Planner-facing queries MUST be able to apply block-specific constraints, bounded result limits, and baseline exercise exclusions while preserving the default `planner-ready` safety gate.

#### Scenario: Block-level query applies planner constraints

- **WHEN** the generation planner requests candidate exercises for a specific workout block
- **THEN** the library can return a bounded candidate pool that reflects that block's constraints, preferences, and search text while still enforcing hard filters

#### Scenario: Variation query excludes baseline exercise IDs

- **WHEN** the planner prepares a regeneration query with baseline exercise IDs that should be avoided
- **THEN** the library excludes those IDs from the candidate result while still applying the remaining hard filters and completeness gate

### Requirement: Planner Query Diagnostics

The exercise library MUST provide structured planner-facing diagnostics when the eligible `planner-ready` set cannot satisfy a planner query. Those diagnostics MUST identify the primary blocker categories needed for fallback and later coverage expansion.

#### Scenario: No-match result includes explicit blocker diagnostics

- **WHEN** a planner query returns no eligible `planner-ready` exercises
- **THEN** the library returns structured blocker diagnostics that let the server distinguish issues such as unsupported equipment, unresolved family coverage, or other planner-visible readiness gaps

#### Scenario: Diagnostics do not lower the completeness gate

- **WHEN** planner-facing diagnostics are returned for an empty result
- **THEN** the library still excludes lower-completeness exercises from the eligible set unless an internal non-production path explicitly requests them
