## ADDED Requirements

### Requirement: Canonical Scenario Bridge

The system SHALL expose a Promptfoo-compatible bridge for workout-generation evaluation scenarios without duplicating the canonical TypeScript scenario corpus. The bridge MUST preserve scenario identity, tags, mode, request inputs, optional context, optional baseline plan, and hard-check expectations.

#### Scenario: Promptfoo run selects scenarios by id

- **WHEN** an evaluator runs the Promptfoo harness with one or more scenario identifiers
- **THEN** the harness executes only matching scenarios from the canonical workout-generation evaluation corpus

#### Scenario: Promptfoo run selects scenarios by tag

- **WHEN** an evaluator runs the Promptfoo harness with one or more scenario tags
- **THEN** the harness executes scenarios from the canonical corpus that match the requested tag filter

#### Scenario: Missing scenario fails before provider execution

- **WHEN** an evaluator references a scenario id that does not exist in the canonical corpus
- **THEN** the harness fails before launching provider calls and reports the invalid scenario id

### Requirement: Production-Semantic Generation Execution

The Promptfoo harness MUST evaluate workouts through the same generation semantics used by the existing server-side generation evaluation flow, including request validation, context merge behavior, provider selection, stage-one planner behavior, regeneration priming where applicable, CE provider-configuration errors, explicit fixture runs, and hosted BYOK requirements.

#### Scenario: In-process provider uses existing generation path

- **WHEN** the Promptfoo custom provider executes a curated scenario
- **THEN** it calls the existing generation handler or an extracted helper that preserves production generation behavior rather than constructing workouts through a Promptfoo-only code path

#### Scenario: Regeneration scenario preserves baseline behavior

- **WHEN** the Promptfoo harness executes a regeneration scenario
- **THEN** it preserves the previous response, feedback, request overrides, and effective baseline plan needed by the existing regeneration evaluation semantics

#### Scenario: Planner metadata remains available

- **WHEN** a generation run uses the stage-one planner
- **THEN** the Promptfoo output includes sanitized planner metadata needed for debugging and comparison without changing the public workout response

### Requirement: Domain Hard-Check Assertions

The Promptfoo harness MUST reuse the repository's deterministic workout hard checks as Promptfoo assertions, derived metrics, or post-processing gates. Generic Promptfoo assertions MUST NOT replace domain checks for safety-critical evaluation concerns.

#### Scenario: Hard-check failure marks Promptfoo case failed

- **WHEN** a generated workout fails a domain hard check such as equipment fit, injury safety, duration fit, or regeneration difference
- **THEN** the corresponding Promptfoo test case is marked failed or emits a failed named metric that can be used as a CI quality gate

#### Scenario: Hard-check output preserves diagnostic detail

- **WHEN** domain hard checks complete for a Promptfoo scenario
- **THEN** the Promptfoo result includes the hard-check names, statuses, and diagnostic messages needed to understand failures

#### Scenario: Schema validity remains deterministic

- **WHEN** a provider returns a workout that does not validate against the shared workout contract
- **THEN** the schema-validity hard check fails deterministically without relying on LLM-judge scoring

### Requirement: Promptfoo Provider And Prompt Comparison

The Promptfoo harness SHALL support comparing provider, prompt, planner, and run-count variants for the curated workout-generation corpus. Comparison dimensions MUST be explicit in configuration or command-line inputs and MUST be recorded in outputs.

#### Scenario: Provider comparison records separate results

- **WHEN** an evaluator runs the same scenario set against multiple configured providers
- **THEN** the Promptfoo report records separate results for each provider without conflating execution source, latency, hard checks, or soft scores

#### Scenario: Prompt variant comparison records labels

- **WHEN** an evaluator runs the harness against multiple prompt or configuration variants
- **THEN** each output records the variant label needed for side-by-side comparison

#### Scenario: Repeated stochastic runs keep distinct identities

- **WHEN** an evaluator configures more than one run per scenario and variant
- **THEN** each run preserves the original scenario id and a distinct run identity

### Requirement: Promptfoo Reports And CI Outputs

The system SHALL provide repository scripts or documented commands that run Promptfoo evaluation slices and emit local artifacts suitable for review and CI, including structured JSON and at least one human-readable report format. CI-oriented runs MUST support quality gates based on generation errors and domain hard-check failures.

#### Scenario: Local report output is generated

- **WHEN** an evaluator runs the Promptfoo curated evaluation command
- **THEN** the workflow writes Promptfoo-compatible local report artifacts under a predictable reports directory

#### Scenario: CI gate can fail on hard checks

- **WHEN** the Promptfoo evaluation produces one or more generation errors or domain hard-check failures in a CI-gated slice
- **THEN** the CI command exits non-zero or emits machine-readable output that a CI step can use to fail the build

#### Scenario: Existing evaluation runner remains available

- **WHEN** Promptfoo tooling is unavailable or intentionally skipped
- **THEN** the existing generation evaluation command remains usable for domain evaluation and report generation

### Requirement: Optional Soft Quality Scoring

The Promptfoo harness SHALL support optional model-graded soft scoring for workout quality dimensions. Soft scores MUST be recorded separately from deterministic hard checks and MUST include reviewer model metadata, rubric version, and scoring rationale.

#### Scenario: Soft scoring records named dimensions

- **WHEN** an evaluator enables Promptfoo model-graded review
- **THEN** results include scores for rubric dimensions such as clarity, plausibility, novelty, appeal, and goal fit

#### Scenario: Soft scoring remains optional

- **WHEN** an evaluator runs the curated Promptfoo workflow without soft scoring enabled
- **THEN** the workflow still completes hard-check evaluation and report generation

#### Scenario: Soft scoring does not override hard failure

- **WHEN** a workout receives a high soft score but fails a deterministic hard check
- **THEN** the hard-check failure remains visible and usable as a quality-gate failure

### Requirement: Promptfoo Red-Team Workflow

The system SHALL provide a Promptfoo red-team workflow for workout generation that is separate from the curated product-quality scenario workflow. The red-team workflow MUST target adversarial safety and policy cases relevant to workout generation, such as prompt injection, unsafe injury guidance, privacy leakage, jailbreaks, and harmful medical or fitness advice.

#### Scenario: Red-team target can call workout generation

- **WHEN** an evaluator runs the Promptfoo red-team workflow
- **THEN** Promptfoo sends generated adversarial inputs to the workout-generation target through a documented local HTTP or custom-provider configuration

#### Scenario: Red-team outputs are stored separately

- **WHEN** a red-team run completes
- **THEN** its artifacts are distinguishable from curated workout-quality evaluation reports

#### Scenario: Red-team run does not require production data

- **WHEN** the red-team workflow is executed locally
- **THEN** it uses synthetic or fixture-based inputs and does not require access to production user data

### Requirement: Secret-Safe And Cost-Aware Execution

The Promptfoo harness MUST keep evaluation reports secret-safe and cost-aware. It MUST NOT write API keys, BYOK headers, cookies, bearer tokens, device tokens, session tokens, or secret-like request headers to report artifacts. It MUST make provider, run count, execution source, and hosted-style cost or quota risks explicit before broad live-provider runs.

#### Scenario: Secrets are redacted from outputs

- **WHEN** a Promptfoo curated or red-team run uses env keys, BYOK-style headers, bearer tokens, cookies, or provider credentials
- **THEN** report artifacts do not contain those secret values

#### Scenario: CE fixture run is allowed

- **WHEN** an evaluator runs the Promptfoo curated workflow in CE without configured provider keys
- **THEN** the workflow can execute an explicit fixture or plumbing-oriented slice and labels the execution source so users do not mistake it for live model quality

#### Scenario: Hosted missing key is surfaced early

- **WHEN** an evaluator requests a hosted-style live-provider run without required BYOK or provider access
- **THEN** the workflow surfaces the missing-key condition before launching a broad batch

#### Scenario: Broad live run warns about cost and quota

- **WHEN** an evaluator configures a broad live-provider run with many scenarios, variants, or repeated runs
- **THEN** the workflow warns about expected provider cost and quota implications before execution proceeds
