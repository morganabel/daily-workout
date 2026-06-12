## Why

After coach projections are stable in local data, the app needs to expose them in a way that reduces planning strain instead of adding configuration burden. The UI should feel like a personal coach: clear next action, compact forward plan, simple repair choices, and minimal strategy mechanics.

## What Changes

- Update Home data/UI to show today's coach recommendation and a compact upcoming projection.
- Add simple skip, pin, unpin, move, and generate-from-projection interactions.
- Add pinned conflict warnings with explicit repair actions.
- Add plan settings focused on goals, availability, constraints, equipment, pinned commitments, and major events.
- Keep internal strategy names and slot mechanics out of the primary UI.
- Preserve local-first behavior and avoid adding backend Home snapshot authority.

## Capabilities

### New Capabilities

<!-- None. -->

### Modified Capabilities

- `home-data`: Adds UI-ready coach projection state, actions, and conflict warnings.
- `mobile-ui`: Adds the coach-managed plan experience for Home, calendar/history interactions, and simple plan settings.

## Impact

- Affected code: mobile Home state selectors, Home screen, calendar/history surfaces, settings screens, local action handlers, and mobile UI tests.
- Affected data: reads projection, skip, pin, conflict, and repair state created by earlier changes. Does not introduce new authoritative planning data.
- Affected APIs: no public server API change required.
- CE/hosted impact: no billing, quota, or hosted-only behavior changes.
