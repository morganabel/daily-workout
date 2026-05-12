## Why

The workout-generation evaluation suite already contains strong domain-specific scenarios and hard checks, but its reporting, model comparison, CI gating, soft scoring, and red-team coverage are custom or limited. Adding Promptfoo as a complementary harness gives the project mature LLM-evaluation infrastructure while preserving the existing TypeScript corpus and product-aware workout checks as the source of truth.

## What Changes

- Add a Promptfoo-based evaluation harness that can exercise the existing workout-generation evaluation scenarios through the real generation path or a local custom provider bridge
- Reuse the existing domain hard checks for schema validity, duration fit, focus fit, equipment fit, injury/avoid safety, upcoming-event sensitivity, and regeneration difference instead of replacing them with generic assertions
- Add Promptfoo configuration and helper scripts for selected scenario slices, provider/prompt comparisons, repeat runs, structured outputs, and CI quality gates
- Add optional Promptfoo model-graded scoring for soft workout-quality review dimensions such as clarity, plausibility, novelty, appeal, and goal fit
- Add a Promptfoo red-team target for workout generation so adversarial safety cases can be run separately from the curated product-quality corpus
- Preserve CE behavior with mock and BYOK/local provider execution; make hosted-style runs explicit about BYOK, quota, provider cost, and report redaction
- No breaking changes to the public workout-generation API or mobile app behavior

## Capabilities

### New Capabilities

- `promptfoo-generation-evaluation`: Defines the Promptfoo wrapper around workout-generation evaluation, including scenario bridging, domain hard-check reuse, model/prompt comparison, CI outputs, soft scoring, red-team execution, and secret-safe reporting

### Modified Capabilities

<!-- None. -->

## Impact

- Affected code: evaluation scripts under `tools/scripts`, shared generation-evaluation contracts and corpus exports in `packages/shared`, domain hard checks in `packages/server-core`, server evaluation runner wiring in `apps/server`, and repository-level package scripts/configuration
- Affected APIs: no required public API changes; Promptfoo may call the existing generation handler through an in-process custom provider or local HTTP target for dev/test execution
- Affected dependencies: adds Promptfoo as development tooling if implementation chooses a checked-in dependency instead of `npx promptfoo@latest`
- Affected systems: local evaluation workflow, CI reporting, optional provider-backed soft review, red-team scans, CE BYOK/mock execution, and hosted-style cost/quota warnings
