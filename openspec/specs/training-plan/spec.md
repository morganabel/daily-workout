# training-plan Specification

## Purpose
TBD - created by archiving change add-adaptive-training-plan. Update Purpose after archive.
## Requirements
### Requirement: Adaptive Training Plan Model
The system MUST model adaptive training plans as durable user-specific plan instances that are separate from calendar events. A training plan MUST include a schema version, plan id, source template id, plan mode, active date range or start date, training blocks, target ranges, typical week preferences, recommendation settings, status, and updated timestamp.

#### Scenario: Plan is not a fixed week
- **WHEN** a user accepts an adaptive fitness plan
- **THEN** the stored plan represents blocks, ranges, and preferences rather than only a fixed 7-day slot sequence

#### Scenario: Calendar is not the plan source
- **WHEN** projected or pinned workout events exist on the calendar
- **THEN** the adaptive training plan remains the source of truth for recommendation and projection logic

### Requirement: Training Blocks
The system MUST define reusable training blocks for adaptive plans. Each block MUST identify its role, label, category, stress tags, default duration, target contributions, combination compatibility, conflicts, and optional recovery guidance.

#### Scenario: PPL conditioning blocks are represented
- **WHEN** the PPL + conditioning template creates an adaptive plan
- **THEN** the plan includes Push, Pull, Legs, Easy Cardio, Sprint, Abs or Accessory, Mobility, and Rest-style blocks where applicable

#### Scenario: Blocks carry stress tags
- **WHEN** a block represents Legs or Sprint
- **THEN** the block includes lower-body or high-impact stress tags that recommendation logic can use to avoid unsafe stacking

### Requirement: Target Ranges
The system MUST support target ranges over a planning window instead of only fixed weekly quotas. A target range MUST include a target id, label, applies-to criteria, window length in days, minimum count, maximum count, optional ideal count, and priority.

#### Scenario: Flexible fitness targets are stored
- **WHEN** a user has a PPL + conditioning plan
- **THEN** the plan can represent targets such as Lift 3-5, Cardio 2-3, Sprint 1, and Rest 0-2 over a rolling 7-day window

#### Scenario: Extra useful work is not treated as failure
- **WHEN** a user completes an extra lift while still within the target range
- **THEN** the plan state counts the exposure without marking the week as broken or noncompliant

### Requirement: Typical Week Preferences
The system MUST support typical week preferences that influence projections and recommendations without making those preferences fixed commitments. A typical week preference MUST identify a day of week, one or more preferred block ids, and a flexibility level.

#### Scenario: Preferred day can reflow
- **WHEN** a user normally prefers Legs on Friday and has a high lower-body hike on Saturday
- **THEN** the coach can recommend moving Legs earlier or replacing Friday with a lower-conflict block

#### Scenario: Pinned day is preserved
- **WHEN** a user pins a workout session to a specific date
- **THEN** the coach preserves that commitment unless the user changes or unpins it

### Requirement: Adaptive Recommendation Resolver
The system MUST compute a recommended next training session from the adaptive plan, recent completed sessions, target range progress, typical week preferences, pinned sessions, projected sessions, upcoming planned events, and available request context. The recommendation MUST include a primary block, optional add-on blocks, alternatives, rationale, and any coach notes about schedule adjustments.

#### Scenario: Recommends next useful PPL block
- **WHEN** the recent history shows Push followed by Pull and the user is not over lower-body recovery limits
- **THEN** the resolver can recommend Legs as the next primary block

#### Scenario: Protects upcoming lower-body event
- **WHEN** a lower-body-intensive event such as a hike is scheduled tomorrow
- **THEN** the resolver avoids recommending heavy Legs or Sprint today when another useful block is available

#### Scenario: Explains recommendation
- **WHEN** the resolver returns a recommendation
- **THEN** the result includes a concise rationale derived from plan state, recent history, targets, or upcoming events

### Requirement: Combined Session Recommendations
The system MUST support recommendations that combine one primary block with compatible add-on blocks. Add-on blocks MUST be scored against target ranges, available time, compatibility rules, conflict rules, and recent stress.

#### Scenario: Lift and easy cardio can combine
- **WHEN** Pull is the recommended primary block and the user is below the cardio target range with enough available time
- **THEN** the resolver can recommend Pull plus Easy Cardio as a combined session

#### Scenario: Conflicting blocks are not combined
- **WHEN** Sprint conflicts with heavy Legs according to block conflict rules
- **THEN** the resolver does not recommend Sprint as an add-on to heavy Legs unless the user explicitly overrides the recommendation

### Requirement: Schedule Projection Status
The system MUST distinguish preferred, projected, and pinned sessions. Projected sessions are coach suggestions that may reflow; pinned sessions are user commitments; preferred sessions are normal-pattern inputs.

#### Scenario: Projection can change after life event
- **WHEN** a user adds a Saturday hike after the weekly projection was created
- **THEN** affected projected sessions can reflow while pinned sessions remain unchanged

#### Scenario: User-owned events are inputs
- **WHEN** the calendar contains a user-owned hike, sport, travel, or other planned event
- **THEN** adaptive plan recommendations can use the event as schedule context without overwriting it

### Requirement: Extensible Coaching Foundation
The system MUST model adaptive training plans using reusable blocks, target ranges, typical week preferences, schedule projections, pinned sessions, and recommendation rationales so later coaching features can add multi-week progression, phases, template libraries, and adaptation without replacing the plan model.

#### Scenario: Future progression can attach to blocks
- **WHEN** a future change adds multi-week progression or deload logic
- **THEN** it can reference existing plan blocks and target ranges instead of replacing adaptive plans with prose or fixed calendar slots

#### Scenario: Templates can expand without new code paths
- **WHEN** future templates are added for different lifting or fitness styles
- **THEN** they can use the same plan, block, target range, preference, and recommendation schemas

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

