## Why

Workout generation now needs stronger deterministic support for constraint-heavy planning, provider-safe regeneration, and style-specific candidate selection. The current system asks models to invent from the open world, which makes quiet, low-impact, injury-aware, travel-constrained, and specialized workouts more prompt-fragile than they should be.

We need a local, server-available exercise library now so future generation work can build bounded candidate pools, apply deterministic filtering before prompting, and support both CE and hosted deployments without introducing a new external dependency or billing surface.

## What Changes

- Add a new embedded SQLite-backed exercise library that is available to the server runtime through a read-only query layer
- Define a normalized exercise metadata model that supports deterministic filtering by equipment, impact, noise, space, travel friendliness, contraindications, style tags, and coarse load/soreness heuristics
- Add query capabilities for building eligible exercise pools and looking up exercises by stable ID so generation and evaluation flows can reuse the same source of truth
- Seed the exercise library with enough coverage for the current workout-generation needs, especially quiet/apartment, travel, injury-sensitive, and style-specific scenarios
- Update generation-facing requirements so server-side workout planning can derive bounded candidate pools from the exercise library without exposing diagnostics or internal selection metadata in the user-facing workout response
- Keep the exercise library fully local-first and compatible with CE self-hosting while making hosted behavior identical aside from normal deployment packaging

## Capabilities

### New Capabilities

- `exercise-library`: Defines the embedded SQLite exercise database, its normalized metadata, and the read-only query surface used by server-side planning and evaluation

### Modified Capabilities

- `home-data`: Clarify that workout generation may use a server-side exercise library to build deterministic candidate pools before model generation, while preserving the existing `TodayPlan` response contract

## Impact

- Affected code: likely a new shared or server-side exercise-library package/module, plus updates to `packages/shared`, `packages/server-core`, `packages/server-ai`, and generation/evaluation wiring that will later consume the query layer
- Affected APIs: no required public API expansion for end users in this change, but future generation requests and internal planning may depend on exercise-library-backed candidate selection
- Affected systems: server runtime packaging for the embedded SQLite asset, local dev/test workflows, CE and hosted deployment bundles, and generation evaluation/reporting that needs a deterministic exercise source of truth
