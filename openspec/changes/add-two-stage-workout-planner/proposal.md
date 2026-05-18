## Why

The current generation flow still uses a single workout-generation model call after deterministic planning and candidate-pool construction. That works well for clear requests, but it is still weakest when Smart mode, recent-session context, upcoming events, dense notes, and regeneration feedback all interact and need interpretation rather than just filtering.

We want a two-stage planner now so the system can use a cheap stage-1 model only for ambiguous or high-risk requests, then feed that planner artifact into the final workout-generation call. This keeps hard constraints deterministic, improves context interpretation where the current flow still misses, and avoids paying extra latency or cost on simple explicit requests.

## What Changes

- Add an internal stage-1 LLM-assisted planning step that runs only for ambiguous generation cases such as Smart focus, context conflicts, dense free-form notes, and regeneration with feedback
- Define a planner artifact that captures advisory intent resolution, confidence, recovery priorities, novelty targets, and rerank/prompt hints without deterministically assembling the workout
- Keep equipment, avoid/injury filters, candidate safety gates, and other hard constraints deterministic and server-owned
- Use the stage-1 planner artifact to influence candidate retrieval or reranking and the stage-2 workout-generation prompt
- Add explicit regeneration novelty guidance so stage-2 generation can better avoid near-identical rewrites when the user asks for a refreshed workout
- Extend evaluation coverage and reporting so the staged planner can be compared against the current single-pass flow on targeted scenario slices and the full corpus
- Preserve CE and hosted behavior for billing and BYOK; the new planner remains an internal generation-path refinement, though hosted runs may incur an additional provider call for eligible requests

## Capabilities

### New Capabilities

<!-- None. -->

### Modified Capabilities

- `generation-planning`: Change planning requirements from deterministic-only pre-generation planning to a hybrid planner that can selectively use an LLM-assisted stage-1 artifact before final workout generation

## Impact

- Affected code: `packages/server-core`, `packages/server-ai`, `packages/shared`, `apps/server`, and evaluation/reporting paths that inspect generation behavior
- Affected APIs: no required public request or response changes in v1; generation remains behind `POST /api/workouts/generate`
- Affected systems: provider routing, prompt construction, regeneration behavior, candidate-pool shaping, evaluation runner, and generation report artifacts
- Hosted/CE impact: both editions keep the same functional behavior and BYOK rules; hosted may see extra cost/latency for eligible staged-planner requests while CE requires BYOK or managed provider credentials for generation
