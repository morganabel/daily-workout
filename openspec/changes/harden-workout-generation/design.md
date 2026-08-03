## Context

`POST /api/workouts/generate` is implemented by `packages/server-core` and wired by `apps/server`. It selects OpenAI or Gemini, resolves request headers and server configuration, runs hosted policy, builds exercise-library candidates, calls `packages/server-ai`, transforms the provider response to `TodayPlan`, stores generation state, and records metering.

The current flow has five coupled weaknesses:

1. Credential selection and `isByok` are computed separately. Any recognized key header can mark a request BYOK even when that key is incompatible with, or ignored by, the selected provider.
2. Injury and avoid phrases are included in candidate `searchText`. FTS uses OR token matching and positive ranking, so a prohibited movement can become more relevant instead of being excluded.
3. Production accepts `todayPlanSchema` validity as sufficient. Safety hard checks exist only in evaluation and do not prevent persistence or return.
4. `request.json()` and much of the nested Zod request graph are unbounded. Provider prompts, provider retries, output sizes, and call duration are also unbounded at the shared execution layer.
5. Pending state, quota reservation, and provider execution are not represented by one attempt lifecycle. Duplicate submissions can repeat paid work and abort or timeout paths can leave misleading state.

There are no production users. This design therefore replaces unsafe behavior directly and does not include compatibility shims, feature flags, shadow validation, staged rollout, or data backfills.

## Goals

- Make provider credential provenance a single, typed decision used by invocation, quota policy, logging, and metering.
- Make exercise candidate safety constraints monotonic: adding an injury or avoid constraint can only remove candidates, never improve their ranking.
- Prevent semantically unsafe provider output from being persisted or returned.
- Put explicit byte, schema, prompt, time, retry, and output budgets around every provider-backed generation path.
- Guarantee one terminal cleanup path for pending state and managed quota reservations.
- Provide optional idempotent execution that composes with the consolidated server and its single `server-db` migration lineage.

## Non-Goals

- Medical diagnosis or a claim that exercise metadata can make all workouts medically safe.
- Replacing the workout catalog, planning algorithm, prompts, or provider SDKs.
- Implementing billing tables or the atomic hosted finalization transaction inside the generation PRs; those remain owned by `make-hosted-billing-durable`.
- Refactoring package boundaries or splitting the generate handler as part of a correctness PR.
- Preserving behavior for oversized, semantically invalid, or ambiguous legacy requests.

## Dependency And PR Shape

The work is split by invariant, not file ownership:

```text
package-and-CI PR 1 -------------------------> G1 credential attribution
billing B1 ---------------------------------> G2 search + semantic enforcement
                                             \-> G3 bounded request/prompt inputs
G2 + G3 ------------------------------------> G4 provider execution budgets
billing B1 + G4 ----------------------------> G5 attempt lifecycle/idempotency
G5 -----------------------------------------> billing B4 atomic finalization
```

G2 intentionally combines candidate-search correction, the production validator, and direct enforcement. Shipping only the query fix would still permit the provider to produce an unsafe exercise outside the candidates, while shipping only the validator would leave the candidate inversion intact.

## Decisions

### Decision: Resolve a credential object, not parallel booleans

The handler will resolve one provider credential before policy execution:

```typescript
type ResolvedProviderCredential = { provider: 'openai' | 'gemini'; source: 'byok'; secret: string } | { provider: 'openai' | 'gemini'; source: 'managed'; secret: string } | { provider: 'gemini'; source: 'vertex'; secret?: never } | { provider: 'openai' | 'gemini'; source: 'none'; secret?: never };
```

Resolution precedence is:

1. Determine the provider from an explicit valid provider header, legacy `x-openai-key` inference, or server default.
2. For that provider only, select its matching provider-specific BYOK header, then `x-ai-key`.
3. If no selected BYOK exists, select the provider's server-managed API key.
4. For Gemini only, use configured Vertex credentials if no API key was selected.
5. Otherwise resolve `none`.

A mismatched provider-specific key is ignored for credential and quota attribution. A matching explicit BYOK key takes precedence over Vertex so the key that determines funding is also the key actually sent upstream. The secret value never enters logs, errors, fingerprints, idempotency records, or metering metadata.

Hosted policy is skipped only for `source: 'byok'`. Managed and Vertex calls reserve hosted usage. G1 records selected source and logical operation phase; G4, which owns SDK retry behavior, records the actual upstream attempt count. Self-hosted mode continues to use its configured no-op policy by default.

### Decision: Negative constraints never enter relevance text

Candidate construction will build separate values for:

- positive search intent: requested focus, block objective, movement/style bias;
- normalized hard filters: equipment, environment, contraindication tags, avoid tags, and disallowed stressors;
- hard exercise exclusions: avoid phrases that resolve through stable IDs or aliases;
- conditional variation exclusions: baseline exercise IDs, applied only while eligible alternatives exist.

The query layer applies hard filters and safety exclusions before any FTS/BM25 ordering. FTS may rank the eligible set but may not consume injury, contraindication, avoid, or exclusion text. Adding a safety constraint must produce a subset of the previous eligible set. Baseline variation is tracked separately: it excludes prior exercises while eligible alternatives exist, but the planner may explicitly reuse a still-safe baseline exercise when no alternative exists, consistent with the canonical regeneration requirement.

Unrecognized free-form injury text remains available to the prompt but is not treated as proven structured coverage. The plan adds representative normalization tests and makes unresolved constraints visible in internal diagnostics; it does not claim medical interpretation beyond curated metadata.

### Decision: Validate provider output against the authoritative candidate contract

Structural parsing remains the provider adapter's first boundary. After transformation, `server-core` performs semantic validation before persistence or success response.

The authoritative exercise library and candidate contract are required before an AI provider call. Initialization or query failure returns a structured dependency error rather than silently continuing without the library. Every AI-generated exercise must:

- resolve through the embedded library to one stable planner-ready exercise identity;
- be present in the hard-eligible candidate contract supplied to the provider;
- require only available or explicitly implicit equipment;
- avoid normalized contraindication, avoid, disallowed-stressor, and explicit-exercise exclusions;
- satisfy the conditional baseline-variation rule, which permits reuse only when the contract records that no eligible alternative exists;
- preserve request-level duration and other deterministic hard limits covered by the validator.

The validator returns typed violations containing stable codes and safe exercise IDs or fields, never raw secrets or full prompts. Evaluation hard checks may reuse the pure validator, but production does not depend on evaluation scenario fixtures or banned-term substring checks.

If initial output violates the contract, the handler may make one corrective call with compact typed violations and the same eligible candidate set. The correction cannot relax a hard constraint. If correction fails:

- `auto` mode may return an already materialized catalog match only after the same semantic validator accepts it;
- explicit `ai` mode returns a structured safety-rejection error;
- the unsafe plan is never persisted, metered as a successful generation, or returned.

One corrective final-generation call is the maximum to bound cost and latency. A two-stage operation may therefore make a stage-one call, an initial final-generation call, and one corrective final-generation call. Managed quota is reserved once per user operation, while metering distinguishes logical phase calls from lower-level SDK retry attempts.

### Decision: Enforce limits at three boundaries

1. **Transport boundary:** reject a declared or streamed UTF-8 body above a configured byte limit before JSON parsing. The stream limit remains authoritative when `Content-Length` is absent or false. The initial default will be generous enough for a baseline workout and merged context (target: 256 KiB).
2. **Schema boundary:** add explicit maximum lengths and counts to every user-controlled generation field and nested object reachable from `generationRequestPayloadSchema`. This includes notes, labels, IDs, equipment, context arrays, upcoming-event metadata, baseline blocks, and exercises. Arbitrary metadata must have bounded keys, values, and depth or be excluded from generation input.
3. **Provider boundary:** preflight deterministic candidate/history/request components before reservation, then serialize and check the exact stage-one, final, or corrective payload immediately before invoking that phase. The final prompt depends on bounded stage-one output and cannot be known before stage one. If a later exact payload exceeds its budget after reservation, the operation terminates and rolls back that exact reservation. Hard constraints are never silently truncated.

Limit constants live in shared or server-core modules according to ownership and are exported for tests. Errors distinguish malformed input, body-too-large, and prompt-budget violations. Policy reservation and pending state occur only after transport, schema, and deterministic preflight acceptance; each provider phase occurs only after its own exact serialized-input check.

### Decision: Use one composable cancellation budget

The handler creates an operation signal that aborts when either the incoming `Request.signal` aborts or the configured operation deadline expires. It passes that signal through `ModelRouter`, `StageOnePlanner`, and provider adapters.

Typed generation configuration provides a total deadline and phase budgets for stage one, final generation, and the optional corrective call. A phase cannot extend the total deadline. `apps/server` parses and validates all byte, prompt, time, retry, and output limits through the existing `validateBootConfig` path and reports required generation dependencies through readiness. Provider clients receive:

- the active abort signal;
- an explicit request timeout where the SDK supports it;
- a small configured retry cap, with no retry after cancellation or non-retryable 4xx responses;
- a provider-specific maximum structured-output token budget.

Timeouts map to a stable timeout error. Client cancellation and timeouts run the same cleanup path as provider failures. Error messages remain sanitized.

### Decision: Separate generation attempts from the latest-plan store

`GenerationStore` currently represents the latest plan and UI-facing generation status. Attempt ownership and idempotency have different identity and concurrency semantics, so `server-core` will define a separate `GenerationAttemptStore` interface. Every accepted generation receives a server-generated operation/attempt ID before managed reservation or provider work, even when the client sends no `Idempotency-Key`.

When `Idempotency-Key` is present, it becomes an additional lookup key scoped to stable account identity `auth.userId`, not session-scoped `auth.principalId`, and binds the owned attempt to a secret-free fingerprint of the normalized request, selected provider, and creation mode. `auth.principalId` may continue to identify session-specific latest-plan UI state. The store supports atomic acquire and terminal completion:

- the first request owns the attempt;
- a concurrent matching request observes or awaits the same attempt rather than invoking a provider;
- a completed matching replay returns the stored result;
- the same key with a different fingerprint returns conflict;
- failed attempts have an explicit retry policy and never remain indefinitely pending.

The attempt owner alone reserves or rolls back managed quota. Every path after `markPending` ends in persisted success or a terminal error in `finally`-guarded lifecycle code. For hosted managed usage, the durable implementation must expose a finalization boundary that `make-hosted-billing-durable` can use to persist the replayable result and commit its exact quota reservation atomically.

`x-request-id` remains untrusted correlation metadata and is never passed as the attempt ID, operation key, idempotency key, quota key, spend key, or metering uniqueness key. Reusing it without an `Idempotency-Key` creates independent server-owned attempts. The operation ID may be attached to safe logs and durable accounting so correlation and execution remain inspectable without granting authority to the header.

Attempt acquisition composes with an admission lease. After authentication and bounded request validation, but before pending state, quota reservation, or provider work, every provider-backed request acquires bounded account and trusted-source rate/concurrency admission. BYOK bypasses entitlement and managed-provider spend only; it retains this infrastructure admission. The durable billing change implements cross-instance counters and managed-spend reservations, while the generation contract guarantees that only an acquired attempt owner can hold the lease and that terminal cleanup releases active concurrency exactly once.

The single server receives a bounded, expiring in-memory implementation for configurations that do not claim restart-safe behavior. The interface is exported so billing B4 can wire this repository's transactional `server-db` implementation and coordinate result finalization with quota in the same database. Hosted RevenueCat mode may not claim durable idempotency until B4 replaces the memory adapter.

## Error Contract

The implementation may add stable API codes for:

- raw body too large;
- prompt budget exceeded;
- provider timeout;
- semantic safety rejection;
- idempotency conflict.

Exact status mapping is decided in the implementation PR and tested consistently. Suggested mappings are 413 for body limits, 400 or 422 for bounded semantic input, 504 for provider deadline, 422 or 502 for unsafe provider output, and 409 for idempotency conflict. Public errors must not expose provider secrets, full prompts, or unbounded provider response text.

## Consolidated Server Boundaries

- `packages/server-core` owns provider-neutral credential provenance, request lifecycle, policy calls, validation, and storage interfaces.
- `packages/server-ai` owns provider SDK timeout, retry, abort, and output-limit translation.
- `packages/server-exercise-library` owns deterministic identity, eligibility, and query behavior.
- `packages/shared` owns bounded public request/error schemas.
- `apps/server` owns typed environment configuration, startup validation, readiness, and deployment-mode composition.
- `packages/quotas` and `packages/metering` expose the one canonical policy and event contract selected in billing B1; obsolete parallel in-memory prototypes are removed or repurposed rather than retained beside `UsagePolicy`.
- `packages/server-db` owns the single schema and migration lineage used by the durable attempt, quota, and metering repositories implemented by the billing change.

## Migration And Rollback

No data migration or backward-compatible request path is required because there are no users. The implementation can tighten schemas and exported interfaces directly. Development generation state and idempotency entries may be discarded.

The direct-cutover sequence is:

1. Land package-and-CI PR 1 so existing CI includes typecheck and the pinned npm 12 toolchain.
2. Land G1 independently while billing B1 establishes the canonical quota/metering and exact-reservation contracts.
3. Land G2 and G3 after B1, then G4 after G2 and G3.
4. Land G5 after G4 and B1.
5. Land billing B4 to wire durable atomic result/reservation finalization before claiming hosted durability.

Rollback is a normal Git revert of one PR, not a runtime flag. Unsafe-output enforcement must not be disabled in a deployed configuration; a rollback must revert the whole safety PR and its contract tests together.

## Risks / Trade-Offs

- Strict library identity validation may reject legitimate exercises missing from the curated library. Prefer improving library coverage over allowing unverifiable provider output.
- One corrective call increases cost and latency on invalid output. A single attempt and total deadline bound the impact.
- Transport and prompt limits may need tuning as adaptive-plan context grows. Exported constants and boundary tests make changes deliberate.
- SDKs expose timeout, retry, abort, and token controls differently. Provider contract tests must verify observed behavior rather than assuming option names are equivalent.
- In-memory idempotency cannot coordinate multiple processes. The contract documents this explicitly, and hosted durability is completed by billing B4 in the same repository.
- Application admission cannot replace edge/WAF volumetric DDoS protection. Hosted ingress must supply trusted source metadata, while the application remains authoritative for authenticated account, concurrency, and provider-work controls.
- Generation, quota, and metering currently have overlapping in-memory abstractions. Billing B1 must select one canonical contract before G2 and G5 integrate with it.
