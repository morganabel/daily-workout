## 1. Planning Model And Server Lifecycle

- [ ] 1.1 Define internal generation-planning types and a planner entrypoint in `packages/server-core`
- [ ] 1.2 Normalize generation inputs, merged context, and time budget into block intents, variation rules, and fallback policy
- [ ] 1.3 Thread planning metadata through the generation pipeline without changing the public `TodayPlan` response contract

## 2. Exercise-Library Planner Queries

- [ ] 2.1 Extend planner-facing exercise-library queries for block-scoped candidate selection and baseline exercise exclusions
- [ ] 2.2 Add structured no-match diagnostics that explain planner-visible blocker categories without silently relaxing hard filters
- [ ] 2.3 Expand readiness validation and smoke tests for planner-critical unresolved equipment/family gaps and fallback scenarios

## 3. Provider Prompt Integration

- [ ] 3.1 Update provider prompt builders to consume the structured planning brief rather than only a flat candidate summary
- [ ] 3.2 Reuse the same planning brief path for regeneration, including stateless provider flows and variation exclusions
- [ ] 3.3 Capture internal planning metadata and library-version context in logging or evaluation hooks

## 4. Verification And Rollout

- [ ] 4.1 Add server-core and server-ai tests for block planning, regeneration variation, and explicit fallback behavior
- [ ] 4.2 Document planner behavior, CE/hosted parity, and rollback expectations for the new planning path
