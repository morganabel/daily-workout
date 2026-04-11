## 1. Shared Contracts And Request Shape

- [ ] 1.1 Add shared contract fields needed for planning-date context, explicit regeneration baseline workout input, and minimal regeneration provenance
- [ ] 1.2 Update request/plan validation tests to cover the new planning and regeneration contract fields without breaking existing canonical `TodayPlan` usage
- [ ] 1.3 Ensure mobile and server request builders can carry full merged context during regeneration

## 2. Planning Brief, Smart Resolution, And Server Lifecycle

- [ ] 2.1 Implement server-side `PlanningBrief` derivation from request, merged context, planning date, and optional baseline workout
- [ ] 2.2 Implement deterministic Smart-focus resolution for recommended intent, disallowed stressors, and coarse load ceilings
- [ ] 2.3 Normalize generation inputs, block intents, variation rules, and fallback policy without changing the public `TodayPlan` response contract
- [ ] 2.4 Add unit tests for planning-brief derivation, unknown handling, and Smart-resolution behavior across recent-session and upcoming-event cases

## 3. Exercise-Library Planner Queries And Candidate Pools

- [ ] 3.1 Integrate the SQLite exercise-library query layer as a prerequisite dependency for candidate-pool derivation
- [ ] 3.2 Extend planner-facing exercise-library queries for block-scoped candidate selection and baseline exercise exclusions
- [ ] 3.3 Add structured no-match diagnostics that explain planner-visible blocker categories without silently relaxing hard filters
- [ ] 3.4 Implement bounded candidate-pool construction from planning-brief constraints and style/load bias
- [ ] 3.5 Add tests that candidate-pool derivation honors hard filters, stable ordering, and explicit fallback scenarios for representative constraint-heavy cases

## 4. Provider-Aware Generation And Regeneration

- [ ] 4.1 Update provider prompting inputs to consume the planning brief and candidate-pool context instead of raw request/context payloads
- [ ] 4.2 Implement provider-aware regeneration routing so stateful continuity is used only when valid and stateless regeneration uses explicit baseline workout data otherwise
- [ ] 4.3 Update mobile regeneration submissions and server handling so full context and baseline workout data are available for both OpenAI and Gemini flows

## 5. Internal Diagnostics, Evaluation, And Validation

- [ ] 5.1 Record internal planning diagnostics needed for debugging and evaluation without exposing them in the public response
- [ ] 5.2 Capture library-version context and planner fallback metadata in logging or evaluation hooks
- [ ] 5.3 Extend targeted generation-evaluation coverage for Smart mode, event protection, constraint-heavy candidate pools, explicit fallback behavior, and provider-aware regeneration behavior
- [ ] 5.4 Validate the OpenSpec change and confirm readiness for implementation after the SQLite exercise-library prerequisite is available
