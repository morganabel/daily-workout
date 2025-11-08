# add-initial-mobile-ui

## Why
- The mobile app currently has no defined UI flows, so first-time users cannot see their daily workout context or start interacting with the system.
- We need a home screen that demonstrates the "radical simplicity" vision: one surface for generating, checking, and logging workouts.
- A written plan clarifies layout, states, and data needed before we touch code or assets.

## What Changes
- Introduce a single-screen home experience composed of a hero workout card, context-aware quick actions, and a lightweight activity list.
- Define the minimum UI states required (loading, empty state, generated workout present, and offline/BYOK banner).
- Outline the information architecture for shared components (e.g., quick action chips, session summaries) so future screens can reuse them.

## Success Criteria
1. New spec requirements capture what the initial UI must show, how users trigger key actions, and how empty or error states behave.
2. Tasks provide a clear, sequential checklist for implementing the UI inside the Expo app using existing Nx tooling.
3. Open questions (if any) are small enough to unblock implementation or clearly flagged for follow-up.

## Risks & Mitigations
- **Over-scoping:** Keep the first pass under one screen; defer analytics, settings, or deep history.
- **Data ambiguity:** Use mock data and deterministic API responses until the backend endpoints are ready.
- **Accessibility drift:** Include spacing/type guidance so implementation can follow platform defaults.

## Open Questions
- Should voice/free-text logging appear on the first version, or ship as a follow-up entry point?
- Do we show streaks/progress on day one, or wait for habit data?
