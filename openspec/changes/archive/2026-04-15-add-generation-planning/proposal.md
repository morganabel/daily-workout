## Why

Workout generation now has evaluation coverage and a local SQLite exercise library, but the core generation flow still asks the model to infer too much from raw app state. `Smart` focus is underdefined, regeneration is provider-asymmetric, and constraint-heavy sessions remain more prompt-fragile than they should be.

We need a dedicated generation-planning layer now so the server can convert raw request and context into a compact planning brief, derive bounded candidate pools from the exercise library, and support dependable regeneration across both OpenAI and Gemini before the next round of prompt and quality work.

## What Changes

- Add a server-side generation-planning flow that derives a deterministic planning brief from request inputs, merged user context, planned date, and optional regeneration baseline workout data
- Make `Smart` or auto focus operational by resolving session intent, protection rules, focus bias, and coarse load ceilings before model generation instead of relying on the model to infer everything from raw labels
- Use the SQLite exercise library as a prerequisite dependency and query it to build bounded candidate pools for generation and regeneration, including planning intent inputs, variation rules, and explicit fallback semantics
- Extend exercise-library requirements for planner-facing queries that support planner-backed candidate pools, baseline exclusions, and explicit no-match diagnostics instead of silent relaxation
- Make regeneration provider-aware so OpenAI can reuse provider-side continuity when available, while Gemini and any stateless path can regenerate from explicit baseline workout context plus fresh candidate pools
- Extend generation contracts only where operationally necessary, such as passing planning-date context, regeneration baseline data, and minimal provenance needed for safe regeneration behavior, while keeping diagnostics internal to the server or evaluation flow
- Preserve CE and hosted parity for planning behavior; hosted quota and BYOK behavior remain unchanged because this is a server-side planning refinement, not a new billing surface

## Capabilities

### New Capabilities

- `generation-planning`: Defines the deterministic planning brief, Smart-focus resolution, candidate-pool derivation, provider-aware regeneration rules, and planner fallback semantics used before workout generation

### Modified Capabilities

- `home-data`: Update workout-generation request and persistence requirements so the system can accept planning-date and regeneration-baseline inputs, preserve the minimal provenance needed for regeneration, and run library-backed planning before returning a `TodayPlan`
- `exercise-library`: Extend planner-facing query requirements to support planner-backed candidate selection, baseline exclusions for regeneration, and explicit diagnostics when the `planner-ready` subset cannot satisfy a request

## Impact

- Affected code: `packages/shared`, `packages/server-core`, `packages/server-ai`, `packages/server-exercise-library`, `apps/mobile`, `apps/server`, and generation evaluation or reporting paths that need to inspect planning decisions
- Affected APIs: `POST /api/workouts/generate`, generation request/context shape, stored generation metadata, and any minimal plan provenance needed for regeneration continuity
- Affected systems: OpenAI and Gemini provider prompting, server-side planning logic, mobile regeneration submissions, exercise-library validation or smoke tests for planner queries, and evaluation scenarios for Smart mode, constraint handling, fallback behavior, and regeneration quality
- Hosted/CE impact: both editions use the same planner behavior; existing BYOK, quota, and fallback policies remain in force
