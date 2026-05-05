## MODIFIED Requirements

### Requirement: Deterministic Smart Focus Resolution

When the user requests `Smart` or auto focus, the planning layer MUST resolve a recommended session intent before model generation. That resolution MUST account for recent training summaries, upcoming event protection, style or goal bias, environment constraints, and any planned-slot intent supplied by onboarding-created starter-week slots.

Planned-slot intent from a blueprint-owned planned event MUST be treated as explicit structured intent for that workout request, while still allowing safety constraints, user overrides, and nearby life events to modify load, exercise selection, or recovery emphasis.

#### Scenario: Smart focus protects a near-term event

- **WHEN** a user requests Smart focus and a demanding run or sport event is scheduled soon
- **THEN** the planning brief de-prioritizes stressors that would meaningfully reduce freshness for that event

#### Scenario: Smart focus shifts away from repeated recent overload

- **WHEN** recent session summaries indicate repeated emphasis on a movement pattern or body region
- **THEN** the planning brief biases away from repeating that same stress pattern unless the request explicitly overrides it

#### Scenario: Planned slot provides workout intent

- **WHEN** a generation request includes planned-slot intent for pull, push, legs, sprint, mobility, recovery, conditioning, full body, or flexible
- **THEN** the planning brief resolves the session intent from that planned slot before final workout generation

#### Scenario: Planned slot still honors safety constraints

- **WHEN** planned-slot intent conflicts with injuries, avoid-list, equipment, or near-term event protection
- **THEN** the planning brief adjusts load or exercise selection rather than blindly following the slot label

### Requirement: Server-Side Planning Brief

Before invoking workout generation, the system MUST derive a deterministic planning brief from the generation request, merged user context, optional planning date, optional planned-slot intent, and optional regeneration baseline workout. The planning brief MUST be the authoritative internal representation of generation intent for provider prompting.

The planning brief MUST distinguish hard constraints, soft bias, unknown values, planned-slot source, regeneration mode, and provider-aware execution mode.

#### Scenario: Planning brief is derived before generation

- **WHEN** a valid generation request is accepted
- **THEN** the server derives a planning brief before invoking the provider generation flow

#### Scenario: Missing values remain unknown instead of being invented

- **WHEN** request or context fields such as injuries, preferences, or recent history are absent
- **THEN** the planning brief records them as unknown or absent rather than inferring new facts

#### Scenario: Provider receives structured planning inputs

- **WHEN** a provider request is built from the generation flow
- **THEN** the prompt inputs include the planning brief's block intents and bounded exercise candidates rather than relying only on unconstrained workout prose

#### Scenario: Planned-slot source remains internal

- **WHEN** a workout is generated from an onboarding-created planned slot
- **THEN** planned-slot source metadata is available to internal planning and diagnostics without changing the public `TodayPlan` response contract
