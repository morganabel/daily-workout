## 1. Implementation
- [x] 1.1 Add flattened LLM workout schema + types in shared contracts
- [x] 1.2 Add `v2-flat` (or similar) schema version and transformer mapping to canonical `TodayPlan` (including `blockIndex` + `order` preservation)
- [x] 1.3 Add enum expansion mapping support in the transformer (with at least one example mapping + unknown handling)
- [x] 1.4 Define schema selection algorithm (static size estimate + override knob) and provider capability fallback
- [x] 1.5 Update providers to prefer flattened schema when estimated JSON size is smaller; keep v1 as selection-time fallback
- [x] 1.6 Update prompts and structured-output schemas to reflect the flattened format
- [x] 1.7 Add/adjust tests for flat schema validation, ordering/uniqueness, invalid `blockIndex`, depth constraints, and enum expansion
