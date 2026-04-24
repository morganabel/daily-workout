## Context

The current workout-generation path is: merge request and context, derive a deterministic `PlanningBrief`, build a bounded exercise-library candidate pool, and make one provider generation call. That shipped v1 intentionally avoided a second model call and kept planning deterministic except for final workout composition.

That architecture now has two clear strengths and one clear gap. The strengths are that hard constraints stay server-owned and inspectable, and explicit requests already perform well. The gap is that some requests are not mostly a filtering problem. Smart mode, dense notes, recent-session recency, upcoming events, and regeneration feedback often require interpretation, prioritization, and tradeoff selection before the final workout model can reliably compose the session.

We already have the infrastructure needed to validate a staged planner safely: provider routing is centralized, prompt capture exists in evaluation reports, and the scenario corpus covers Smart-focus, recency, event-protection, and regeneration cases. The design therefore needs to add an LLM-assisted planning stage without regressing the v1 guarantees around safety, simplicity, or stable public API behavior.

## Goals / Non-Goals

**Goals:**

- Add a stage-1 planner artifact that can interpret ambiguous requests before the final workout-generation call
- Run the stage-1 planner only when the request is ambiguous or high-risk enough to justify extra latency and cost
- Keep equipment, contraindication, avoid-list, and planner-ready gating deterministic and server-owned
- Let the stage-1 planner influence candidate retrieval or reranking and the stage-2 prompt without deterministically assembling the final workout
- Improve regeneration handling by giving the stage-2 model explicit novelty or rewrite guidance when the user wants a refreshed session
- Make the staged flow inspectable in evaluation so we can compare it against the current single-pass architecture

**Non-Goals:**

- Do not run two model calls for every generation request in v1
- Do not turn the planner into a fully deterministic workout engine or block-by-block exercise selector
- Do not require public request or response contract changes for the first release
- Do not replace hard checks or deterministic safety filters with planner output
- Do not solve long-term progression, periodization, or full coaching memory in this change

## Decisions

### Decision: Add a distinct stage-1 planner interface instead of overloading `ModelRouter.generate`

The stage-1 planner will be introduced as a separate internal interface and artifact flow rather than as an alternate mode of `ModelRouter.generate`. The existing model router is centered on returning a `TodayPlan`, while stage 1 needs to return an advisory planning artifact with confidence, bias, and novelty guidance.

Why this approach:

- It keeps the current workout-generation path readable and stable
- It avoids conflating "generate a workout" with "interpret ambiguous context"
- It gives evaluation and diagnostics a clean place to capture stage-1 outputs separately from stage-2 prompts

Alternatives considered:

- Reuse `ModelRouter.generate` with another output type: rejected because it weakens type clarity and makes provider orchestration harder to reason about
- Add stage-1 logic directly inside each provider prompt builder: rejected because it would hide routing and activation logic in prompt code

### Decision: Run stage 1 only for ambiguous or high-risk requests in v1

The server will compute an eligibility decision before stage-1 planning. Eligible requests include Smart-focus generation, conflicting recent-session or event contexts, dense free-form notes that materially steer the workout, and regeneration requests with feedback or clear rewrite intent. Explicit low-ambiguity requests will keep the current single-pass path.

Why this approach:

- It targets the scenarios where deterministic planning is least sufficient
- It limits added latency and hosted cost
- It lets us validate staged planning on the slices that are already producing the most planner-sensitive failures

Alternatives considered:

- Run the stage-1 planner for every request: rejected for v1 because it adds cost and complexity where there is little expected benefit
- Limit stage 1 to Smart mode only: rejected because regeneration and dense-note cases have the same interpretation problem

### Decision: Make the stage-1 artifact advisory, not a deterministic workout assembly plan

The stage-1 planner will return an artifact that resolves session intent, confidence, recovery priorities, stressors to protect or avoid, style or load bias, regeneration novelty targets, and candidate or prompt hints. It will not choose final exercises or build a fixed workout block plan.

Why this approach:

- It preserves the product direction that the model should still compose the workout
- It improves interpretation without recreating a rules engine in disguise
- It keeps the implementation small enough to evaluate cleanly against the current architecture

Alternatives considered:

- Deterministic block-level assembly after stage 1: rejected because it is broader than the current product direction and would overfit the system to planner structure too early
- Free-form planner reasoning only in prompt text: rejected because we need structured outputs that can be tested, logged, and compared in evaluation

### Decision: Keep deterministic hard constraints authoritative and apply planner output only inside that boundary

The existing deterministic filters remain the source of truth for equipment, avoid-list and injury exclusions, planner-ready gating, and baseline exercise exclusions. Stage-1 outputs may bias retrieval, rerank the bounded pool, or strengthen stage-2 instructions, but they may not expand the hard-filtered set or silently override server-owned constraints.

Why this approach:

- It protects the strongest property of the current planner implementation
- It keeps safety regressions detectable through the existing hard checks
- It prevents the stage-1 model from becoming an uncontrolled query broadening step

Alternatives considered:

- Allow stage 1 to directly relax constraints: rejected because it would make failures harder to explain and audit
- Ignore candidate retrieval entirely and use stage 1 only for prompt prose: rejected because some benefits come from better candidate ordering and exclusions

### Decision: Use stage-1 output to guide regeneration novelty explicitly

For regeneration requests, the planner artifact will include novelty or rewrite guidance that reflects feedback such as `different-exercises`, `just-try-again`, `too-hard`, or `too-easy`. The stage-2 prompt and candidate handling will use that guidance to better avoid baseline-adjacent rewrites while preserving the session's intent and hard constraints.

Why this approach:

- The remaining hard failures are concentrated in regeneration-difference scenarios, especially for Gemini
- Regeneration novelty is not just focus resolution; it is a distinct planning concern
- It creates a measurable lever without changing the public regeneration contract

Alternatives considered:

- Rely on the existing baseline exclusion path alone: rejected because current failures show that prompt behavior can still collapse back to near-identical sessions
- Add only post-generation difference checks: rejected because the system should try to plan for novelty before the final model call

### Decision: Extend evaluation artifacts to capture staged-planner behavior

The evaluation flow will capture whether stage 1 ran, the planner artifact summary, and the stage-2 prompt inputs. This will allow targeted A/B comparisons between the single-pass and staged flows on Smart-focus, regeneration, and other ambiguous slices before broad rollout.

Why this approach:

- Prompt capture is already in place, so staged-planner introspection is a natural extension
- It gives us a concrete way to justify the added latency and hosted cost
- It helps distinguish planner failures from final workout-generation failures

Alternatives considered:

- Judge the change only by final workout outputs: rejected because it makes regressions much harder to localize

## Risks / Trade-offs

- [Stage 1 adds cost and latency, especially in hosted mode] -> Mitigation: gate to ambiguous-only requests in v1 and record staged-planner usage in evaluation
- [Planner artifact becomes too prescriptive and reduces workout variety] -> Mitigation: keep stage 1 advisory and leave final composition to stage 2
- [Stage 1 and deterministic planner logic disagree] -> Mitigation: keep deterministic hard constraints authoritative and define clear precedence rules in the planner artifact contract
- [The extra planner call helps Smart mode but not regeneration novelty] -> Mitigation: include explicit novelty guidance in the artifact and measure regeneration-difference slices separately
- [Cross-provider behavior diverges because planner and final generation models react differently] -> Mitigation: keep the artifact normalized and inspectable, and compare both providers through the existing evaluation runner
- [Hosted rollout surprises operators with higher usage] -> Mitigation: document ambiguous-only activation, keep the path feature-flagged, and preserve rollback to the single-pass planner path

## Migration Plan

1. Add the stage-1 planner artifact types and internal routing interfaces behind a server-side feature flag.
2. Implement activation heuristics for ambiguous-only requests.
3. Add provider-backed stage-1 planner implementations using cheaper default models where configured.
4. Wire stage-1 output into candidate retrieval or reranking and stage-2 prompt construction.
5. Extend evaluation reporting to capture staged-planner metadata and compare against the current single-pass flow.
6. Validate targeted scenario slices first, then run the full live corpus.
7. Roll back by disabling the feature flag and reverting to the current deterministic-planning plus single-generation-call path without public API changes.

## Open Questions

- Should stage 1 and stage 2 always use the same provider, or should hosted/server-managed paths be allowed to mix providers internally?
- What is the smallest planner artifact that still improves regeneration-difference behavior materially?
- Should candidate reranking happen before prompt construction only, or should stage 2 also receive the planner artifact explicitly alongside the reranked pool?
- How should we choose default stage-1 models for OpenAI and Gemini in a way that is cost-aware but still evaluation-friendly?
