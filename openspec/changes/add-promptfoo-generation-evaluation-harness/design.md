## Context

The repository already has a workout-generation evaluation suite with a versioned TypeScript scenario corpus, deterministic hard checks, real generation-handler execution, provider prompt capture, planner artifact capture, and custom HTML/JSON/Markdown reports. That suite is valuable because it understands product semantics such as available equipment, injuries, upcoming events, regeneration baselines, CE mock fallback, and hosted BYOK behavior.

Promptfoo solves a different layer of the problem. It provides a mature LLM-evaluation harness for model and prompt comparisons, assertion scoring, CI outputs, caching, a web viewer, model-graded rubrics, and red-team scans. The design should use Promptfoo to improve evaluation operations without moving domain truth out of the existing shared contracts and hard-check implementation.

## Goals / Non-Goals

**Goals:**

- Run selected workout-generation scenarios through Promptfoo while preserving the existing TypeScript corpus as the canonical scenario source
- Reuse existing deterministic hard checks from `packages/server-core` as Promptfoo assertions or post-processing gates
- Support provider, prompt, planner-flag, and run-count comparisons with Promptfoo reports and machine-readable outputs
- Add optional model-graded soft review using Promptfoo metrics while keeping hard checks auditable and deterministic
- Add a red-team workflow that targets workout generation separately from curated quality scenarios
- Keep CE self-hosting practical with mock, BYOK, and local-only runs; make hosted-style cost and quota implications explicit
- Keep reports secret-safe by avoiding API keys, BYOK headers, cookies, bearer tokens, and raw secret-like metadata

**Non-Goals:**

- Do not replace the existing generation evaluation runner, hard checks, or scenario corpus in the first iteration
- Do not require Promptfoo to run normal unit tests or local CE development
- Do not add user-facing mobile or server API behavior
- Do not persist evaluation history in the production database
- Do not make Promptfoo Cloud or hosted sharing mandatory
- Do not rely on LLM-judge scores for safety-critical hard constraints

## Decisions

### Decision: Treat Promptfoo as an outer harness, not the source of domain truth

The implementation will keep scenarios, schemas, and hard checks in TypeScript. Promptfoo configuration will obtain scenario inputs by importing or generating from the existing corpus rather than maintaining a separate YAML-only scenario list.

Why this approach:

- The current corpus is typed against shared generation contracts
- Workout-specific checks are easier to maintain in the same language as the product contracts
- Avoids drift between Promptfoo test cases and the existing evaluation workflow

Alternatives considered:

- Rewriting the corpus in `promptfooconfig.yaml`: rejected because it duplicates fixtures and loses Zod-backed validation
- Replacing hard checks with generic Promptfoo assertions only: rejected because generic assertions cannot reliably encode workout-specific safety and regeneration semantics

### Decision: Add a custom Promptfoo provider bridge for in-process evaluation

The preferred integration path is a custom JavaScript or TypeScript Promptfoo provider that calls the same evaluation/generation path used by `npm run evaluate:generation`. It should accept scenario IDs, provider choices, run metadata, and optional feature flags through Promptfoo test variables.

Why this approach:

- It avoids needing a running Next.js server for basic evals
- It can reuse stub auth, in-memory stores, planner capture, and sanitized metadata
- It keeps scenario execution close to the current runner while still producing Promptfoo outputs

Alternatives considered:

- HTTP-only target against `POST /api/workouts/generate`: acceptable for red-team and end-to-end smoke coverage, but weaker for direct corpus reuse and planner metadata capture
- A wholly separate Promptfoo generation implementation: rejected because it would stop evaluating production semantics

### Decision: Support two Promptfoo workflows

There will be one curated quality workflow and one red-team workflow. The curated workflow maps existing scenario IDs/tags into Promptfoo tests, applies domain hard checks, and optionally runs model-graded workout-quality rubrics. The red-team workflow targets the generation endpoint or custom provider with adversarial probes and security/policy assertions.

Why this approach:

- Product quality regression and adversarial safety have different inputs and review cadence
- Red-team probes can be broader and more dynamic than curated workout scenarios
- CI can run small curated slices while scheduled jobs run broader red-team scans

Alternatives considered:

- Mixing red-team probes into the curated corpus: rejected because it would make founder-facing workout-quality reports noisy
- Running red-team only manually: rejected because security regressions benefit from repeatable automation

### Decision: Use Promptfoo outputs for CI gates, but gate on deterministic checks first

Promptfoo reports may include pass rate, named metrics, latency, cost, and model-graded scores. CI quality gates should prioritize generation errors and domain hard-check failures. Soft review thresholds can be advisory initially or run on scheduled/manual jobs.

Why this approach:

- Hard checks are stable enough for PR gates
- Model-graded scores are useful trend signals but can be noisy
- Cost and latency thresholds are operational safeguards, not substitutes for correctness

Alternatives considered:

- Failing every PR on LLM-judge scores: rejected because it would create flaky gates and discourage eval adoption
- Treating Promptfoo as report-only: rejected because deterministic hard-check gates are a clear operational win

### Decision: Keep hosted and CE behavior explicit

CE runs must work with mock execution, configured env keys, BYOK-like local configuration, or local providers where available. Hosted-style runs must surface missing BYOK, quota, and cost risks before broad live-provider runs. Promptfoo sharing or cloud features must remain opt-in.

Why this approach:

- CE users should not need hosted infrastructure to run evaluation tooling
- Hosted behavior has billing and BYOK requirements that should not be hidden by a generic eval tool
- Privacy-first defaults require local artifacts and redacted reports unless sharing is deliberately enabled

Alternatives considered:

- Requiring Promptfoo Cloud: rejected because it conflicts with CE/offline expectations
- Silently falling back from hosted live runs to mock results: rejected because it would make quality reports misleading

## Risks / Trade-offs

- [Scenario drift between Promptfoo and the TypeScript corpus] -> Generate or import Promptfoo tests from the existing corpus and validate scenario IDs/tags before each run
- [Promptfoo dependency churn breaks local evaluation] -> Keep the existing runner as the canonical fallback and pin a dev dependency if `npx promptfoo@latest` proves unstable
- [LLM-judge scores become overtrusted] -> Label soft scores separately, preserve reviewer model metadata, and keep hard checks as the primary gate
- [Reports leak prompts or secrets] -> Redact provider metadata, never emit API keys or BYOK headers, and document safe sharing rules
- [Live evals become expensive] -> Require explicit providers, run counts, limits, and warnings for broad live-provider runs
- [Two reporting systems confuse contributors] -> Document which command to use for plumbing, Promptfoo comparison, soft review, and red-team scans

## Migration Plan

1. Add Promptfoo config, provider bridge, assertion helpers, and scripts alongside the existing evaluation commands.
2. Start with a small scenario slice to prove hard-check reuse and report generation.
3. Add CI-safe commands that run mock or limited live slices and emit JSON/HTML/JUnit outputs.
4. Add optional model-graded review metrics and keep them out of required PR gates until they are stable.
5. Add a separate red-team config targeting workout generation and document manual versus scheduled usage.
6. Roll back by removing Promptfoo scripts/configuration; existing generation evaluation commands and production APIs remain unchanged.

## Open Questions

- Should Promptfoo be added as a pinned dev dependency, or should scripts use `npx promptfoo@latest` initially?
- Should the custom provider call the existing evaluation runner directly, or should it call a smaller shared helper extracted from the runner?
- Which scenario slice should be the default CI gate: mock-only smoke, targeted live provider slice, or both?
- Should Promptfoo red-team results be stored in the same reports directory as generation evaluation reports or in a separate `reports/red-team` tree?
