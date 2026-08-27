# Promptfoo Generation Evaluation

This workflow wraps the existing workout-generation evaluation suite with Promptfoo. The existing TypeScript scenario corpus and domain hard checks remain the source of truth; Promptfoo adds comparison reports, CI-friendly outputs, optional LLM-rubric scoring, and red-team workflow scaffolding.

## Tooling Policy

Promptfoo is invoked with `npx promptfoo@latest` instead of being pinned as a repository dependency for the first implementation. This keeps CE installs smaller and avoids making normal development depend on Promptfoo. If CLI compatibility becomes unstable, pin Promptfoo in `devDependencies` and update these scripts to use the local binary.

## Which Command To Use

- `npm run evaluate:generation`: canonical domain evaluator. Use this for direct workout-generation regression reports and planner/prompt debugging.
- `npm run review:generation`: optional OpenAI-assisted review of an existing canonical generation report.
- `npm run promptfoo:generation`: Promptfoo wrapper for curated scenario slices, provider comparisons, CI output, and optional soft review.
- `npm run promptfoo:generation:redteam`: Promptfoo red-team workflow for adversarial safety scans against a local workout-generation endpoint.

## Curated Promptfoo Runs

Run a fixture-safe smoke slice:

```sh
npm run promptfoo:generation -- --provider fixture --limit 3
```

Write config without running Promptfoo:

```sh
npm run promptfoo:generation -- --provider fixture --limit 3 --config-only
```

Compare providers or variants:

```sh
npm run promptfoo:generation -- --provider openai --provider gemini --tag beginner --runs 2 --variant-label current-prompt
```

Disable or force the stage-one planner for comparison:

```sh
npm run promptfoo:generation -- --provider fixture --scenario beginner-bodyweight-easy-15 --planner disabled --variant-label no-stage-one
```

Generate CI-oriented outputs and fail on Promptfoo-reported failures/errors:

```sh
npm run promptfoo:generation -- --provider fixture --limit 3 --ci
```

Promptfoo generation artifacts are written under `reports/promptfoo-generation/<timestamp>/`:

- `promptfooconfig.json`: generated Promptfoo configuration
- `summary.json`: selected scenarios, providers, preflight warnings, and artifact paths
- `comparison.html`: repo-specific provider/scenario comparison summary; start here for human review
- `comparison.md`: markdown version of the comparison summary
- `promptfoo-output.json`: Promptfoo JSON output when the run completes
- `report.html`: raw Promptfoo HTML report for generic eval-table and CI debugging
- `promptfoo.junit.xml`: JUnit output when the run completes
- `provider-calls/`: per-scenario canonical generation-evaluation reports produced by the custom provider bridge

Open the latest comparison report on macOS:

```sh
npm run promptfoo:generation:view
```

Promptfoo runs print both the local comparison report path and a `file://` URL. The view command opens `comparison.html` by default and falls back to the raw Promptfoo `report.html` when no comparison summary exists.

## Hard Checks And Gates

The Promptfoo provider bridge calls the existing generation evaluator for each selected scenario. The Promptfoo JavaScript assertion in `tools/promptfoo/generation/assert-domain-hard-checks.cjs` fails when a generation error occurs or any canonical hard check fails.

Hard checks include schema validity, duration fit, focus fit, equipment fit, injury safety, avoid-list safety, upcoming-event sensitivity, and regeneration difference where applicable.

Treat these hard-check results as the primary CI gate. Promptfoo soft scores are useful review signals, but they should remain advisory until explicitly promoted to required gates.

## Optional Soft Review

Enable Promptfoo model-graded rubrics with `--soft-review`:

```sh
npm run promptfoo:generation -- --provider openai --limit 5 --soft-review
```

The generated config adds named rubric metrics for clarity, plausibility, novelty, appeal, and goal fit. Promptfoo records the grading provider/model in its output. The generated config also records the rubric version in metadata as `promptfoo-workout-generation-v1` and adds a zero-weight `Soft Rubric Version` assertion for report visibility.

## Red-Team Workflow

The red-team workflow targets a local workout-generation endpoint with synthetic fixture data. It does not require production data.

Start the server separately, then run:

```sh
npm run promptfoo:generation:redteam -- --url http://localhost:3000/api/workouts/generate
```

Write the red-team config without running Promptfoo:

```sh
npm run promptfoo:generation:redteam -- --config-only
```

Red-team artifacts are written under `reports/promptfoo-redteam/<timestamp>/`, separate from curated generation evaluation reports.

The generated red-team config focuses on prompt injection, unsafe medical or injury guidance, privacy leakage, jailbreak-style attacks, and excessive agency. It uses a synthetic beginner profile with knee sensitivity and no production user context.

## Provider Access And Cost Controls

CE runs can use the explicit `fixture` provider, configured env keys, or live providers. When CE has no live provider key, live-provider selections are expected to fail with provider-configuration errors unless keys are configured.

Hosted-style runs should use `--edition HOSTED`. If required provider access is missing, the preflight summary warns before broad execution. Broad live runs also warn when scenario count, provider count, regeneration priming, and run count imply high provider cost or quota pressure.

Provider access uses the same environment conventions as the canonical evaluator:

- `OPENAI_API_KEY`
- `GEMINI_API_KEY`
- `OPENROUTER_API_KEY`
- `GOOGLE_GENAI_USE_VERTEXAI=true` with `GOOGLE_CLOUD_PROJECT` and `GOOGLE_CLOUD_LOCATION`
- `ENABLE_STAGE_ONE_PLANNER=false` or `--planner disabled` for planner comparison

## Safe Sharing

Do not share artifacts until checking whether they include sensitive fixture notes, provider prompts, or user-like context. The bridge does not write API keys, BYOK headers, cookies, bearer tokens, device tokens, session tokens, or secret-like headers into Promptfoo outputs. Redaction tests cover explicit secret values, but human review is still required before publishing reports externally.

Use local Promptfoo reports by default. Promptfoo sharing or cloud upload features are opt-in and are not required by this workflow.

## Validation

Useful validation commands:

```sh
nx test @leveza/shared --testPathPatterns=src/lib/evaluation/promptfoo-generation-bridge.spec.ts
nx test @leveza/server --testPathPatterns=src/lib/evaluation/promptfoo-generation-provider.spec.ts
npm run promptfoo:generation -- --provider fixture --limit 1 --config-only
npm run promptfoo:generation:redteam -- --config-only
openspec validate add-promptfoo-generation-evaluation-harness --strict
```
