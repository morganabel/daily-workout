## Why

Workout generation now has an embedded exercise library and candidate-pool plumbing, but the server still relies on relatively loose prompt shaping rather than an explicit planning step. We need a structured generation planner now so the growing `planner-ready` library can drive more reproducible sessions, safer regeneration, and clearer fallback behavior when the library cannot fully satisfy a request.

## What Changes

- Add a new internal generation-planning capability that derives a structured planning brief from request inputs, merged user context, history, and exercise-library candidate queries before invoking a model
- Define block-level planning inputs, variation rules, and fallback semantics so regeneration can preserve workout intent while excluding prior exercise selections when possible
- Extend exercise-library requirements for planner-facing queries that support per-block candidate pools, baseline exclusions, and explicit no-match diagnostics instead of silent relaxation
- Keep the public `TodayPlan` response contract unchanged while allowing the server to record internal planning metadata for debugging and later evaluation work
- Preserve CE and hosted parity for planning behavior; hosted quota/BYOK behavior remains unchanged because this is a server-side planning refinement, not a new billing surface

## Capabilities

### New Capabilities

- `generation-planning`: Defines the internal server-side planning brief, block intent model, variation handling, and fallback semantics that shape workout generation before provider prompting

### Modified Capabilities

- `home-data`: Clarify that the generation endpoint executes an internal planning step before provider invocation while keeping the public `TodayPlan` contract unchanged
- `exercise-library`: Extend planner-facing query requirements to support block-scoped candidate selection, baseline exclusions for regeneration, and explicit diagnostics when the `planner-ready` subset cannot satisfy a request

## Impact

- Affected code: `packages/server-core`, `packages/server-ai`, `packages/server-exercise-library`, and server wiring in `apps/server`
- Affected APIs: no public response shape change; internal planner metadata and prompt inputs become richer and more structured
- Affected systems: server-side generation flow, regeneration behavior for stateless providers, exercise-library validation/smoke tests, and later evaluation/logging hooks
- Hosted/CE impact: both editions use the same planner behavior; existing BYOK, quota, and fallback policies remain in force
