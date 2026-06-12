## 1. Home Data Surface

- [ ] 1.1 Add UI-ready selectors for today's coach recommendation, upcoming projection, repair notes, conflict warnings, and available actions
- [ ] 1.2 Add action handlers for skip, pin, unpin, move, and generate from projected coach sessions
- [ ] 1.3 Add tests proving Home data remains local-first and does not call a backend Home snapshot

## 2. Home UI

- [ ] 2.1 Update the Home hero to prioritize the coach's next recommended action and concise rationale
- [ ] 2.2 Add a compact upcoming projection view that distinguishes projected, pinned, skipped, repaired, and conflict states
- [ ] 2.3 Keep internal strategy ids out of primary Home copy and controls

## 3. Calendar And History Interactions

- [ ] 3.1 Add skip, pin, unpin, move, and generate-from-projection affordances where projected sessions appear
- [ ] 3.2 Add pinned conflict warnings with explicit keep, move, unpin, or regenerate-around-conflict actions
- [ ] 3.3 Ensure planned events remain user-owned and are not overwritten by projection actions

## 4. Plan Settings

- [ ] 4.1 Add outcome-level plan settings for goal, availability, constraints, equipment, pinned commitments, and major events
- [ ] 4.2 Keep advanced strategy mechanics hidden, secondary, or debug-only
- [ ] 4.3 Add copy/UI tests to prevent internal strategy labels from becoming required user choices

## 5. Validation

- [ ] 5.1 Add mobile UI tests for next action, upcoming projection, skip, pin, pinned conflict, and plan settings flows
- [ ] 5.2 Run targeted mobile tests through Nx
- [ ] 5.3 Validate this OpenSpec change with `openspec validate add-coach-plan-ui --strict`
