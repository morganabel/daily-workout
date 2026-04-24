## 1. Planner Contract And Activation

- [x] 1.1 Add shared and server-core types for the stage-1 planner artifact, staged-planning mode metadata, and ambiguous-request activation outcome
- [x] 1.2 Implement server-side ambiguous-only activation heuristics covering Smart focus, conflicting recency or event context, dense notes, and regeneration feedback
- [x] 1.3 Add unit tests for activation decisions so clear explicit requests stay single-pass while ambiguous requests enter the staged path

## 2. Stage-1 Planner Routing

- [x] 2.1 Add a dedicated stage-1 planner interface in `server-core` and corresponding provider-facing interface in `server-ai`
- [x] 2.2 Implement OpenAI and Gemini stage-1 planner clients with structured planner-artifact output and configurable cheaper default models
- [x] 2.3 Add prompt-construction tests for stage-1 planning inputs and ensure planner captures are sanitized like existing generation prompt captures

## 3. Generation Pipeline Integration

- [x] 3.1 Wire the generate handler to derive the deterministic planning brief, decide staged-planner eligibility, and invoke stage 1 behind a feature flag
- [x] 3.2 Apply stage-1 planner output to candidate-pool retrieval or reranking without relaxing deterministic hard constraints
- [x] 3.3 Update stage-2 provider prompt construction so final generation receives the planner artifact, including explicit regeneration novelty guidance where applicable
- [x] 3.4 Add handler and integration tests covering Smart staged planning, single-pass fallback, and provider-aware regeneration behavior with planner artifacts

## 4. Evaluation And Diagnostics

- [x] 4.1 Extend evaluation-visible generation metadata so reports can distinguish staged and non-staged runs and capture planner-artifact summaries
- [x] 4.2 Add targeted evaluation coverage for ambiguous Smart requests, regeneration novelty, and mixed recency or event conflicts most likely to benefit from stage 1
- [x] 4.3 Run targeted live evaluations comparing staged and single-pass flows, then review whether the staged planner improves the existing failure slices

## 5. Rollout Validation

- [x] 5.1 Run project tests and typechecks for `@workout-agent-ce/server-core`, `@workout-agent-ce/server-ai`, `@workout-agent/shared`, and `@workout-agent-ce/server`
- [x] 5.2 Run the full live generation-evaluation corpus with prompt capture enabled and summarize staged-planner cost, latency, and hard-check deltas
- [x] 5.3 Update docs or internal notes describing the ambiguous-only activation strategy, feature-flag fallback, and hosted cost considerations
