## Context

The existing adaptive plan already provides the substrate for coaching: versioned plan data, blocks, target ranges, typical preferences, pinned sessions, projection status, coach notes, rationale, planned events, and resolver scoring for rotation, recovery, time fit, and event protection.

The next step is not one large feature. It is a sequence: first make session history attributable, then derive stable projections and repair them, then pass slot-level stability into generation, and only then expose the richer coach experience in the UI.

## Goals / Non-Goals

**Goals:**

- Keep the current adaptive plan as the foundation.
- Enforce implementation boundaries so attribution ships before projection repair.
- Avoid making push/pull/legs or queues the universal model.
- Resolve design questions that would otherwise block implementation.
- Preserve Apple-like simplicity: the coach chooses mechanics; users express goals, constraints, and life events.

**Non-Goals:**

- Implement the full coach program in this umbrella change.
- Make all five schedule strategies v1-functional.
- Persist projection records as authoritative state in v1.
- Add external calendar sync.
- Expose internal strategy ids as primary UI choices.

## Decisions

### 1. Implementation Is Split Into Four Changes

The roadmap is implemented through four child OpenSpec changes:

- `add-coach-program-attribution`
- `add-coach-projection-repair`
- `add-coach-slot-generation-intent`
- `add-coach-plan-ui`

This keeps the riskiest mobile data migration separate from projection logic, keeps generation prompt changes separate from program state changes, and keeps UI work from baking in behavior before the data layer is stable.

One coupling is intentional: coach projection intent enters generation planning in `add-coach-slot-generation-intent`, so the UI stage's generate-from-projection action requires the slot stage. If UI ever needs to ship earlier, projection-intent-in-planning moves into the projection stage first.

The umbrella's spec delta is limited to behavioral roadmap-scope requirements (v1 strategy scope, simple coach experience). Stage sequencing lives in this design and the tasks file so archived capability specs never contain process requirements.

### 2. Session-Level Attribution Is First

Exercise-level `blockId` fields are not enough to drive coach state. New work must add session-level attribution to workout records before completion, skip, or repair logic depends on it. Legacy substring matching remains only as a low-confidence fallback.

### 3. V1 Projection Uses Two Functional Strategies

The first projection/repair implementation supports `ordered-rotation` and `weekly-target-balance`. These cover the two important shapes: sequence-sensitive plans and exposure-balance plans. `weekly-target-balance` is the first non-queue fixture because the current target-range resolver already approximates it.

`fixed-calendar`, `minimum-effective-dose`, and `event-prep` stay as schema hooks until a later change defines concrete v1 behavior for each.

### 4. Projections Are Derived In Memory, Skips Are Durable

V1 projections are derived in memory from durable program state, attributed workout history, durable skip records, pins, planned events, and user constraints. Projection records may be cached inside a Home state calculation, but they are not persisted as authoritative state.

Skips are the exception that must be durable: skipping a projected session that was never generated has no workout record to carry status, so the projection stage persists coach session action records keyed by session identity. Moving a projected session is recorded as a pinned session preference at the new date (move-as-pin), keeping all date-anchored user intent in one durable input.

This matches the existing resolver philosophy and avoids reconciliation problems when history is edited or backfilled. Projection persistence can be revisited later for notifications, sync, or cross-device continuity.

### 5. Projection Session Identity Is Deterministic

Projection ids are derived, not random. The v1 id rule should use a stable hash of:

`programId + programVersion + cycleIndex + strategyId + sessionIdentityKey`

The `sessionIdentityKey` is strategy-specific:

- Pinned sessions: `pin:<pinId or sessionPreferenceId>`
- Ordered rotation: `ordered:<sourceBlockId>:<occurrenceOrdinalWithinCycle>`
- Weekly target balance: `target:<targetId>:<sourceBlockId>:<occurrenceOrdinalWithinCycle>`

Dates are not part of any identity key. A projected or pinned session's date is an attribute, so repair can move a session — including a pinned commitment moved by the user — while retaining its id.

`cycleIndex` is an integer derived from the program's active-from date and the device's current local calendar date (`floor(daysBetween(activeFrom, today) / 7)`), not a date string, so ids stay stable across daily refreshes within a cycle and re-anchor only at cycle boundaries. A timezone or clock change that moves the local date across a boundary causes a one-time re-anchor, which v1 accepts. Occurrence ordinals count completed, skipped, and substituted occurrences across the whole anchored cycle so pending sessions keep their identity as earlier occurrences resolve. The projection/repair change owns the precise rules and tests.

### 6. Strategy Selection Is Deterministic In V1

Blueprint/template seeding chooses the initial strategy using deterministic rules from goal, template defaults, availability, and constraints. LLMs may explain or suggest a change later, but they do not silently mutate the stored strategy.

If the coach changes strategy, it creates an explicit program revision with a reason, preserving target progress and attribution continuity.

### 7. Event Awareness Is Cross-Cutting

Planned events are normal inputs to ordered rotation and weekly target balance repair. They influence placement, duration, stress, and recovery recommendations. Event awareness is not its own default strategy. A standalone event-prep strategy is reserved for major dated goals in a later implementation.

## Risks / Trade-offs

- [Risk] Four changes create coordination overhead. Mitigation: keep this umbrella as the sequencing contract and make each child change independently valid.
- [Risk] Derived projections are harder to inspect than persisted rows. Mitigation: deterministic ids and idempotence tests make the output debuggable without making it authoritative.
- [Risk] Deferring three strategies leaves schema hooks unused. Mitigation: explicitly mark them as non-functional hooks until a later change specifies behavior.
- [Risk] Strategy selection rules can feel rigid. Mitigation: support explicit program revisions rather than silent mutation.

## Migration Plan

1. Implement `add-coach-program-attribution`.
2. Implement `add-coach-projection-repair` after attribution metadata is available.
3. Implement `add-coach-slot-generation-intent` after projection intent exists.
4. Implement `add-coach-plan-ui` once Home data can expose stable coach projection state.

## Open Questions

None for v1 sequencing. Projection persistence, first non-queue fixture, and strategy selection behavior are resolved above.
