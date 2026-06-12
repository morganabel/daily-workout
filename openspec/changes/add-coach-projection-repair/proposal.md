## Why

Once workouts can be reliably attributed to a coach program, the app can reduce planning strain by projecting the next useful training window and repairing it when real life changes. This change keeps the first projection implementation narrow: two functional strategies, in-memory derived projection, explicit skips, stable ids, and planned-event-aware repair.

## What Changes

- Add a derived 7-14 day coach projection engine that reads coach program state, session attribution, history, pins, skips, planned events, and user constraints.
- Implement two v1-functional strategies: `ordered-rotation` and `weekly-target-balance`.
- Keep `fixed-calendar`, `minimum-effective-dose`, and `event-prep` as unsupported hooks for later changes.
- Treat planned events as cross-cutting inputs for placement, stress, duration, and recovery decisions.
- Add explicit skip semantics: skipped sessions do not count as completed exposures and do not advance ordered work unless substituted.
- Persist skips as durable coach session action records keyed by session identity, including skips of projected sessions that were never generated and optional substitution references.
- Record "move" of a projected session as a pinned session preference at the new date rather than introducing a separate moved state.
- Add pinned conflict warnings instead of silently moving pinned sessions.
- Use deterministic in-memory projection ids and idempotent repair. Ids anchor to the current program cycle (not the rolling current date) so daily refreshes do not churn ids. Projection outputs are not persisted as authoritative state in v1.

## Capabilities

### New Capabilities

<!-- None. -->

### Modified Capabilities

- `training-plan`: Adds derived multi-day projection and repair semantics for two v1 strategies.
- `home-data`: Adds local-first projection output, skip/pin actions, and conflict warnings sourced from the projection engine.

## Impact

- Affected code: adaptive plan resolver/projection helpers, local Home data builders, planned-event context mapping, workout skip/pin actions, a new coach session action table with WatermelonDB migration, and tests for local-date windows.
- Affected data: durable state is program data, session attribution, workout status, coach session action (skip) records, pins, and planned events. Projection records are derived in memory for v1.
- Affected APIs: no public server API change required.
- CE/hosted impact: projection remains local-first in CE and does not change hosted billing or quota behavior.
