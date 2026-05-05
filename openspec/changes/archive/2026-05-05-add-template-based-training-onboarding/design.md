## Context

The app already has the pieces for a better first-run experience: user preferences live locally, planned events can represent future context, and the existing workout generator can create a concrete `TodayPlan` when given focus, equipment, time, history, and upcoming events.

The onboarding gap is narrower than the full coach vision. New users need a simple way to establish a starter rhythm, such as push/pull/legs plus a conditioning day, without designing a training system. The data we save should be stable enough to support a later coach engine, but this change should not build that engine.

## Visual Reference

The archived onboarding mockup image was intentionally removed to keep binary assets out of the repo.

## Goals / Non-Goals

Goals:

- Keep onboarding short: goal, experience, and environment/equipment
- Infer a recommended starter template and show it before committing
- Infer schedule/rhythm defaults from the selected template instead of asking direct schedule questions during first-run onboarding
- Persist a local training blueprint that can seed future coaching work
- Create lightweight app-owned planned workout slots for the recommended starter week
- Support generating a concrete workout from a planned slot through the existing generation path
- Preserve existing one-off Today generation when onboarding is skipped or absent

Non-goals:

- Daily session resolver or coach recommendation engine
- Readiness/check-in collection, low-energy adaptation, or soreness adaptation
- Local training-state snapshot service
- Plan reconciliation after completed, skipped, partial, moved, or replaced sessions
- External calendar import or sync
- Full periodization, progressive overload programming, or monthly mesocycle planning
- Asking all users to choose strength/cardio counts, split type, preferred windows, or slot ordering during onboarding
- Generating full exercise prescriptions for every day in the starter week
- Adding a new hosted billing or quota path for template planning

## Decisions

### Decision: Onboarding asks three required questions

The first-run flow asks:

- Training goal
- Experience level
- Training environment/equipment

Those answers map to a recommended template such as balanced foundation, strength foundation, PPL conditioning, endurance support, or busy travel. The recommendation screen shows a human-readable starter week and offers `Use this plan` as the primary action, with `Adjust` and `Skip` as secondary actions.

Why:

- It keeps the default path consistent with radical simplicity
- It avoids turning onboarding into a power-user planner
- It still creates a useful training structure before the first generated workout

### Decision: Schedule assumptions are inferred, not asked directly

V1 does not include a separate preferred-days/windows or duration form in first-run onboarding. Templates define reasonable defaults for weekly rhythm, target duration, minimum useful duration, and likely location/equipment. Users can adjust these later from Profile/Plan Settings or through the recommendation adjustment path.

Why:

- The user explicitly wants a streamlined onboarding flow
- Asking schedule details too early makes onboarding feel like setup work
- Inferred defaults are enough to create a starter week while leaving room for later coaching features

### Decision: Store a training blueprint in local user preferences

The training blueprint is stored inside the existing `User.preferences` JSON so v1 does not need a WatermelonDB table migration. The shared schema should allow older preference JSON to parse without blueprint fields.

The blueprint should include at least:

- `templateId`
- onboarding answer summary
- inferred weekly rhythm
- default session duration assumptions
- default equipment/location assumptions
- slot role sequence
- setup status: completed or skipped
- user adjustment metadata
- horizon settings such as `horizonDays`, defaulting to 7 in v1

Why:

- Preferences are already the local source of truth for generation context
- JSON storage lets us iterate on blueprint shape without schema churn
- The user can edit the blueprint later from Profile/Plan Settings

### Decision: Planned events store lightweight planned workout slots

Accepting the recommended starter week creates blueprint-owned planned workout slots in existing `planned_events` records using `kind: 'workout'`. These records are the local calendar representation of the starter rhythm, not a full coach plan.

Planned-slot metadata should stay minimal and versioned:

- `schemaVersion`
- ownership/source marker
- template id
- slot id
- slot role/label
- planned date
- target duration
- equipment/location assumptions
- detail state
- locked/user-edited marker

Why:

- Planned events already power the calendar/agenda and generation context
- Starter-week slots belong in the same surface as other planned activity
- Minimal metadata keeps this change forward-compatible without implementing the future coach engine

### Decision: Detailed workouts are generated on demand

The starter week contains planned workout slots, not full exercise prescriptions. The app generates a concrete workout when the user opens or starts a slot that lacks a linked workout. The client may pass structured planned-slot intent into the existing generation path.

Why:

- A week of exact workouts is likely to drift as life changes
- Planned slots are cheap, inspectable, and easy to adjust
- Existing generation remains valuable as the final "turn this slot into today's workout" step

### Decision: Template planning is deterministic in v1

Template selection and starter-week slot placement are deterministic. The LLM is used only for concrete workout generation from a selected slot.

Why:

- Template planning should be predictable and cheap
- Hosted users should not spend quota on every setup refresh
- Deterministic tests can cover template selection, slot creation, and preservation behavior

### Decision: Mobile debug MCP reuses existing tools

The built-in mobile debug MCP should remain useful for this change through its existing shared-schema tools: profile preferences can be seeded with `set_profile_preferences`, planned workout slots can be seeded with `seed_planned_events`, planned slots can be inspected with `list_calendar`, and planned-slot generation can be exercised through `get_generation_context` and `generate_workout`.

V1 should update shared contracts, MCP contract tests, and MCP documentation as needed, but it should not add a new MCP tool unless the existing tools cannot seed or inspect the onboarding blueprint and planned-slot workflow.

Why:

- The MCP already exposes bounded access to profile preferences, planned events, generation context, and workout generation
- Reusing existing tools keeps the debug surface stable
- Contract tests should catch schema drift because MCP inputs depend on the same shared preference, planned-event, and generation request schemas

## Template Model

Initial templates:

- `balanced-foundation`: general fitness, mixed strength/cardio/recovery, low complexity
- `strength-foundation`: strength-focused full-body or upper/lower rhythm based on experience and equipment
- `ppl-conditioning`: push/pull/legs with one conditioning or sprint slot for gym-oriented intermediate/advanced users
- `endurance-support`: cardio-forward rhythm with strength support and recovery slots
- `busy-travel`: short, low-friction bodyweight/mobility rhythm for travel/hotel or minimal equipment

Template selection uses goal first, then experience and environment. The recommendation can still be edited before saving, but the default path is accepting the suggestion.

## Starter Week Slot Behavior

When a user accepts the recommendation, the app creates a 7-day starter week from:

- training blueprint
- template rhythm
- default session duration assumptions
- default equipment/location assumptions
- existing planned events
- current date

It should:

- create only blueprint-owned workout slots
- keep user-owned planned events separate
- avoid overwriting user-owned planned events
- avoid obviously poor starter-week placement when simple alternatives exist, such as sprint immediately adjacent to legs
- preserve slots that have been user-edited, locked, or linked to a generated workout

## Planned Slot To Workout Generation

When generating a concrete workout from a planned slot, the client should pass structured slot intent into the existing generation path. The server planning layer should treat explicit slot intent as stronger than generic Smart focus while still applying injuries, avoid list, equipment, history, and event protection.

Examples:

- `Pull` slot maps to pull/upper-body-pull focus with the user's default gym equipment
- `Sprint` slot maps to conditioning/sprint intent and protects nearby leg stress
- `Recovery` slot maps to mobility/recovery and low load

The public `TodayPlan` contract remains stable.

## Future Coach Engine Notes

This change intentionally seeds but does not implement the later coach engine. Follow-up changes can introduce:

- a richer coach profile model
- local training-state snapshots
- daily session resolution
- readiness/check-in inputs
- plan adaptation and reconciliation
- availability slots and calendar-derived scheduling
- a Home coach recommendation card

## Backward Compatibility

- Existing users with no blueprint keep the current Today generation path until they complete setup or accept a recommended plan
- Existing profile fields still feed generation even without a blueprint
- Existing planned events without blueprint metadata remain user-owned life events and must not be overwritten
- Skipped onboarding records a skipped state so the app does not repeatedly block first-run use

## Risks / Trade-offs

- Template mapping may feel too generic for power users: mitigate with post-onboarding Plan Settings and editable templates
- Calendar can become noisy: mitigate by generating only starter-week workout slots and preserving manual edits
- Planned slots may imply promises the detail generator cannot meet: mitigate by passing explicit slot intent and adding tests for slot-to-workout context
- Planned-slot metadata may outgrow `planned_events.metadata`: mitigate with a versioned metadata shape and avoid adding a table until the data shape stabilizes
- Onboarding could still feel like a form: mitigate with large chips, a recommendation screen, and concise copy consistent with existing mobile design

## Open Questions

- Should `Plan` become a first-class tab, or should planned slots initially live inside the existing History/Calendar tab?
- Should today/tomorrow detail generation happen automatically after onboarding, or only when the user taps a slot?
- How much of the power-user template editor belongs in v1 versus a follow-up change?
