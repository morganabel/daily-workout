## Why

Workout generation quality is currently hard to improve quickly because the system validates schemas and provider plumbing, but it does not provide a repeatable way to run many realistic inputs, review outputs at scale, and compare results across providers or prompt changes. We need a lightweight evaluation workflow now so the product can become useful and lovable faster by learning from 50+ realistic scenarios instead of ad hoc spot checks.

## What Changes

- Add a repeatable workout-generation evaluation workflow centered on a large, curated scenario corpus for backend generation inputs
- Define a scenario format that captures the real inputs that influence generation today, including request fields, merged context, regeneration feedback, and upcoming events
- Add rule-based evaluation checks for hard constraints such as schema validity, equipment fit, time fit, injury/avoid safety, and regeneration variation
- Add AI-assisted review support for soft-quality judgments such as clarity, plausibility, novelty, and overall appeal without treating outputs as deterministic snapshots
- Add a reporting flow that summarizes results across at least 50 scenarios and repeated runs so prompt and context changes can be reviewed by frequency and failure pattern
- Keep the workflow compatible with both CE and hosted deployments, while avoiding new billing or quota requirements in CE and making hosted/provider costs explicit during evaluation runs

## Capabilities

### New Capabilities

- `generation-evaluation`: Defines a large-scale, scenario-driven workflow for evaluating workout generation quality, safety, and usefulness across many backend input combinations

### Modified Capabilities

- `home-data`: Clarify which generation inputs and outcomes must remain inspectable and reusable by evaluation tooling when exercising the workout-generation flow

## Impact

- Affected code: `packages/shared`, `packages/server-core`, `packages/server-ai`, `apps/server`, and supporting scripts/tooling for evaluation runs and reporting
- Affected APIs: `POST /api/workouts/generate` evaluation coverage, request/context inspection, and any dev-only reporting surface or script output introduced by implementation
- Affected systems: provider usage during evaluation, CE provider-configuration errors, hosted quota/billing visibility, and developer workflows for prompt/context iteration
