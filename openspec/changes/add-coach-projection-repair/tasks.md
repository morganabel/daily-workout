## 1. Projection Core

- [ ] 1.1 Add pure projection input/output types for a 7-14 day planning window
- [ ] 1.2 Implement deterministic integer cycle index derivation from the program active-from date and the device's current local calendar date so the id anchor only changes at cycle boundaries, using a `packages/shared` calendar-date ordinal helper (UTC-ordinal or equivalent), never local-midnight millisecond deltas divided by `DAY_MS`
- [ ] 1.2a Migrate the existing `daysBetweenLocalDates` helper in `adaptiveTrainingPlanResolver.ts` to the same `packages/shared` calendar-math helper so the recommendation and projection paths agree on day counts near DST boundaries
- [ ] 1.3 Implement deterministic projection id generation from program id, version, cycle index, strategy, and session identity key, with no calendar dates in identity keys (pinned identity is the pin record id alone) and occurrence ordinals counted across the whole cycle including completed, skipped, and substituted occurrences
- [ ] 1.4 Implement projection derivation from attributed history, skipped sessions, pinned sessions, planned events, target ranges, and constraints
- [ ] 1.5 Keep projection output in memory for v1 and avoid adding authoritative projection persistence

## 2. Durable Skip Records

- [ ] 2.1 Add a coach session action contract for skips with program id, program version, strategy, session identity key, projection id, source block id, projected local date, action date, and optional substitution reference
- [ ] 2.2 Add the WatermelonDB table, schema version, and migration for coach session action records
- [ ] 2.3 Record skip actions for both generated and never-generated projected sessions, updating workout status when a workout record exists
- [ ] 2.4 Add tests proving skips survive projection rederivation, cycle re-anchor, and program revision id changes

## 3. V1 Strategies

- [ ] 3.1 Implement ordered-rotation projection and repair
- [ ] 3.2 Implement weekly-target-balance projection and repair as the first non-queue strategy fixture
- [ ] 3.3 Add explicit unsupported/future-hook handling for fixed-calendar, minimum-effective-dose, and event-prep strategies

## 4. Repair Semantics

- [ ] 4.1 Implement explicit skip handling so skipped sessions do not count as completed exposure
- [ ] 4.2 Keep skipped ordered work pending unless a coach substitution is recorded
- [ ] 4.3 Implement move-as-pin: moving a projected session records a pinned session preference at the new date
- [ ] 4.4 Apply planned-event awareness across both v1 strategies for stress, duration, placement, and recovery decisions
- [ ] 4.5 Surface pinned conflict warnings without silently moving pinned sessions
- [ ] 4.6 Emit consolidated repair notes and avoid note churn on no-op repairs

## 5. Home Data Integration

- [ ] 5.1 Expose today's projection, upcoming projection, repair notes, skip actions, pin actions, and conflict warnings from local Home data
- [ ] 5.2 Ensure Home data does not overwrite user-owned planned events with coach projection output
- [ ] 5.3 Add local data tests for skip, pin, move, planned-event conflict, and no-op refresh behavior

## 6. Validation

- [ ] 6.1 Add projection determinism and idempotence tests for unchanged inputs
- [ ] 6.2 Add cross-day id stability tests within a cycle, explicit cycle-boundary re-anchor tests, and a moved-pin-keeps-id test
- [ ] 6.3 Add local-date and timezone edge tests for projection windows, cycle index derivation, and planned events, including a timezone change that moves the local date across a cycle boundary and DST spring-forward and fall-back crossings that must not change day counts or cycle indexes
- [ ] 6.4 Add fixtures for ordered rotation and weekly target balance
- [ ] 6.5 Run targeted mobile resolver/Home data tests through Nx
- [ ] 6.6 Validate this OpenSpec change with `openspec validate add-coach-projection-repair --strict`
