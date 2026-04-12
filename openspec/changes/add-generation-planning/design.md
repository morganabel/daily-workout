## Context

The repository now has a packaged SQLite exercise library, default `planner-ready` gating, BM25-assisted candidate ranking, and provider prompt integration for bounded candidate pools. That work solved the local exercise-source problem, but generation still does not have an explicit server-side planning artifact that says what kind of session should be built, how block intent should be distributed, when prior exercise IDs must be excluded during regeneration, or how to behave when the bounded library cannot fully satisfy a request.

This follow-on change is cross-cutting because it introduces a new internal planning stage between request/context normalization and provider prompting. It also raises the bar for the exercise-library query surface: the planner needs block-scoped candidate queries, explainable no-match diagnostics, and better readiness coverage for unresolved equipment/family gaps. The public `TodayPlan` contract should stay stable, and CE/hosted behavior should remain aligned apart from existing hosted billing and BYOK policies.

## Goals / Non-Goals

**Goals:**

- Introduce an internal `GenerationPlan`-style planning brief that the server derives before model invocation
- Make initial generation and regeneration share the same planning path, including baseline-exercise exclusions and explicit variation rules
- Give the planner block-level candidate pools and deterministic fallback semantics instead of relying only on a flat candidate list in the prompt
- Extend exercise-library planner queries so empty or weak coverage can be explained through explicit diagnostics rather than hidden relaxation
- Keep the user-facing `TodayPlan` schema unchanged while making planner metadata available for internal debugging and later evaluation work

**Non-Goals:**

- Do not expose planning artifacts, candidate diagnostics, or library coverage reports in public API responses
- Do not require the model to be fully closed-world or guaranteed to choose only from library exercises in the first iteration of this change
- Do not build a full progression engine, substitution graph, or long-term periodization model
- Do not add a hosted-only planning service, new quota model, or billing concept
- Do not lower the default `planner-ready` gate for production exercise-library queries

## Decisions

### Decision: Introduce an explicit internal planning brief before provider generation

The server will derive a structured planning artifact before calling the selected provider. That artifact will capture normalized session intent, time budget, request constraints, block-level goals, candidate pools, baseline exclusions for regeneration, and planner fallback mode.

Why this approach:

- It separates deterministic planning from model creativity so the server can reason about constraints before prompting
- It gives regeneration a reusable contract even for stateless provider flows
- It creates a stable internal seam for future evaluation and prompt tuning work

Alternatives considered:

- Continue passing only a flat candidate summary into prompts: rejected because it keeps planning behavior implicit and makes regeneration/fallback rules harder to reason about
- Move all planning decisions into provider-specific prompts: rejected because it fragments behavior across providers and reduces auditability

### Decision: Plan in block-scoped intents rather than one monolithic session pool

The planner will derive one or more block intents for the session and query the exercise library per block, rather than relying on a single flat candidate pool for the whole workout.

Why this approach:

- Workout blocks often have different roles and constraints, so a single pool is too coarse
- It makes variation rules more precise because exclusions and preferences can apply per block
- It improves prompt clarity by telling the model what each block is trying to accomplish

Alternatives considered:

- Keep a session-wide candidate pool only: rejected because it weakens block-level intent and makes prompt selection noisier when the candidate set grows

### Decision: Keep fallback behavior explicit and planner-owned

When a block cannot be satisfied by the `planner-ready` subset, the planner will emit an explicit fallback reason and mode rather than silently relaxing hard constraints inside the query layer.

Why this approach:

- It preserves the existing safety principle that hard filters are not silently weakened
- It makes failures and degraded coverage measurable instead of hiding them in prompt text
- It keeps relaxation policy in application code where it can be reviewed and tested

Alternatives considered:

- Auto-broaden exercise-library queries inside SQL: rejected because it would hide planner failures and make safety regressions harder to detect

### Decision: Extend exercise-library planner queries with exclusions and diagnostics

The exercise-library query surface will grow planner-facing operations that support block-scoped candidate selection, baseline exercise exclusion, and structured blocker diagnostics for unresolved equipment, family, or completeness gaps.

Why this approach:

- The planner needs explainable empty results, not just empty arrays
- Variation/regeneration depends on being able to exclude already-used exercise IDs deterministically
- The remaining readiness work is largely about filling specific planner-visible gaps rather than changing the core storage model

Alternatives considered:

- Keep diagnostics only in offline reporting scripts: rejected because the runtime planner needs immediate, query-local explanations for fallback decisions

### Decision: Keep planning metadata internal and edition-neutral

Planning metadata, candidate diagnostics, and fallback reasons will remain internal to the server/runtime path. CE and hosted deployments will use the same planner behavior, with no new public fields or billing implications.

Why this approach:

- It preserves the existing API contract and avoids leaking internal heuristics into client code
- It keeps hosted behavior aligned with CE except for the existing auth, BYOK, and quota controls
- It allows the planner to evolve without forcing client migrations

Alternatives considered:

- Expose planner metadata in `TodayPlan`: rejected because it couples internal planning to the public contract and adds UX noise

## Risks / Trade-offs

- [Planning logic becomes too rigid too quickly] -> Mitigation: keep the planner focused on intent shaping, bounded candidates, and explicit fallback, not full closed-world generation
- [Remaining readiness gaps still force frequent fallback] -> Mitigation: pair planner work with targeted exercise-library diagnostics and follow-on coverage expansion for unresolved equipment/family buckets
- [Provider prompts become more complex] -> Mitigation: centralize the planning brief format in shared provider prompt helpers and test both initial generation and regeneration paths
- [Hosted/server logs expose too much internal detail] -> Mitigation: keep planning metadata internal, structured, and limited to server-side observability paths

## Migration Plan

1. Add internal generation-planning types and a planner entrypoint in `packages/server-core`.
2. Extend exercise-library planner queries for block-scoped candidate selection, exclusions, and structured no-match diagnostics.
3. Update provider prompt inputs to consume the planning brief rather than only a flat candidate summary.
4. Reuse the same planner path for regeneration, including baseline exclusions and explicit fallback handling for stateless providers.
5. Add tests and logging/evaluation hooks around planning behavior while keeping the public `TodayPlan` response unchanged.
6. Roll back by bypassing the planner and returning to the existing generation prompt path; the public contract remains stable.

## Open Questions

- Should strict bounded-mode generation become the default once planner coverage is high enough, or should the first version remain a strong preference model?
- How much planner metadata should be persisted for later evaluation versus only logged transiently during generation?
- Which remaining equipment/family gaps should be prioritized first so the planner sees the biggest reduction in fallback frequency?
