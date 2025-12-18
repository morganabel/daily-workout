## 1. Implementation
- [ ] 1.1 Define canonical API schema vs LLM-facing schema versions and add a feature flag to select the active LLM schema (defaulting to current behavior).
- [ ] 1.2 Build a transformer module that maps LLM responses into the canonical `TodayPlan` structure; start with identity mapping and add normalization for simplified schemas.
- [ ] 1.3 Integrate the transformer into the generation pipeline before persistence/response, emitting structured validation errors and telemetry when mapping fails.
- [ ] 1.4 Update generator tests/fixtures to cover schema-version selection, successful normalization, and failure paths that trigger deterministic/mock fallbacks.
- [ ] 1.5 Document configuration and operational playbooks for enabling the new schema version while keeping client responses stable.
