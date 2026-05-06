## Context

The app currently has strong pieces for single-session coaching: quick generation inputs, recent-session context, planned events, planned-slot intent, and a server-side planning brief. The latest onboarding work added a local `TrainingBlueprint` and materializes a 7-day starter week into `planned_events`.

That model is useful for a first-run starter rhythm, but it is not a durable planning model. Many lifting and fitness plans are weekly in language but not fixed to seven slots. A user may target 3-5 lift exposures, 2-3 cardio exposures, 1 sprint exposure, and 0-2 rest days over a rolling window. They may normally prefer legs on Friday, but a Saturday hike should cause the coach to swap or reflow that day. They may combine a lift and easy cardio in one session.

This change introduces an adaptive training plan layer that can use weekly mental models without making a fixed week the source of truth.

## Goals / Non-Goals

**Goals:**

- Introduce a durable adaptive `TrainingPlan` model for weight lifting and general fitness planning.
- Model plan templates as data-driven blueprints that can produce user-specific plan instances.
- Support reusable training blocks, target ranges, typical week preferences, projected sessions, pinned sessions, and recommendation rationales.
- Implement an initial deterministic next-session resolver that can recommend one primary block plus optional add-on blocks.
- Preserve user agency by distinguishing flexible projections from pinned commitments.
- Feed adaptive plan intent into the existing generation path without changing the public `TodayPlan` response contract.
- Keep CE and hosted behavior aligned; this change does not introduce billing, quotas, hosted-only planning, or server-only plan storage.

**Non-Goals:**

- Full multi-week periodization, deload scheduling, or mesocycle planning.
- Marathon or endurance-race-specific planning.
- AI-authored long-term plans or large template-library authoring tools.
- External calendar sync, reminders, or recurrence engines.
- Advanced training-load metrics such as tonnage, chronic load, monotony, strain, pace, or distance.
- Replacing one-off Today generation for users who skip onboarding or do not use an adaptive plan.

## Decisions

### Decision: Add `TrainingPlan` as the durable plan source

The adaptive plan should be stored as a user-specific plan instance, separate from `planned_events`. It should include plan metadata, source template, training blocks, target ranges, typical week preferences, recommendation settings, and updated timestamps.

Alternatives considered:

- Continue using `TrainingBlueprint.slotSequence`: rejected because a fixed sequence cannot represent ranges, flexible ordering, combined blocks, or projected-vs-pinned status cleanly.
- Store only calendar events: rejected because calendar events are outputs and commitments, not the durable plan logic.

### Decision: Keep typical week preferences, but make them flexible

Users often think in weeks. The plan should support preferences such as “I usually do legs on Friday” or “I prefer cardio Tuesday/Thursday.” These preferences should influence projections and recommendations, but they are not fixed unless pinned.

The system should distinguish:

- `preferred`: normal pattern; coach can reflow freely.
- `projected`: coach’s current suggestion for a date; can change as life happens.
- `pinned`: user commitment; preserve unless the user changes it.

### Decision: Use target ranges instead of fixed quotas

Planning targets should support ranges over a window, such as Lift 3-5 in 7 days or Cardio 2-3 in 7 days. The resolver should score whether a candidate helps keep the user inside or moving toward those ranges without treating optional extra useful work as failure.

This lets the coach say “you are already at 5 lift exposures, bias toward cardio or recovery” instead of “you missed Tuesday’s slot.”

### Decision: Model sessions as one primary block plus optional add-ons

The recommendation output should support combined sessions. For V1, a recommendation can have one primary block and zero or more add-on blocks. Blocks define compatibility rules, conflict rules, stress tags, and target contributions.

Examples:

- Pull + Easy Cardio
- Push + Abs
- Mobility + Easy Cardio

Sprint and heavy legs should normally conflict unless explicitly overridden.

### Decision: Start with a deterministic resolver

The first resolver should run locally and deterministically from structured inputs:

- adaptive plan
- recent completed sessions
- current rolling-window target progress
- typical week preferences
- upcoming planned events and stress tags
- pinned/projected sessions
- time, equipment, and energy if available

The resolver should output the recommended blocks, alternatives, rationale, and any coach note such as “Friday legs moved because of Saturday hike.”

AI can later help explain or refine recommendations, but the core plan state and safety constraints should not depend on an AI call.

### Decision: Calendar remains projection and commitment surface

`planned_events` should continue to represent calendar-visible items. Adaptive plans may create projected workout events for visibility and pinned events for commitments, but the plan is not defined by those events. User-owned events, hikes, sports, travel, and other planned events remain inputs to recommendation and projection.

### Decision: Reuse generation planning with richer intent

The existing planned-slot intent path already lets Home and History pass structured session intent into generation. This change should extend that concept with adaptive plan intent: plan id, recommendation id, primary block, optional add-ons, target range context, rationale, and relevant constraints.

The planning brief should treat adaptive plan intent as structured intent while still allowing injuries, avoid lists, equipment, energy, recent fatigue, and upcoming event protection to adjust the generated session.

### Decision: Preserve compatibility paths

Existing users with `TrainingBlueprint.slotSequence` continue to work. Existing planned slots remain valid and can still generate workouts. Adaptive templates can be introduced alongside starter-week templates, then later migrations can move starter users into adaptive plans when appropriate.

## Path To Full Coaching

This change is a stepping stone toward the full coach vision, not just a replacement for starter-week UI.

The core principle is: build reusable planning primitives now so future coaching features extend the model instead of replacing it.

Future changes should be able to add:

- broader data-driven template libraries with dozens or hundreds of templates
- template composition from split, conditioning, progression, recovery, and equipment modules
- multi-week phases, deloads, accumulation/intensification blocks, and periodization
- plan adaptation after skipped, moved, shortened, or unusually hard sessions
- richer training-state snapshots and coach evaluations
- AI-assisted plan tuning that operates on structured plan state

To keep that path open, this change should ensure recommendations are derived from structured blocks, ranges, projections, pins, and history instead of hardcoded seven-day slots or prose-only plans.

## Risks / Trade-offs

- More planning concepts could make the UI feel complex. Mitigation: keep first-run onboarding simple and expose blocks/ranges/preferences progressively in Plan Settings.
- Deterministic recommendations may feel too rigid at first. Mitigation: produce alternatives and rationale, and keep user override/generation paths simple.
- Storing adaptive plans inside preferences may become unwieldy. Mitigation: use preferences for V1 local-first simplicity, but version schemas so a later table/sync model can migrate cleanly.
- Projected events may be mistaken for commitments. Mitigation: label projected vs pinned clearly and avoid silently overwriting pinned or user-owned events.
- Existing starter-week behavior can diverge from adaptive plan behavior. Mitigation: preserve both paths during rollout and add tests for legacy planned-slot generation.

## Migration Plan

- Add versioned adaptive plan schemas without removing existing blueprint fields.
- Seed new adaptive plans from relevant templates, starting with PPL + conditioning.
- Keep existing users on their current starter-week slots until they opt into or edit the adaptive plan.
- Allow `TrainingBlueprint` to reference or seed an adaptive plan while preserving `slotSequence` compatibility.
- Rollback is safe because existing `planned_events`, `TrainingBlueprint`, and one-off generation remain valid if adaptive plan fields are ignored.

## Open Questions

- Should adaptive plans live in `UserPreferences` for V1 or get a local WatermelonDB table immediately?
- Should projected sessions be persisted as `planned_events`, computed on demand, or both?
- What is the minimum Plan UI needed for editing target ranges without creating setup friction?
- Should the first resolver consider user-entered energy/readiness, or defer that until a later coaching-state change?
