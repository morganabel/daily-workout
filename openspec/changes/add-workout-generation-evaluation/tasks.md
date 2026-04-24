## 1. Scenario Contracts and Corpus

- [x] 1.1 Add shared evaluation schema/types for scenario definitions, hard-check expectations, soft-review results, and report output
- [x] 1.2 Create a versioned scenario corpus with at least 50 named scenarios covering personas, equipment setups, constraints, recent-session context, upcoming events, and regeneration cases
- [x] 1.3 Add fixture validation tests so malformed scenarios fail fast before execution

## 2. Deterministic Generation Plumbing Coverage

- [x] 2.1 Add `server-core` tests for generate-handler behavior covering validation, context merge, provider selection, pending/error transitions, and mock fallback semantics
- [x] 2.2 Add tests for prompt and regeneration-message construction so fixed scenario inputs map to the expected provider payload shape without relying on exact model output
- [x] 2.3 Add tests that evaluation-visible metadata stays sanitized and never includes API keys or other secrets

## 3. Evaluation Runner and Hard Checks

- [x] 3.1 Implement an evaluation runner that executes a selected scenario set against the existing generation flow with explicit provider and run-count settings
- [x] 3.2 Implement deterministic hard checks for schema validity, duration fit, equipment compatibility, injury/avoid safety, and regeneration difference
- [x] 3.3 Support repeated stochastic runs, provider comparison, subset/tag filtering, and preservation of partial failures in the run output

## 4. Soft Review and Reporting

- [x] 4.1 Implement report generation with per-scenario entries, aggregate summaries, and exportable markdown plus structured JSON outputs
- [ ] 4.2 Add optional AI-assisted soft review that records reviewer source, rubric version, and rubric-aligned notes without replacing hard checks
- [x] 4.3 Add cost-aware preflight warnings for hosted or BYOK evaluation runs, including missing-key and quota-sensitive execution paths

## 5. Developer Workflow and Validation

- [x] 5.1 Document how to run the evaluation workflow in CE and hosted-style environments, including provider selection and expected outputs
- [x] 5.2 Add Nx-friendly commands or scripts for validating scenarios and running the evaluation workflow locally
- [x] 5.3 Validate the OpenSpec change and confirm all artifacts are ready for implementation
