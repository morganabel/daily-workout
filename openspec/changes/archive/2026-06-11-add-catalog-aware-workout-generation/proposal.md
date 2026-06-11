## Why

Workout Agent can already constrain AI generation with a canonical exercise library, but every concrete workout still has to be composed by a model or mock path. A curated workout catalog gives the product a high-quality non-AI creation source, reduces unnecessary model use when a catalog workout is already an excellent fit, and sets up a server-owned catalog model that can later support community workouts.

## What Changes

- Add a server-side workout catalog whose recipes reference canonical exercise-library IDs and can be selected into canonical `TodayPlan` responses.
- Keep `POST /api/workouts/generate` as the single workout creation endpoint, adding explicit creation mode semantics instead of adding a separate library endpoint.
- Add catalog-aware routing for generation: excellent catalog matches return directly, ambiguous matches can be evaluated or adapted by the existing planner/AI flow, and weak matches continue through current AI generation.
- Add a user preference that allows users to opt out of AI features; in that mode, workout creation uses the catalog path and does not require provider keys, AI quota, or model metering.
- Preserve saved workout history by persisting resolved `TodayPlan` snapshots locally, even when the workout came from a catalog recipe.
- Keep CE and hosted behavior aligned: curated system catalog selection is available in both editions, while future hosted/community catalogs can extend the same relational catalog model.

## Capabilities

### New Capabilities

- `workout-catalog`: Defines the server-side catalog storage, recipe-to-exercise references, matching decisions, and catalog workout materialization.

### Modified Capabilities

- `home-data`: Generation requests gain explicit creation mode and `TodayPlan.source` can identify catalog/library workouts while preserving the existing endpoint.
- `generation-planning`: Planning can evaluate catalog fit before provider generation and can pass an ambiguous catalog match into AI adaptation.
- `user-profile`: User preferences can store whether AI features are enabled for workout creation.

## Impact

- Affected code: `packages/shared`, `packages/server-core`, `packages/server-exercise-library` or a catalog package adjacent to it, `packages/server-ai`, `apps/server`, and `apps/mobile`.
- Affected APIs: `POST /api/workouts/generate` remains the public creation endpoint but accepts creation mode and can return `source: 'library'`.
- Affected systems: exercise-library build/validation, generation planning, quota/metering policy, mobile profile/settings persistence, Home generation, evaluation scenarios, and future catalog/community data modeling.
- CE/hosted impact: catalog selection does not consume AI quota and does not require BYOK; AI-enabled hosted requests still use current entitlement behavior when the selected path invokes a provider.
