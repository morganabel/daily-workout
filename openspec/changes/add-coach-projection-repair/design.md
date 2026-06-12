## Context

The attribution change makes session history reliable enough to drive projection. This change builds the first forward-looking coach behavior on top of that substrate, but intentionally limits functional strategy behavior to ordered rotation and weekly target balance.

## Goals / Non-Goals

**Goals:**

- Derive a stable 7-14 day projection from local coach-program inputs.
- Implement ordered rotation and weekly target balance as v1-functional strategies.
- Use in-app planned events as cross-cutting conflict inputs.
- Support explicit skipped sessions.
- Warn on pinned conflicts.
- Keep projection repair deterministic and idempotent.

**Non-Goals:**

- Persist projection rows as authoritative state.
- Implement fixed-calendar, minimum-effective-dose, or dated event-prep behavior beyond unsupported hooks.
- Add exercise-slot templates or generation prompt changes.
- Build the final Home/calendar/settings UI.
- Integrate external calendar sync.

## Decisions

### 1. Projections Are Derived In Memory

V1 projection output is derived in memory from durable program state, attributed history, workout statuses, pins, planned events, and constraints. It may be cached inside Home state for rendering, but it is not the source of truth.

This keeps history edits, backfills, and skipped sessions self-healing because projection state is recalculated from durable inputs.

### 2. Stable Ids Are Deterministic

Each projected session id is a stable hash of:

`programId + programVersion + cycleIndex + strategyId + sessionIdentityKey`

The `sessionIdentityKey` is:

- Pinned session: `pin:<pinId or sessionPreferenceId>`
- Ordered rotation: `ordered:<sourceBlockId>:<occurrenceOrdinalWithinCycle>`
- Weekly target balance: `target:<targetId>:<sourceBlockId>:<occurrenceOrdinalWithinCycle>`

Dates are deliberately excluded from all identity keys. Projected dates are attributes of the session, not identity, so repair can move a projected session without changing its id. Pinned identity is the pin record id alone: the pin's date is also an attribute, so moving a pinned commitment to a new date keeps the same session id rather than appearing as delete-plus-create.

**Cycle anchoring.** `cycleIndex` is an integer, NOT a date: `floor(daysBetween(activeFrom, today) / 7)`, where both `activeFrom` and `today` are local calendar dates (no time component) and `today` is the device's current local calendar date. Because the index only changes at cycle boundaries, ids remain stable across daily Home refreshes within a cycle even though the projection itself always covers today forward. When the cycle boundary passes, all ids re-anchor deliberately; consumers must not depend on ids across cycle boundaries. Projections that extend past the current cycle's end derive those sessions against the next cycle's index so their ids survive the boundary.

**Timezone caveat.** Because `today` is the device's local calendar date, a timezone change (or device clock change) that moves the local date across a cycle boundary causes a one-time re-anchor, identical to a normal boundary crossing. Id stability is not guaranteed across such a shift; consumers already tolerate boundary re-anchors, and a westward-then-eastward flap near a boundary resolves itself within a day. V1 accepts this rather than persisting a monotonic cycle counter.

**Calendar math.** Calendar-day differences MUST be computed with calendar-date ordinal math (for example `Date.UTC` ordinals, or an equivalent tested local-date helper), never by subtracting local-midnight `getTime()` values and dividing by 86,400,000 milliseconds. Local-midnight deltas are off by one across DST spring-forward (a 7-day span is 167 hours, and `floor` undercounts), and because the DST offset difference between `activeFrom` and `today` does not depend on span, a millisecond-based `cycleIndex` would shift every cycle boundary by a day for half the year — systematic twice-yearly id re-anchoring. This helper should live in `packages/shared` as domain calendar math, not in a mobile-only UI utility, so mobile recommendation, projection, server, and evaluation paths share the same `LocalDate` semantics. The existing `daysBetweenLocalDates` helper in `adaptiveTrainingPlanResolver.ts` has exactly this `DAY_MS`/`floor` shape and must be migrated to the shared helper while the resolver is touched, so the recommendation path and the projection path agree on day counts near DST boundaries.

**Occurrence ordinals count consumed work.** `occurrenceOrdinalWithinCycle` is computed over the entire anchored cycle, counting completed, skipped, and substituted occurrences of the same block (or target/block pair), not just remaining projected ones. A pending session therefore keeps its ordinal and id as earlier occurrences resolve, instead of drifting when completed sessions leave the planning window.

### 3. Repair Minimizes Change

Repair starts from the prior derived projection for the same window when available, but recomputes from durable inputs. It preserves session identity and ids for unaffected projected sessions, changes only sessions affected by new conflicts or state changes, and emits one consolidated repair note per repair pass.

### 4. Two Strategies Are Functional In V1

`ordered-rotation` selects pending blocks in sequence while respecting recovery, target ranges, and planned events. Skipped ordered work remains pending unless substituted.

`weekly-target-balance` selects useful exposures based on target ranges over the rolling window. It does not require a strict queue and is the first non-PPL/non-queue fixture.

### 5. Skips Are Durable Records, Not Workout Rows

Skipping a projected session that was never generated cannot rely on a workout record. Skips persist as durable coach session action records in local storage (a new WatermelonDB table with its own schema migration in this change). A skip record stores:

- program id and program version
- strategy id
- session identity key (the durable key; derived hash ids are convenience references)
- projection id at the time of the action
- source block id when known
- the local date the skipped session was projected for and the local date of the action
- optional substitution reference (the workout id or block id the coach substituted for the skipped work)
- created timestamp

Skip records key on session identity key plus cycle index, not on the derived hash id, because hash ids regenerate at cycle boundaries and program revisions. The stored projected local date is data for display and disambiguation, not part of the key. Skipping a workout that WAS generated additionally updates that workout's status; the session action record is still written so projection derivation has one uniform durable input for skipped work. Recording a substitution on a skip record is the explicit mechanism that allows ordered work to be retired instead of staying pending.

### 6. Move Means Pin

Moving a non-pinned projected session is recorded as creating or updating a pinned session preference (the existing durable `sessionPreferences` input) at the chosen date. There is no separate "moved" state: a moved session is a user commitment, and unpinning restores normal projection flow. Moving an already-pinned session updates its pinned date. This keeps all date-anchored user intent in one durable input.

### 7. Event Awareness Is Cross-Cutting

Planned events can move, shorten, defer, or modify projected sessions for both v1 strategies. Event handling is not a separate default strategy.

### 8. Pinned Conflicts Warn

Pinned sessions remain pinned until the user changes them. If a planned event conflicts with a pinned session, projection emits a warning and possible repair actions instead of silently moving the session.

## Risks / Trade-offs

- [Risk] In-memory projection cannot power notifications directly. Mitigation: defer persisted notification support until projection behavior is stable.
- [Risk] Stable id rules may need adjustment after UI work. Mitigation: encode id derivation, cycle anchoring, and ordinal counting in tests before UI depends on it.
- [Risk] Cycle-boundary re-anchoring surprises consumers that cache ids. Mitigation: document the boundary behavior, derive past-boundary sessions against the next cycle anchor, and test cross-day and cross-boundary stability explicitly.
- [Risk] Weekly balance could still behave like a queue if fixtures are weak. Mitigation: add explicit non-ordered fixtures and tests where target pressure, not order, drives the result.
- [Risk] Unsupported strategy hooks are mistaken as implemented. Mitigation: schema and resolver must reject or fall back explicitly for non-v1 strategies.

## Migration Plan

1. Depend on session-level attribution from `add-coach-program-attribution`.
2. Add the coach session action table and WatermelonDB migration for durable skip records.
3. Add projection derivation helpers for ordered rotation and weekly target balance, including cycle anchoring and ordinal rules.
4. Add skip, move-as-pin, and pinned-conflict input handling.
5. Wire Home data to read derived projection output without changing UI surfaces beyond data availability.
6. Add deterministic/idempotence, cross-day stability, timezone, and fixture tests.
