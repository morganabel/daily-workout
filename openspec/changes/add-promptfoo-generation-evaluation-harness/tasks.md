## 1. Promptfoo Tooling Setup

- [x] 1.1 Decide whether Promptfoo is invoked through a pinned dev dependency or `npx promptfoo@latest`, and document the chosen versioning policy
- [x] 1.2 Add repository scripts for curated Promptfoo evaluation, Promptfoo report viewing, and Promptfoo red-team execution
- [x] 1.3 Create a predictable report directory layout that separates curated evaluation artifacts from red-team artifacts

## 2. Scenario Bridge And Provider Execution

- [x] 2.1 Add a scenario bridge that exposes canonical workout-generation evaluation scenarios to Promptfoo by id, tag, mode, request, context, baseline plan, and hard expectations
- [x] 2.2 Add validation so invalid scenario ids or tag filters fail before provider calls are launched
- [x] 2.3 Implement a custom Promptfoo provider that executes scenarios through the existing generation handler or a shared helper preserving production generation semantics
- [x] 2.4 Preserve regeneration priming, baseline-plan handling, provider selection, CE provider-configuration errors, hosted BYOK behavior, and stage-one planner metadata in the provider bridge
- [x] 2.5 Add unit tests for scenario selection, invalid scenario handling, and provider bridge execution against mock generation paths

## 3. Domain Hard Checks And Metrics

- [x] 3.1 Wrap the existing domain hard checks as Promptfoo-compatible assertions, named metrics, or post-processing gates
- [x] 3.2 Ensure hard-check results include check names, statuses, and diagnostic messages in Promptfoo outputs
- [x] 3.3 Make generation errors and hard-check failures available as CI quality-gate signals
- [x] 3.4 Add tests proving schema validity, equipment fit, injury/avoid safety, duration fit, and regeneration difference failures map to failed Promptfoo results or failed gate metrics

## 4. Curated Evaluation Configuration

- [x] 4.1 Add Promptfoo configuration for a small mock-safe smoke slice of the curated generation corpus
- [x] 4.2 Add Promptfoo configuration or CLI parameters for provider comparison across OpenAI, Gemini, mock, and any supported local/custom providers
- [x] 4.3 Add support for explicit variant labels such as prompt version, planner flag, provider, and run count
- [x] 4.4 Verify repeated stochastic runs preserve scenario identity and distinct run identity in report outputs

## 5. Optional Soft Review

- [x] 5.1 Add optional Promptfoo model-graded rubrics for clarity, plausibility, novelty, appeal, and goal fit
- [x] 5.2 Record reviewer provider/model, rubric version, score rationale, and named soft-review dimensions separately from hard checks
- [x] 5.3 Ensure soft scoring can be disabled while hard-check evaluation and report generation still complete
- [x] 5.4 Document that soft-review scores are advisory until explicitly promoted to CI gates

## 6. Red-Team Workflow

- [x] 6.1 Add a Promptfoo red-team target for workout generation through local HTTP or the custom provider bridge
- [x] 6.2 Configure red-team plugins or policies for prompt injection, unsafe injury guidance, privacy leakage, jailbreaks, and harmful medical or fitness advice
- [x] 6.3 Ensure red-team inputs use synthetic or fixture-based data and do not require production user data
- [x] 6.4 Write red-team outputs to a separate reports location and document how to inspect them

## 7. Secret Safety, Cost Controls, And Hosted/CE Behavior

- [x] 7.1 Add redaction tests proving API keys, BYOK headers, bearer tokens, cookies, device tokens, session tokens, and secret-like headers are not written to Promptfoo artifacts
- [x] 7.2 Add preflight checks or warnings for broad live-provider runs based on provider count, scenario count, variant count, and run count
- [x] 7.3 Ensure CE runs without provider keys are clearly labeled as mock or plumbing-oriented runs
- [x] 7.4 Ensure hosted-style runs without required BYOK/provider access fail or warn before broad execution instead of silently producing misleading mock quality results

## 8. Documentation And Validation

- [x] 8.1 Document when to use the existing generation evaluator versus Promptfoo curated evaluation versus Promptfoo red-team scans
- [x] 8.2 Document local commands, CI-oriented commands, provider configuration, report locations, and safe sharing guidance
- [x] 8.3 Add validation commands for scenario bridge tests, Promptfoo mock smoke evaluation, and red-team configuration checks
- [x] 8.4 Run `openspec validate add-promptfoo-generation-evaluation-harness --strict` before implementation is marked complete
