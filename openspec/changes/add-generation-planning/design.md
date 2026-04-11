## Context

The repository now has solid generation contracts, provider routing, structured outputs, scenario-based evaluation, and a packaged SQLite exercise library with `planner-ready` gating, BM25-assisted candidate ranking, and provider prompt integration for bounded candidate pools. That work solved the local exercise-source problem, but generation still lacks an explicit server-side artifact that says what kind of session should be built, how Smart focus should resolve, how block intent should be distributed, when prior exercise IDs must be excluded during regeneration, or how to behave when the bounded library cannot fully satisfy a request.

This change is where the server starts converting raw inputs into planning decisions before prompting. It is cross-cutting because it introduces a new internal planning stage between request or context normalization and provider prompting. It also raises the bar for the exercise-library query surface: the planner needs block-scoped candidate queries, explainable no-match diagnostics, and better readiness coverage for unresolved equipment or family gaps. The public `TodayPlan` contract should stay stable, and CE or hosted behavior should remain aligned apart from existing hosted billing and BYOK policies.

The design should improve generation quality without turning the system into a fully deterministic workout engine. The right scope is deterministic intent resolution plus bounded candidate selection, followed by model composition of the final workout.

## Goals / Non-Goals

**Goals:**

- Add a deterministic server-side planning brief that compresses request/context into decision-ready inputs for generation
- Resolve `Smart` focus into explicit session intent, disallowed stressors, and coarse load ceilings before model generation
- Use the SQLite exercise library to build bounded candidate pools that respect hard constraints, support style-aware biasing, and allow block-scoped planning
- Support dependable regeneration for both stateful and stateless providers by making baseline workout context explicit
- Add explicit planner-owned fallback semantics and planner-facing query diagnostics instead of relying on hidden relaxation
- Keep diagnostics internal while preserving a stable user-facing workout response as much as possible
- Make the planning flow inspectable enough that evaluation runs can compare planning outcomes, not just final workouts

**Non-Goals:**

- Do not build a fully closed-world workout engine in this change
- Do not require two LLM calls for every request by default
- Do not expose planning diagnostics, candidate pools, or reasoning traces in the public API response
- Do not solve long-term exercise progression, substitutions, or full coaching periodization in this change
- Do not add fine-tuning, few-shot libraries, or broad prompt experimentation frameworks here
- Do not lower the default `planner-ready` gate for production exercise-library queries

## Decisions

### Decision: Add a first-class PlanningBrief between context merge and provider generation

The server will derive a `PlanningBrief` from the generation request, merged user context, optional planning date, optional baseline workout, and provider/regeneration mode. Providers will consume the brief instead of raw `{ request, context }` payloads. The brief will capture normalized session intent, hard constraints, soft bias, unknown values, block-level goals, candidate pools, baseline exclusions for regeneration, and planner fallback mode.

Why this approach:

- It turns app state into a compact planning input rather than asking the model to infer priorities from raw fields
- It gives the system one authoritative place to encode source-of-truth rules, unknown handling, and deterministic pre-decisions
- It makes evaluation and future repair logic much easier to reason about

Alternatives considered:

- Keep raw prompt inputs and only rewrite the prompt: rejected because it leaves too much ambiguity in the upstream data shape
- Make the planner itself another LLM call: rejected for v1 because deterministic intent resolution is cheaper, easier to test, and sufficient for the current problem

### Decision: Make Smart focus a deterministic intent-resolution step

`Smart` or `auto` focus will no longer mean only "omit the focus and let the model decide." The planning layer will resolve recommended focus, disallowed focuses, protection rules, load ceiling, and session identity from recent-session summaries, event pressure, energy, goal, style, and environment constraints.

Why this approach:

- The existing data is strong enough to choose a sensible session direction, even if it is not strong enough to author the whole workout deterministically
- It reduces the largest source of ambiguity in current generation
- It gives the model a clearer job: compose a workout within a resolved intent

Alternatives considered:

- Full rules-based workout generation: rejected because it is too large a jump and would fight the existing LLM-first architecture
- Second LLM planning call for Smart mode: rejected for the first pass because it adds cost/latency before deterministic resolution has been proven insufficient

### Decision: Plan with bounded, block-scoped exercise-library candidate pools

The planning layer will query the exercise library to produce bounded eligible pools that reflect hard constraints and style/load biases. Where the session has distinct block intents, the planner will query per block instead of relying on a single flat candidate pool for the whole workout.

Why this approach:

- It captures most of the reliability gain without requiring a complete deterministic assembly engine
- Workout blocks often have different roles and constraints, so a single pool is too coarse
- It improves constraint-heavy cases such as quiet, travel, injury-sensitive, and style-specific sessions
- It makes stateless regeneration much more dependable, especially for Gemini

Alternatives considered:

- Keep open-world exercise generation with prompt-only guardrails: rejected because that is the current weakness
- Hard closed-world selection immediately: rejected because library coverage and prompt adaptation should be proven incrementally
- Keep a session-wide candidate pool only: rejected because it weakens block-level intent and makes prompt selection noisier when the candidate set grows

### Decision: Make regeneration explicitly provider-aware

The planning flow will distinguish stateful continuation from stateless revision. OpenAI may use provider-side continuity when the prior response provenance matches. Stateless paths, including Gemini and any provider mismatch, will regenerate using explicit baseline workout data, current merged context, and a fresh candidate pool.

Why this approach:

- It reflects the actual provider behavior instead of pretending all regeneration works the same way
- It prevents Gemini regeneration from losing injuries, style, event protection, or day identity
- It allows the mobile client to send one consistent regeneration request shape while the server chooses the correct provider path

Alternatives considered:

- Keep the current light-weight regeneration request and rely on provider memory: rejected because it is false for Gemini and fragile even for OpenAI
- Disable regeneration for stateless providers: rejected because the product needs regeneration to work across providers

### Decision: Keep fallback behavior explicit and planner-owned

When a block cannot be satisfied by the `planner-ready` subset, the planner will emit an explicit fallback reason and mode rather than silently relaxing hard constraints inside the query layer. The exercise-library query surface will grow planner-facing operations that support block-scoped candidate selection, baseline exercise exclusion, and structured blocker diagnostics for unresolved equipment, family, or completeness gaps.

Why this approach:

- It preserves the existing safety principle that hard filters are not silently weakened
- It makes failures and degraded coverage measurable instead of hiding them in prompt text
- Variation and regeneration depend on being able to exclude already-used exercise IDs deterministically
- The runtime planner needs explainable empty results, not just empty arrays

Alternatives considered:

- Auto-broaden exercise-library queries inside SQL: rejected because it would hide planner failures and make safety regressions harder to detect
- Keep diagnostics only in offline reporting scripts: rejected because the runtime planner needs immediate, query-local explanations for fallback decisions

### Decision: Keep diagnostics internal, expose only minimal operational provenance

Planning diagnostics such as reason codes, candidate pools, Smart-resolution outputs, protection flags, and fallback reasons will remain internal to server metadata and evaluation artifacts. The public response should stay close to the current `TodayPlan` contract, but the system may expose minimal provenance needed for safe regeneration continuity.

Why this approach:

- It keeps the user-facing contract simple
- It matches the direction to keep diagnostics internal
- It still leaves room for the server to distinguish stateful from stateless regeneration paths

Alternatives considered:

- Exposing full planning metadata in the public API: rejected because it creates unnecessary UI/storage churn and overexposes internal logic

## Risks / Trade-offs

- [The planning brief becomes too rigid and flattens creative workout composition] -> Mitigation: keep deterministic logic focused on intent, hard constraints, and candidate bounds, not full workout assembly
- [Smart-resolution rules drift from real quality outcomes] -> Mitigation: validate against the existing scenario corpus and targeted weak slices before broad rollout
- [Provider-aware regeneration still leaks asymmetry into user experience] -> Mitigation: standardize the regeneration request shape and make the server choose the correct provider path internally
- [Candidate pools are too narrow or too sparse] -> Mitigation: rely on the prerequisite exercise-library validation, keep deterministic hard filters auditable, and allow later controlled fallback policies outside this change
- [Request contract changes ripple through mobile and persistence] -> Mitigation: keep additions minimal and targeted to planning date, baseline workout context, and any necessary provenance fields
- [Remaining readiness gaps still force frequent fallback] -> Mitigation: pair planner work with targeted exercise-library diagnostics and follow-on coverage expansion for unresolved equipment or family buckets
- [Provider prompts become more complex] -> Mitigation: centralize the planning brief format in shared provider prompt helpers and test both initial generation and regeneration paths
- [Hosted/server logs expose too much internal detail] -> Mitigation: keep planning metadata internal, structured, and limited to server-side observability paths

## Migration Plan

1. Validate the SQLite exercise-library prerequisite and its planner-facing query contract.
2. Add shared request/plan contract fields needed for planning date, baseline workout context, and minimal regeneration provenance.
3. Add the server-side PlanningBrief derivation and deterministic Smart resolver without changing the final workout response shape.
4. Extend exercise-library planner queries for block-scoped candidate selection, exclusions, and structured no-match diagnostics.
5. Integrate exercise-library candidate-pool queries into initial generation and regeneration flows.
6. Update provider prompting to consume the planning brief and provider-aware regeneration inputs.
7. Update mobile regeneration submissions to always send full context and baseline workout data.
8. Validate against targeted evaluation slices, then run the full generation-evaluation corpus.
9. Roll back by disabling planning-brief and candidate-pool usage, leaving existing generation contracts in place where possible.

## Open Questions

- What is the smallest public provenance field needed to distinguish valid stateful regeneration from stateless fallback?
- Should `planningDateLocal` be optional with a server default, or required once the mobile client is updated?
- How much of candidate-pool structure should be provider-facing versus compressed into prompt-ready summaries?
- Should later repair-loop work live in this capability, or remain a follow-on change after the planning layer is proven?
- Should strict bounded-mode generation become the default once planner coverage is high enough, or should the first version remain a strong-preference model?
- Which remaining equipment or family gaps should be prioritized first so the planner sees the biggest reduction in fallback frequency?
