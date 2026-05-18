## Context

Workout generation already has solid contract validation and provider routing, but it lacks a disciplined way to learn from output quality across many realistic inputs. Today the repository can prove that requests parse, providers return valid JSON, and the transformer normalizes output, but it cannot quickly answer founder-level questions such as "What happens for a beginner with bodyweight only and low energy after a hard leg day?" or "Did the latest prompt tweak improve regeneration quality across the same scenario set?"

The desired change is intentionally evaluation-first rather than architecture-heavy. It should help the team review at least 50 scenarios, run repeated stochastic generations, and compare providers or prompt/context changes without pretending LLM outputs are deterministic snapshots. The design must preserve CE simplicity, avoid collecting secrets in reports, and make hosted-provider cost implications explicit.

## Goals / Non-Goals

**Goals:**

- Provide a versioned scenario corpus with at least 50 realistic workout-generation cases covering request fields, merged context, regeneration, and upcoming-event pressure
- Separate deterministic checks from stochastic evaluation so plumbing can be tested normally while workout quality is reviewed by rules and scoring
- Make evaluation runs easy to execute locally in CE and intentionally controlled in hosted/BYOK environments
- Produce reports that let a founder review failures and patterns quickly, including AI-assisted soft scoring when desired
- Keep implementation additive and low-risk for the existing generation flow

**Non-Goals:**

- Do not introduce a user-facing analytics dashboard in the product UI
- Do not make generated workouts deterministic or require exact-output snapshot testing
- Do not add server-side persistence for full evaluation history in the first iteration
- Do not expand the production API surface with secrets, raw prompts, or provider credentials
- Do not solve long-term experimentation storage, multi-user benchmarking, or automated model selection

## Decisions

### Decision: Use a versioned scenario corpus as the evaluation backbone

The system will define a scenario corpus stored in-repo and treated as a product artifact, not as ad hoc test data. Each scenario will capture the real inputs that influence generation today: request payload, optional merged context, optional regeneration feedback, optional upcoming events, execution mode, and expected hard constraints.

Why this approach:

- It matches how the product actually generates workouts today
- It supports repeated stochastic runs without requiring exact output snapshots
- It creates a shared language for prompt tuning, provider comparison, and regression review

Alternatives considered:

- Generating random fuzz cases only: rejected because it produces broad coverage but weak founder intuition and poor reviewability
- Hand-testing only in the mobile UI: rejected because it is too slow and not replayable

### Decision: Split deterministic verification from stochastic evaluation

Deterministic logic will remain covered by normal tests for schema validation, context merge behavior, provider selection, fallback rules, and prompt construction. Stochastic evaluation will run separately and score outputs against hard rules and soft review dimensions.

Why this approach:

- It avoids false confidence from brittle snapshots
- It keeps CI-friendly logic separate from more expensive, variable provider runs
- It makes failures easier to diagnose as either plumbing issues or model-quality issues

Alternatives considered:

- Putting all evaluation into Jest: rejected because live model behavior and repeated-run review do not fit well into deterministic unit tests
- Using AI review only: rejected because hard constraints must remain rule-based and auditable

### Decision: Require both hard checks and optional AI-assisted soft review

Every scenario run will produce rule-based hard-check results such as schema validity, time fit, equipment compatibility, injury/avoid safety, and regeneration difference. Soft review dimensions such as clarity, plausibility, novelty, and appeal can be scored by an optional AI reviewer or by manual founder review.

Why this approach:

- Hard checks provide objective guardrails for safety and usefulness
- Soft review captures the subjective quality that makes the product lovable
- AI assistance speeds review across 50+ scenarios without replacing human judgment

Alternatives considered:

- Manual review only: rejected because it does not scale well across repeated runs and provider comparisons
- Hard checks only: rejected because workouts can pass constraints and still feel generic or unappealing

### Decision: Keep evaluation execution explicit and cost-aware

Evaluation runs will declare provider choice, run count, and review mode up front. CE workflows should work with env keys, BYOK, or an explicit fixture provider for plumbing checks. Hosted-oriented evaluation must surface missing-key, quota, and estimated usage issues before launching broad runs.

Why this approach:

- It respects the open-core model and avoids surprise provider spend
- It keeps CE self-hosting practical
- It makes hosted overlays and billing concerns visible without coupling the first version to billing systems

Alternatives considered:

- Silent provider auto-selection: rejected because it hides cost and makes comparisons harder to trust
- Hosted-only evaluation: rejected because CE should remain fully usable for development

### Decision: Reports must be sanitized and reviewer-friendly

Reports will include scenario identity, execution metadata, effective generation inputs, plan summaries, hard-check results, and soft-review notes/scores. Reports must never include API keys or other secrets, and should favor markdown/JSON outputs that are easy to diff, summarize, and inspect with AI assistance.

Why this approach:

- It keeps privacy-first and BYOK safety intact
- It supports fast founder review loops
- It avoids overbuilding storage or dashboards

Alternatives considered:

- Persisting all reports server-side: rejected for the first iteration because it adds unnecessary complexity and privacy concerns
- Logging raw prompts and secrets for debugging: rejected because it violates safety expectations

## Risks / Trade-offs

- [Evaluation corpus drifts away from real user needs] -> Mitigation: require scenario categories tied to current product personas, constraints, and planned-event contexts; update corpus as the product learns
- [AI-assisted soft review becomes the de facto judge] -> Mitigation: keep AI review optional, store rubric-aligned outputs, and preserve manual founder sign-off for important prompt changes
- [Provider cost grows too quickly during repeated runs] -> Mitigation: require explicit run-count controls, provider selection, and pre-run warnings for hosted/BYOK evaluation
- [Too many scenarios become hard to review] -> Mitigation: structure the corpus into categories and make reports sortable by failure rate, hard-rule failures, and regeneration quality
- [Dev-only inspection leaks into production behavior] -> Mitigation: keep evaluation reporting additive, sanitized, and clearly separated from end-user API contracts

## Migration Plan

1. Add the scenario schema, corpus format, and hard-check rubric alongside existing shared generation contracts.
2. Add deterministic tests for evaluation-related plumbing without changing existing client behavior.
3. Add an evaluation runner and reporting workflow that can exercise the current generation endpoint and provider stack.
4. Introduce optional AI-assisted review as a separate step so hard-check-only evaluation remains available.
5. Roll back by removing or disabling the evaluation runner/reporting path; no client migration should be required because the generation endpoint remains backward compatible.

## Open Questions

- Should the first version persist evaluation summaries between runs, or is file-based output enough?
- Should provider comparison be first-class in the report format, or can it remain a scenario/run attribute initially?
- Should AI-assisted review use the same provider under test, or a separate reviewer model to reduce self-grading bias?
