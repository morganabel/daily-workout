## Delivery Order

External prerequisites:

- [x] 0.1 Treat origin's `nx sync:check`, affected lint/test/build, and Docker jobs as the existing baseline; merge `harden-package-and-ci-integrity` PR 1 with npm 12 and explicit typecheck before any generation PR merges.
- [ ] 0.2 Do not gate generation on native ESM repair; run the package-import smoke target once package-and-CI PR 2 lands.
- [x] 0.3 Keep each generation PR behavior-focused: no package moves, handler decomposition, broad lint cleanup, feature flags, shadow paths, or compatibility adapters.

Internal dependency graph:

```text
G1 credential attribution                 depends on 0.1
G3 bounded request/prompt inputs          depends on billing B1
G2 candidate + semantic safety            depends on billing B1
G4 provider execution budgets             depends on G2 + G3
G5 attempt lifecycle/idempotency           depends on billing B1 + G4
billing B4 atomic finalization             depends on G5
```

## G1 - Provider-Selected Credential Attribution

**Depends on:** 0.1. It is independent of G2-G5 after the external prerequisites land.

**PR scope:** Correct BYOK and managed-credential attribution without changing provider prompts, request limits, or persistence.

- [x] 1.1 Add a typed provider credential resolver that returns selected provider plus `byok`, `managed`, `vertex`, or `none` source as one decision.
- [x] 1.2 Make matching provider-specific BYOK and generic BYOK take precedence over the selected provider's managed or Vertex credentials; ignore mismatched provider-specific headers for funding attribution.
- [x] 1.3 Drive policy bypass, provider invocation options, safe logs, and logical-operation metering metadata from the resolved credential source rather than header presence; leave SDK attempt counting to G4.
- [x] 1.4 Add a full header/provider matrix covering explicit OpenAI/Gemini selection, legacy `x-openai-key` inference, generic keys, mismatched keys, managed defaults, Vertex, and missing credentials.
- [x] 1.5 Verify secret redaction for the new credential object and every error path touched by resolution.

Acceptance criteria:

- [x] 1.6 A key header that is not used by the selected provider cannot bypass hosted `UsagePolicy`.
- [x] 1.7 Managed OpenAI, managed Gemini, and Vertex calls reserve policy exactly once; matching BYOK calls bypass managed quota and use the supplied key upstream.
- [x] 1.8 Provider, policy, and metering tests agree on one credential source, and no secret value appears in logs, errors, snapshots, or request fingerprints.

Verification:

- [x] 1.9 Run `nx test @leveza/server-core`.
- [x] 1.10 Run `nx test @leveza/server`.
- [x] 1.11 Run `nx run @leveza/server-core:typecheck` and `nx run @leveza/server:typecheck`.
- [x] 1.12 Run `nx build @leveza/server`.

## G2 - Candidate Safety And Direct Semantic Enforcement

**Depends on:** 0.1 and `make-hosted-billing-durable` B1. This PR intentionally combines query correction, semantic validation, and enforcement so no intermediate unsafe behavior ships.

**PR scope:** Make negative constraints monotonic and reject unsafe provider output immediately. No shadow mode or feature flag.

- [ ] 2.1 Refactor candidate construction so positive search text contains only focus, movement, objective, and style intent; route injury, contraindication, avoid, and stressor constraints into hard filters or explicit safety-exclusion IDs.
- [ ] 2.2 Resolve explicit avoid exercise names and aliases to stable hard-exclusion IDs. Track baseline IDs separately as conditional variation exclusions that may be reused only when no eligible alternative exists.
- [ ] 2.3 Add a pure production semantic validator in `server-core` that resolves generated exercise identities and checks planner-ready status, hard-eligible candidate membership, equipment, contraindication, avoid-list, stressor, explicit safety exclusions, conditional baseline reuse, and deterministic duration constraints.
- [ ] 2.4 Require successful authoritative exercise-library initialization and candidate construction before an AI provider call; return a structured dependency error and expose library health through existing readiness wiring instead of continuing without it.
- [ ] 2.5 Run semantic validation after provider transformation and before persistence, successful metering, or response.
- [ ] 2.6 Permit one corrective provider call using compact typed violations and the unchanged eligible candidate contract; validate the corrected result with the same validator.
- [ ] 2.7 On repeated failure, return a structured safety error for explicit AI mode. In auto mode, use a catalog fallback only if it already exists and passes the same validator.
- [ ] 2.8 Reuse pure validation logic from evaluation where practical, but remove production dependence on evaluation fixtures and substring-only safety checks.
- [ ] 2.9 Add handler tests proving unsafe initial and corrected plans are never persisted or returned and managed reservations roll back on terminal rejection.

Acceptance criteria:

- [ ] 2.10 Injury and avoid values cannot contribute positive FTS/BM25 relevance.
- [ ] 2.11 Every returned AI exercise resolves to a hard-eligible planner-ready identity and satisfies the same safety constraints used to construct provider candidates. A baseline exercise is reused only when the candidate contract records no eligible alternative.
- [ ] 2.12 At most one corrective final-generation call occurs. A two-stage operation may make stage one, initial final generation, and one correction; G4 separately bounds and meters SDK retries. The implementation has no safety rollout switch or permissive production mode.
- [ ] 2.13 Representative shoulder, knee, lower-back, burpee, jumping, overhead, unavailable-equipment, unknown-alias, and baseline-exclusion cases have regression coverage.

Verification:

- [ ] 2.14 Run `nx test server-exercise-library` and `nx run server-exercise-library:validate-library`.
- [ ] 2.15 Run `nx test @leveza/server-core` and `nx test @leveza/server-ai`.
- [ ] 2.16 Run `nx run server-exercise-library:typecheck`, `nx run @leveza/server-core:typecheck`, and `nx run @leveza/server-ai:typecheck`.
- [ ] 2.17 Run `nx build @leveza/server`.

## G3 - Bounded Request And Prompt Inputs

**Depends on:** 0.1 and `make-hosted-billing-durable` B1 so later-phase prompt rejection can roll back the exact returned reservation. G4 depends on the limit and error contracts introduced here.

**PR scope:** Bound transport/schema input and deterministic prompt components before reservation, then enforce an exact per-phase prompt check immediately before each provider phase.

- [ ] 3.1 Replace unbounded `request.json()` consumption with a reusable byte-limited JSON reader that checks declared length and enforces the actual streamed byte count.
- [ ] 3.2 Add explicit maximum lengths, counts, record keys/values, and nesting rules to every user-controlled field reachable from `generationRequestPayloadSchema`, including context and baseline workout structures.
- [ ] 3.3 Bound total baseline blocks/exercises and eliminate or constrain arbitrary upcoming-event metadata used by generation.
- [ ] 3.4 Add deterministic candidate/history/request preflight budgets before reservation and exact serialized stage-one/final/corrective checks before each phase. A later-phase overflow must terminate and roll back the exact reservation returned for that request rather than truncate hard constraints; G5 later unifies this under the attempt lifecycle.
- [ ] 3.5 Add stable bounded-input API errors and ensure their messages do not echo unbounded user input.
- [ ] 3.6 Add typed limit configuration to `apps/server`, validate positive and internally consistent values through the existing `validateBootConfig`, and document variables in `.env.example`.
- [ ] 3.7 Add tests for false or missing `Content-Length`, chunked input, multibyte UTF-8, deeply nested metadata, maximum valid baselines, one-byte-over limits, prompt amplification, and invalid boot configuration.

Acceptance criteria:

- [ ] 3.8 Oversized transport input is rejected before JSON parse, policy reservation, pending state, exercise-library work, or provider invocation.
- [ ] 3.9 Every accepted generation payload passes deterministic preflight before reservation, and every provider phase's exact serialized input is below its exported configurable bound before that phase is invoked.
- [ ] 3.10 Boundary tests demonstrate that hard constraints are rejected as a unit when over budget and are never silently dropped.

Verification:

- [ ] 3.11 Run `nx test @leveza/shared` and `nx run @leveza/shared:typecheck`.
- [ ] 3.12 Run `nx test @leveza/server-core` and `nx run @leveza/server-core:typecheck`.
- [ ] 3.13 Run `nx test @leveza/server-ai` and `nx run @leveza/server-ai:typecheck`.
- [ ] 3.14 Run `nx build @leveza/server`.

## G4 - Provider Deadlines, Cancellation, Retries, And Output Caps

**Depends on:** G2 and G3; the external package prerequisite in 0.1 is inherited.

**PR scope:** Add one provider-neutral execution budget and translate it to every OpenAI, Gemini API-key, and Gemini Vertex call.

- [ ] 4.1 Extend `ModelRouter`, `StageOnePlanner`, and provider option contracts with an abort signal and explicit phase execution budget.
- [ ] 4.2 Compose `Request.signal` with a server-configured total deadline and remaining-time phase budgets for stage one, final generation, and the optional corrective call.
- [ ] 4.3 Configure bounded SDK timeouts, retry counts, retryable status handling, and structured-output token limits for OpenAI and both Gemini credential modes.
- [ ] 4.4 Stop retries immediately on cancellation, deadline expiration, or non-retryable client errors; ensure a phase cannot extend the total operation deadline.
- [ ] 4.5 Map deadline failures to a stable sanitized timeout response and route timeout/cancellation through pending-state and quota cleanup.
- [ ] 4.6 Add fake-provider and fake-timer tests for stage-one timeout, final timeout, correction timeout, client abort, retry exhaustion, and output-limit failure.
- [ ] 4.7 Record actual upstream attempts, including SDK retries, separately from logical stage-one/final/corrective phases; extend boot validation for deadlines, phase budgets, retries, and output caps.

Acceptance criteria:

- [ ] 4.8 Every provider call observes one propagated abort signal and a finite request/output budget.
- [ ] 4.9 The total operation cannot exceed the configured deadline by starting a new phase or SDK retry.
- [ ] 4.10 Timeout, abort, and retry exhaustion never persist a plan, report successful metering, leak a secret, or retain a managed quota reservation.

Verification:

- [ ] 4.11 Run `nx test @leveza/server-ai` and `nx test @leveza/server-core`.
- [ ] 4.12 Run `nx run @leveza/server-ai:typecheck` and `nx run @leveza/server-core:typecheck`.
- [ ] 4.13 Run `nx test @leveza/server` and `nx build @leveza/server`.

## G5 - Attempt Lifecycle And Optional Idempotency

**Depends on:** G4 and `make-hosted-billing-durable` B1; the external package prerequisite in 0.1 is inherited.

**PR scope:** Make generation terminal-state cleanup explicit and add optional replay/concurrency protection against the canonical quota/metering contracts. Durable atomic hosted finalization follows in billing B4.

- [ ] 5.1 Define a provider-neutral `GenerationAttemptStore` with server-generated operation/attempt identity, atomic acquire, success, failure, expiry, and replay behavior, separate from latest-plan `GenerationStore`.
- [ ] 5.2 Create an owned attempt for requests without `Idempotency-Key`. When the key is present, scope it by stable account `auth.userId`, never session `auth.principalId`, and bind it to a fingerprint of normalized request/provider/creation-mode data without credentials, prompts, or other secrets.
- [ ] 5.2a Keep `x-request-id` as correlation metadata only. Reusing it without `Idempotency-Key` must create independent server-owned operation IDs and independent metering identities.
- [ ] 5.3 Refactor handler lifecycle so only the acquired attempt owner can reserve quota or invoke providers, and all paths after pending state reach one success or error terminal transition.
- [ ] 5.4 Return a completed matching replay without provider or quota work; coalesce a concurrent matching request; reject key reuse with a different fingerprint.
- [ ] 5.5 Add a bounded, expiring in-memory implementation for configurations that make no restart-safe guarantee; document that hosted RevenueCat durability is incomplete until billing B4 wires `server-db`.
- [ ] 5.6 Coordinate the exported interface with `make-hosted-billing-durable` B4 so the single server can atomically persist a replayable result and commit its exact quota reservation through this repository's database lineage.
- [ ] 5.6a Add a provider-neutral admission-lease contract for account/source request rate and active concurrency; only the attempt owner acquires it, every terminal path releases it once, and hosted composition can supply the durable cross-instance implementation and managed-spend denial outcomes.
- [ ] 5.7 Add race-focused tests for two sessions of one user, two users reusing the same key string, concurrent duplicates, completed cross-session replay, conflicting reuse, timeout, cancellation, provider failure, persistence failure, and retry after failed/expired attempts.

Acceptance criteria:

- [ ] 5.8 A user/key/fingerprint tuple causes at most one provider execution while active and returns the same completed result on replay, including across sessions for that user.
- [ ] 5.9 A request without `Idempotency-Key` still owns one server-generated attempt/operation ID used by quota, metering, cleanup, and the B4 finalization contract.
- [ ] 5.9a Reusing `x-request-id` cannot suppress metering, quota, spend, or provider-attempt records, and rotating idempotency keys cannot bypass account/source admission limits.
- [ ] 5.10 Key reuse with a different request fails before policy, pending state, or provider work.
- [ ] 5.11 Managed quota reservation and rollback occur at most once per owned attempt, and no failure path leaves latest-plan or attempt state indefinitely pending.
- [ ] 5.12 The process-local guarantee and later hosted `server-db` durability requirement are explicit in package documentation and tests; the exported contract supports atomic result/reservation finalization in billing B4.

Verification:

- [ ] 5.13 Run `nx test @leveza/server-core` and `nx run @leveza/server-core:typecheck`.
- [ ] 5.14 Run `nx test @leveza/server` and `nx run @leveza/server:typecheck`.
- [ ] 5.15 Run `nx build @leveza/server`.

## Final Change Verification

- [ ] 6.1 Run `nx run-many -t lint,typecheck,test,build --projects=@leveza/shared,@leveza/server-core,@leveza/server-ai,server-exercise-library,@leveza/server`.
- [ ] 6.2 Run `nx run server-exercise-library:validate-library`.
- [ ] 6.3 Run the native Node package-import smoke target introduced by `harden-package-and-ci-integrity` for `shared`, `server-core`, `server-ai`, and `server-exercise-library`.
- [ ] 6.4 Verify the consolidated `apps/server` composition compiles in self-hosted and hosted deployment modes against credential provenance, execution-budget, canonical quota/metering, and attempt-store interfaces.
- [ ] 6.5 Manually verify self-hosted BYOK OpenAI, self-hosted BYOK Gemini, hosted matching BYOK, hosted managed key, hosted Vertex, client cancellation, unsafe-output rejection, and duplicate-idempotency flows without logging secrets.
- [ ] 6.6 Run `npm run validate:openspec -- harden-workout-generation` successfully using the repo-owned CLI from `harden-package-and-ci-integrity`.
