## Why

The app should feel like a personal coach that plans ahead and adapts around real life, but the implementation path is too large to ship safely as one change. This umbrella change records the product and architecture direction, while implementation is split into smaller OpenSpec changes with clear prerequisites.

## What Changes

- Treat this change as the coach-program roadmap, not a direct all-at-once implementation change.
- Split implementation into four staged changes:
  - `add-coach-program-attribution`: session-level program attribution, adaptive-plan migration, deterministic initial strategy selection, and legacy fallback behavior.
  - `add-coach-projection-repair`: derived 7-14 day projection, cycle-anchored stable projection ids, durable skip records, move-as-pin semantics, pinned conflict warnings, event-aware repair, and two v1-functional strategies.
  - `add-coach-slot-generation-intent`: optional exercise-slot templates, slot assignment history, coach projection intent into generation planning, and session disposition flags for persistence.
  - `add-coach-plan-ui`: simple Home, calendar/history, and settings surfaces for the coach-managed plan.
- Make `ordered-rotation` and `weekly-target-balance` the v1-functional strategies for projection repair. Keep `fixed-calendar`, `minimum-effective-dose`, and `event-prep` as schema hooks until their behavior is specified in later changes.
- Resolve the projection persistence question: v1 derives projections in memory from durable program state, session attribution, history, pins, skips, and planned events. Projection records are repair outputs, not the source of truth.
- Define strategy selection as deterministic in v1. Blueprint/template seeding chooses the initial strategy; future strategy changes happen through explicit program revisions, not silent LLM mutation.
- Keep event awareness cross-cutting for normal strategies. Standalone event preparation is reserved for major dated goals when a later change defines concrete behavior.
- Note an intentional coupling: the UI stage's generate-from-projection action depends on coach projection intent entering generation planning, which ships in `add-coach-slot-generation-intent`. Shipping UI before the slot stage would require moving projection-intent-in-planning into the projection stage; the default order avoids that.

## Capabilities

### New Capabilities

- `adaptive-coach-program`: Behavioral roadmap-scope requirements for the coach-owned program model: v1 strategy scope and the simple coach experience. Sequencing and stage boundaries live in this change's design and tasks, not in spec deltas, so archived specs stay free of process requirements.

### Modified Capabilities

<!-- None. The four child changes own all deltas to training-plan, training-blueprint, home-data, generation-planning, and mobile-ui. -->

## Impact

- Affected OpenSpec changes: `add-coach-program-attribution`, `add-coach-projection-repair`, `add-coach-slot-generation-intent`, and `add-coach-plan-ui`.
- Affected code over the full roadmap: shared workout contracts, WatermelonDB workout schema and migrations, adaptive resolver logic, workout repositories and mappers, Home data builders, generation-planning inputs, and mobile Home/calendar/settings UI.
- CE/hosted impact: all roadmap stages preserve local-first CE behavior and existing BYOK/provider rules. Hosted sync, billing, and quota behavior are not changed by this roadmap.
