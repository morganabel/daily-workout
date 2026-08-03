## Why

Workout generation currently trusts several boundaries that should be deterministic server responsibilities. A provider-mismatched BYOK header can make a managed provider call look self-funded and bypass hosted quota policy, injury and avoid text is included in positive full-text search ranking, and structurally valid provider output can be persisted without production safety validation. The endpoint also accepts effectively unbounded JSON and prompt inputs, and provider calls have no shared deadline, cancellation, retry, or output budget.

These are correctness and resource-control issues rather than rollout risks. There are no production users or persisted compatibility requirements, so the safer contracts can replace the current behavior directly without feature flags, shadow evaluation, dual paths, or legacy migration.

## What Changes

- Resolve the selected provider and credential together, recording whether the credential actually used is matching BYOK, server-managed, Vertex-managed, or absent. Only matching selected BYOK credentials bypass hosted managed-usage policy.
- Remove injury, contraindication, and avoid-list text from positive candidate search. Normalize them into hard filters and explicit excluded exercise IDs before ranking.
- Add production semantic validation after provider transformation and before persistence, quota commit, metering completion, or response. Provider output must resolve to eligible planner-ready exercise identities and satisfy equipment, contraindication, avoid-list, and explicit exclusion constraints.
- Permit at most one corrective provider attempt after a semantic violation. If the corrected output is still unsafe, return a structured error, or use an already validated catalog fallback in auto mode.
- Bound the raw HTTP body, every user-controlled generation field, nested collection sizes, and baseline workout size before policy reservation or pending state. Preflight deterministically bounded prompt components before reservation, then check each exact serialized provider phase immediately before that phase; a later-phase overflow terminates the attempt and rolls back its exact reservation.
- Propagate client cancellation and server deadlines through stage-one and final provider calls. Bound SDK retries and structured-output size for OpenAI, Gemini API-key, and Gemini Vertex paths.
- Add an explicit generation-attempt lifecycle for every request, using a server-generated operation ID when no client key exists. Optional `Idempotency-Key` adds account-scoped coalescing and replay semantics.
- Keep `x-request-id` as correlation only; it never supplies attempt, ledger, quota, spend, or idempotency identity. Route every provider-backed request through bounded account/source rate and concurrency admission, while durable billing separately enforces managed-spend reservations and circuit breaking.
- Keep provider-neutral execution contracts in `server-core`, use the canonical quota/metering contracts selected by billing B1, and compose deployment-specific defaults in the single `apps/server`. Billing B4 later implements durable persistence through this repository's `server-db` lineage.

## Capabilities

### New Capabilities

- `generation-execution`: Defines credential provenance, quota attribution, request and provider budgets, cancellation, terminal cleanup, and idempotent generation execution.

### Modified Capabilities

- `generation-planning`: Makes semantic safety validation and bounded corrective handling authoritative before generated workouts can be persisted or returned.
- `exercise-library`: Separates positive relevance search from negative safety constraints and requires explicit exclusions to remain hard filters.

## Impact

- Affected packages: `packages/shared`, `packages/server-core`, `packages/server-ai`, and `packages/server-exercise-library`, coordinated with the canonical `packages/quotas`, `packages/metering`, and `packages/server-db` contracts from `make-hosted-billing-durable`.
- Affected app: `apps/server` composition, configuration, error mapping, and route tests. No mobile UI change is required for the server hardening PRs; clients may add `Idempotency-Key` independently.
- API impact: successful `TodayPlan` responses remain unchanged. New bounded-input, timeout, safety-rejection, and idempotency-conflict errors may be returned. Oversized or unsafe requests that currently reach a provider will be rejected.
- Self-hosted impact: the default no-op usage policy and local provider support remain available. Process-local idempotency is allowed only where restart-safe behavior is not claimed.
- Hosted impact: matching BYOK remains self-funded; managed API keys and Vertex credentials always pass through the canonical quota and metering policy. This change exports the attempt/finalization contract; billing B4 separately implements and verifies multi-instance durability and atomic finalization.
- Delivery impact: package-and-CI PR 1 must complete the existing CI gates before generation PRs merge. Native ESM repair remains useful repository hardening but is not a functional prerequisite for the consolidated server.
