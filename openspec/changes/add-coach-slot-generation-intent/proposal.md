## Why

Some coach programs need stable exercises or movement slots over time, while others benefit from variety. Once program attribution and projection intent exist, generation needs structured slot policy so it can preserve important work without turning every workout into a fixed template.

## What Changes

- Add optional exercise-slot templates for programs where stability matters.
- Track per-slot assignment history for stable, coach-rotatable, and user-locked slots.
- Pass coach projection intent and slot policy into generation planning.
- Preserve stable or locked slots when compatible with hard constraints.
- Record explicit override reasons when equipment, injury, avoid-list, or event-protection constraints force a slot replacement.
- Keep slots optional so general fitness, weekly balance, and other flexible goals are not over-constrained.

## Capabilities

### New Capabilities

<!-- None. -->

### Modified Capabilities

- `generation-planning`: Adds coach projection intent and optional exercise-slot policy as structured planning inputs.
- `training-blueprint`: Adds optional slot-template seeding for templates that need repeated exercises or movement slots.

## Impact

- Affected code: shared workout contracts, template definitions, generation request mapping, planning brief construction, staged planner inputs, provider prompt construction, workout persistence, and generation tests.
- Affected data: coach programs can carry optional slot templates and slot assignment history. Generated workouts persist slot attribution where relevant.
- Affected APIs: canonical `TodayPlan` content remains stable; internal generation inputs and local persistence metadata expand.
- CE/hosted impact: no change to provider policy or hosted billing. Slot-aware generation uses the same existing provider flow when AI generation is invoked.
