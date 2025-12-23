## Context
We recently introduced an LLM response transformation layer to normalize provider output into the canonical `TodayPlan` returned to clients. Gemini structured output struggles with deeply nested schemas (plan -> blocks -> exercises). We need a flattened schema that reduces nesting while preserving exercise ordering and enabling richer transformations such as enum expansion into complex structures.

## Goals / Non-Goals
- Goals:
  - Reduce LLM output nesting depth to <= 3 levels to improve provider reliability.
  - Preserve exercise order deterministically using explicit ordering metadata.
  - Keep the mobile client response contract unchanged (`TodayPlan`).
  - Prefer the flattened schema across providers when it is more token-efficient (estimated JSON size).
  - Support transformation rules that expand compact enum values into complex objects/arrays.
- Non-Goals:
  - Changing the client-facing `TodayPlan` schema.
  - Removing the existing `v1` LLM schema (must remain as fallback).

## Decisions
- Decision: Introduce a flattened LLM schema version (e.g., `v2-flat`) where blocks have no nested exercises and exercises are top-level entries keyed by `blockIndex` with explicit `order`.
  - Why: Minimizes depth while keeping semantics intact and enables ordering guarantees.
- Decision: Centralize enum expansion rules inside the transformer (not in prompt logic) so the LLM can output compact enums and the server expands them into canonical structures.
  - Why: Keeps prompts small and ensures a single source of truth for canonicalization.
- Decision: Prefer the flattened schema across providers when it is estimated to be smaller in JSON size, with a controlled fallback to `v1-current`.
  - Why: Consistency and cost savings without blocking providers that need the old schema.
  - Notes: The estimator compares static schema shapes and picks the smallest; no specific enum expansions are required up front.
  - Notes: Fallback is selection-time (provider capability/config). There is no automatic runtime retry with a different schema on the same request.

## Flattened Schema Shape (v2-flat)
Top-level object fields:
- `focus` (string, required)
- `durationMinutes` (int > 0, required)
- `equipment` (string[], required; may be empty)
- `source` ('ai' | 'manual', required)
- `energy` ('easy' | 'moderate' | 'intense', required)
- `summary` (string, required)
- `blocks` (array of block objects, min 1, required)
- `exercises` (array of exercise objects, min 1, required)

Block object fields:
- `title` (string, required)
- `durationMinutes` (int > 0, required)
- `focus` (string, required)

Exercise object fields:
- `blockIndex` (int, required, 0-based)
- `order` (int, required, 0-based, unique per `blockIndex`)
- `name` (string, required)
- `prescription` (string, required)
- `detail` (string | null, required)

## Worked Example (Flat Input -> Canonical Output)
Flat LLM payload:
```json
{
  "focus": "Upper Body Strength",
  "durationMinutes": 30,
  "equipment": ["Dumbbells"],
  "source": "ai",
  "energy": "moderate",
  "summary": "Sample plan",
  "blocks": [
    { "title": "Warm-up", "durationMinutes": 5, "focus": "Prep" },
    { "title": "Main Set", "durationMinutes": 20, "focus": "Strength" }
  ],
  "exercises": [
    { "blockIndex": 0, "order": 0, "name": "Jumping Jacks", "prescription": "2 x 30s", "detail": null },
    { "blockIndex": 1, "order": 0, "name": "DB Press", "prescription": "3 x 10", "detail": "Controlled tempo" }
  ]
}
```

Canonical `TodayPlan` output (IDs generated during transform):
```json
{
  "id": "<generated>",
  "focus": "Upper Body Strength",
  "durationMinutes": 30,
  "equipment": ["Dumbbells"],
  "source": "ai",
  "energy": "moderate",
  "summary": "Sample plan",
  "blocks": [
    {
      "id": "<generated>",
      "title": "Warm-up",
      "durationMinutes": 5,
      "focus": "Prep",
      "exercises": [
        {
          "id": "<generated>",
          "name": "Jumping Jacks",
          "prescription": "2 x 30s",
          "detail": null
        }
      ]
    },
    {
      "id": "<generated>",
      "title": "Main Set",
      "durationMinutes": 20,
      "focus": "Strength",
      "exercises": [
        {
          "id": "<generated>",
          "name": "DB Press",
          "prescription": "3 x 10",
          "detail": "Controlled tempo"
        }
      ]
    }
  ]
}
```

## Invariants and Invalid Handling
- `blockIndex` MUST be within `[0, blocks.length)`. Any out-of-range reference is invalid.
- `order` MUST be unique per `blockIndex` and is used for stable ordering.
- Invalid `blockIndex`, missing `blocks`, or duplicate `order` are treated as transform errors (no best-effort dropping).

## Depth Measurement
Depth is measured as the maximum nesting of objects/arrays along any path, counting each object or array as +1 from the root object. The flattened schema stays at depth 3 (root -> array -> object). Depth is enforced by tests against the JSON schema shape.

## Schema Selection Algorithm
Deterministic selection with overrides:
1. If an explicit override is set (env/config or request-level debug flag), use that schema version.
2. Else, if the provider declares only a single supported schema, use it.
3. Else, choose the schema with the smallest estimated JSON size (static schema-based estimate); ties break to `v2-flat`.
4. Record the selected schema version in generation metadata.

## Fallback Semantics
Fallback is selection-time only (capability/config). If a chosen schema fails to parse/transform, the request fails with the normal provider error handling; it does not auto-retry a different schema within the same request.

## Schema Versioning & Metadata
`schemaVersion` refers to the LLM output schema used for parsing and transformation (e.g., `v1-current` vs `v2-flat`). IDs are generated during transformation; they are not guaranteed to match across schema versions for the same logical plan, but all non-ID fields MUST remain semantically equivalent.

## Enum Expansion Example
Example mapping (illustrative):
- Input: `blockTemplate: "warmup-basic"` (enum in LLM payload)
- Expansion: a canonical block `{ title: "Warm-up", durationMinutes: 5, focus: "Prep" }` plus a predefined exercise list.
Unknown enum values are treated as transform errors unless explicitly mapped in the server ruleset. Mappings are versioned alongside the transformer and covered by tests.

## Alternatives Considered
- Keep nested exercises but reduce other fields: insufficient because depth is the primary failure mode for Gemini.
- Split plan into multiple schemas per section: increases orchestration complexity and parsing risk.

## Risks / Trade-offs
- Flattened schema increases join logic in transformer; must ensure ordering + block mapping is correct.
- Enum expansion rules could drift from client expectations; needs tests and clear mapping tables.

## Migration Plan
1. Add flattened schema + transformer mapping alongside existing version.
2. Roll out to providers that support structured output (Gemini/OpenAI), using `v1` as fallback.
3. Monitor transform failures and adjust prompts/mappings as needed.

## Open Questions
- None.
