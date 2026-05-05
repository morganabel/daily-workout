## Why

The current onboarding/profile path collects useful facts, but it does not yet help a new user land on a sensible training rhythm. Users should be able to answer a few simple questions, see a recommended starter week, and begin from a structure that can later support a more coach-like experience.

This change keeps the scope focused on streamlined onboarding. It seeds future coaching with forward-compatible profile, blueprint, and planned-slot data, but it does not implement daily recommendations, readiness adaptation, training-state snapshots, or plan reconciliation.

## What Changes

- Add a lightweight onboarding flow that asks goal, experience, and training environment/equipment
- Map onboarding answers to a recommended starter template rather than asking users to design weekly structure up front
- Infer schedule/rhythm defaults from the selected template instead of adding a first-run schedule confirmation step
- Show a recommended starter week with `Use this plan`, `Adjust`, and `Skip`
- Persist onboarding answers, training blueprint/template id, inferred weekly rhythm, default duration assumptions, equipment/location assumptions, and setup state
- Create lightweight app-owned planned workout slots in existing `planned_events` for the starter week
- Keep planned-slot metadata minimal, versioned, and forward-compatible with a later coach engine
- Support generating a detailed workout from a planned slot through the existing generation flow by passing optional slot intent

## Capabilities

### New Capabilities

- `training-blueprint`: Covers template selection from onboarding answers, local blueprint storage semantics, starter-week planned slots, minimal planned-slot metadata, and planned-slot-to-workout generation behavior

### Modified Capabilities

- `user-profile`: Store onboarding answers, training blueprint, setup completion/skipped state, and editable plan settings in local preferences
- `mobile-ui`: Replace the passive profile prompt with guided onboarding, recommended starter week, and lightweight planned-slot surfaces
- `home-data`: Surface blueprint-owned planned workout slots from local planned events and support generating detailed workouts from a selected slot
- `generation-planning`: Optionally consume planned-slot intent as structured generation context so the existing workout generator can create the right concrete workout for that slot

## Impact

- Affected apps/packages: `apps/mobile`, `packages/shared`, `packages/server-core`, and `packages/server-ai` prompt inputs if planned-slot intent is passed through the existing generation path
- Affected storage: local `users.preferences` JSON and existing `planned_events` metadata; no WatermelonDB table migration expected for v1
- Affected APIs: no new public server endpoint required for v1; existing `POST /api/workouts/generate` may receive optional planned-slot intent through request/context fields
- Affected UI: first-run launch/onboarding, Profile/Plan Settings, Today/Plan calendar surfaces, and planned-slot detail generation affordances
- Affected debug tooling: mobile debug MCP shared contracts and docs should remain compatible with updated profile preferences, planned-slot metadata, and planned-slot generation context; no new MCP tool is expected for v1
- CE/hosted impact: CE remains fully local-first with BYOK generation only when concrete workouts are generated; hosted quotas/billing apply only to detailed workout generation, not deterministic template planning
