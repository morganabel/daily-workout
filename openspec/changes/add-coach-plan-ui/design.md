## Context

The product vision calls for Apple-like simplicity and a personal trainer with memory. Once projection repair exists, the UI should expose it as a small set of coach actions rather than a planner dashboard.

This change depends on local Home data already exposing stable projection ids, skip semantics, pin behavior, and conflict warnings.

## Goals / Non-Goals

**Goals:**

- Show the next coach action clearly on Home.
- Show a compact forward projection for the upcoming window.
- Let users skip, pin, unpin, move, or generate from projected sessions with low friction.
- Warn on pinned conflicts and offer explicit repair actions.
- Keep plan settings outcome-focused.

**Non-Goals:**

- Build internal strategy configuration as a primary UI.
- Add external calendar sync.
- Add slot editing as a primary UI.
- Implement projection logic in UI components.
- Change provider billing, BYOK, or generation quotas.

## Decisions

### 1. Home Shows The Coach's Next Action

Home should prioritize the next useful session and concise rationale. The forward projection is secondary but visible enough to reduce planning uncertainty.

### 2. Upcoming Plan Is Compact

The upcoming projection should be scannable and action-oriented. It distinguishes projected suggestions, pinned commitments, skipped sessions, repaired sessions, and conflicts without becoming a dense planning console.

### 3. Repair Choices Are Explicit

When a conflict affects a pinned session, the UI offers clear actions such as keep, move, unpin, or regenerate around the conflict. It does not silently move the session.

### 4. Settings Are Outcome-Focused

Plan settings expose goal, availability, constraints, equipment, pinned commitments, and major events. Internal strategy ids and detailed mechanics are hidden, secondary, or debug-only.

### 5. UI Reads Data, It Does Not Plan

UI components invoke local data actions and render projection output. They do not independently compute strategy order, target balancing, or event repair.

## Risks / Trade-offs

- [Risk] Upcoming projection adds visual complexity to Home. Mitigation: show a compact preview and keep advanced details secondary.
- [Risk] Repair actions feel too manual. Mitigation: default to the coach's recommended action while still allowing user control for pinned commitments.
- [Risk] Strategy mechanics leak into copy. Mitigation: require UI tests/copy review that avoids internal strategy ids in primary surfaces.
- [Risk] UI ships before data behavior is stable. Mitigation: keep this change dependent on the projection/repair change.

## Migration Plan

1. Update Home data selectors to surface projection-ready state.
2. Update Home UI with next action and compact upcoming projection.
3. Add skip/pin/move/generate interactions from Home and calendar/history surfaces.
4. Add plan settings edits for goals, availability, constraints, equipment, pins, and major events.
5. Add UI tests and run mobile validation.
