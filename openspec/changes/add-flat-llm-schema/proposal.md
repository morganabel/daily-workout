## Why
Gemini structured output struggles with deeply nested schemas, and the current LLM plan format nests exercises under blocks. We want a flatter, more token-efficient schema that reduces depth while keeping the mobile client contract stable. This also unlocks richer transformations where compact enum values can expand into complex canonical structures.

## What Changes
- Add a flattened LLM workout schema (max depth 3) that hoists exercises to a top-level list keyed by block index and order.
- Extend the transformer to rebuild canonical `TodayPlan` blocks/exercises and support enum-to-structure expansion rules.
- Define the flattened schema shape, invariants, and a deterministic selection algorithm (estimated JSON size with override).
- Prefer the flattened schema across all providers when it is more token-efficient (estimated JSON size) or reliable, keeping the existing schema as a fallback.
- Update provider prompts/structured-output schemas and add validation tests.

## Impact
- Affected specs: home-data
- Affected code: packages/shared/src/lib/contracts/workouts.ts, apps/server/src/lib/llm-transformer.ts, apps/server/src/lib/ai-providers/*, apps/server/src/lib/ai-providers/prompts.ts, tests under apps/server/src/lib
