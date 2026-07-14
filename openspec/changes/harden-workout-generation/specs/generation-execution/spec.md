## ADDED Requirements

### Requirement: Selected Credential Provenance

The generation server MUST resolve the selected provider and the credential actually used for that provider as one decision. Credential provenance MUST distinguish matching BYOK, server-managed API key, Gemini Vertex identity, and no credential. A provider-specific key for a different provider MUST NOT mark the selected call as BYOK or affect its quota attribution.

Credential secrets MUST NOT be logged, persisted, included in errors, included in request fingerprints, or emitted as metering metadata.

#### Scenario: Matching provider BYOK is selected

- **WHEN** a request selects Gemini and supplies a Gemini-specific or generic BYOK key
- **THEN** the Gemini call uses that key and its credential provenance is BYOK

#### Scenario: Mismatched key cannot bypass managed quota

- **WHEN** a request selects OpenAI, includes an unused Gemini-specific key, and uses the server-managed OpenAI key
- **THEN** the selected credential provenance is managed and the Gemini header does not cause BYOK quota treatment

#### Scenario: Matching BYOK overrides Vertex

- **WHEN** Gemini Vertex is configured and the request supplies a matching Gemini BYOK key
- **THEN** the upstream call uses the BYOK key rather than Vertex and funding attribution matches the credential actually used

#### Scenario: Vertex is managed execution

- **WHEN** no matching Gemini BYOK or managed API key exists and configured Vertex identity is selected
- **THEN** credential provenance is Vertex and the call is treated as managed usage

### Requirement: Credential-Aware Policy And Metering

Hosted generation MUST run managed-usage policy for server-managed and Vertex calls. It MAY bypass managed-usage quota only when the selected credential provenance is matching BYOK. Metering MUST record the selected provider, non-secret credential source, logical phase, and operation result consistently with the invocation.

Self-hosted mode MUST retain a configurable no-op usage-policy default and MUST use the same credential resolution semantics.

#### Scenario: Managed call reserves hosted usage

- **WHEN** hosted generation selects a server-managed API key
- **THEN** policy is evaluated before provider work and the reservation is committed only after a successful operation

#### Scenario: BYOK call remains self-funded

- **WHEN** hosted generation selects a matching BYOK credential
- **THEN** managed quota is not reserved and metering identifies the operation as BYOK without containing the key

#### Scenario: Failed managed call releases reservation

- **WHEN** a managed operation times out, is cancelled, fails safety validation, or otherwise returns no workout
- **THEN** its quota reservation is released exactly once

### Requirement: Bounded Generation Input

The generation endpoint MUST enforce a maximum raw body byte size before JSON parsing and MUST enforce explicit maximum lengths, counts, and nesting for every user-controlled field reachable from the generation payload. It MUST preflight deterministic prompt components before reservation and enforce a maximum size for the exact serialized input sent to each provider phase immediately before that phase. Configurable limits MUST be parsed and validated through the server's existing boot-configuration path.

The server MUST reject over-budget input rather than silently dropping hard constraints. Transport, schema, and deterministic preflight rejection MUST occur before quota reservation or pending state. Because final input depends on bounded stage-one output, a later exact-prompt rejection MAY occur after reservation but MUST occur before that phase and MUST roll back the exact reservation through the terminal attempt lifecycle.

#### Scenario: Declared body is too large

- **WHEN** a generation request declares a body length above the configured maximum
- **THEN** the server rejects it without parsing JSON or invoking policy or provider code

#### Scenario: Chunked body exceeds actual byte limit

- **WHEN** a streamed request without a trustworthy content length crosses the configured byte maximum
- **THEN** reading stops and the server returns a bounded payload-too-large error

#### Scenario: Nested field exceeds schema bound

- **WHEN** notes, metadata, baseline blocks, exercises, or another nested generation field exceeds its declared limit
- **THEN** schema validation rejects the complete request before generation work begins

#### Scenario: Provider prompt exceeds budget

- **WHEN** an accepted request expands into a serialized stage-one or final provider input above the configured prompt budget
- **THEN** the server rejects the operation before invoking that phase, rolls back any owned reservation, and does not truncate equipment, injury, avoid, or other hard constraints

#### Scenario: Input limits are invalid at boot

- **GIVEN** a configured byte, collection, or prompt limit is non-positive or internally inconsistent
- **WHEN** the server validates boot configuration
- **THEN** startup fails with a sanitized configuration error before serving generation requests

### Requirement: Bounded Provider Execution

Every stage-one, final-generation, and corrective provider call MUST run under a finite operation deadline, phase budget, retry cap, and structured-output limit. The server MUST propagate client cancellation and its operation abort signal through the model router and provider adapter. Configurable execution limits MUST be parsed and validated through the existing boot-configuration path, and no phase budget may exceed the total operation deadline.

No phase or SDK retry MAY extend the total operation deadline. Cancellation, deadline expiration, and non-retryable provider errors MUST stop further attempts. Metering MUST distinguish logical phases from actual upstream attempts and include SDK retries in the upstream count.

#### Scenario: Client cancellation reaches provider

- **WHEN** the incoming request is aborted while a provider call is active
- **THEN** the provider operation is cancelled and the generation lifecycle performs terminal cleanup

#### Scenario: Stage-one consumes its phase budget

- **WHEN** stage-one planning reaches its configured phase deadline
- **THEN** it is aborted and no later phase may claim the elapsed time as a fresh total deadline

#### Scenario: Retry cap is exhausted

- **WHEN** a retryable upstream failure repeats through the configured retry count
- **THEN** the operation stops with a sanitized provider error and performs quota and pending-state cleanup

#### Scenario: SDK retries are metered

- **WHEN** one logical final-generation phase makes multiple upstream calls because of SDK retries
- **THEN** metering records one logical phase and the actual number of upstream attempts

#### Scenario: Provider output exceeds its cap

- **WHEN** a provider attempts to return structured output beyond the configured maximum
- **THEN** the adapter aborts or rejects the response and no partial workout is persisted

### Requirement: Terminal Generation Attempt Lifecycle

Every accepted generation operation MUST receive a server-generated attempt/operation ID before managed quota or provider work, whether or not the request has an `Idempotency-Key`. After generation is marked pending, every execution path MUST reach exactly one terminal success or error transition. Managed quota reservation, provider invocation, plan persistence, metering, and cleanup MUST be coordinated so an operation that returns no plan does not retain quota or indefinite pending state.

#### Scenario: Request omits idempotency key

- **WHEN** an accepted request has no `Idempotency-Key`
- **THEN** the server creates one owned attempt ID used consistently for reservation, metering, terminal cleanup, and later durable finalization

#### Scenario: Provider succeeds but persistence fails

- **WHEN** a valid provider result cannot be persisted
- **THEN** the attempt ends in error, managed quota is released according to policy semantics, and successful metering is not recorded

#### Scenario: Semantic validation rejects output

- **WHEN** initial and corrective provider outputs both violate hard constraints
- **THEN** the attempt ends in a structured error with no unsafe plan persisted and no stale pending state

#### Scenario: Successful attempt completes once

- **WHEN** a validated workout is persisted successfully
- **THEN** the attempt transitions once to success and its managed reservation is not subsequently rolled back

### Requirement: Optional Idempotent Generation

The endpoint MUST support an optional `Idempotency-Key` scoped to the stable authenticated account `auth.userId`, not the session-scoped `auth.principalId`. An idempotency record MUST bind the key to a secret-free fingerprint of the normalized request, selected provider, and creation mode.

The attempt store MUST support atomic ownership and terminal completion. This change MAY use a bounded process-local implementation and MUST NOT claim cross-process or restart-safe idempotency. It MUST export the attempt/finalization contract that billing B4 can implement durably through the single server and `server-db` before hosted RevenueCat mode claims those guarantees.

#### Scenario: Concurrent matching requests coalesce

- **WHEN** two sessions for the same user use the same idempotency key and request fingerprint while the first is active
- **THEN** only the acquired owner invokes policy and providers and the second observes the same attempt result

#### Scenario: Completed request is replayed

- **WHEN** a completed user, key, and fingerprint tuple is submitted from another session before expiry
- **THEN** the stored successful response is returned without new quota or provider work

#### Scenario: Key is reused for different input

- **WHEN** the same authenticated user and idempotency key is submitted with a different normalized fingerprint
- **THEN** the server returns an idempotency conflict before policy, pending state, or provider invocation

#### Scenario: Failed attempt does not remain pending

- **WHEN** an owned attempt fails or expires
- **THEN** it reaches an explicit terminal or retryable state according to the store policy and cannot block matching requests indefinitely
