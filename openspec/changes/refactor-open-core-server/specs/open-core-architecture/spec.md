# open-core-architecture Specification

## Purpose
Define the packaging and dependency boundaries that allow the Community Edition server to be reused by a private hosted Next.js repo (via Git submodule) while preserving current API behavior and keeping BYOK support safe.

## ADDED Requirements
### Requirement: Dependency-Inverted Server Core
The server’s business logic MUST be implemented in a reusable core package that can be consumed by multiple Next.js apps. The core MUST define interfaces for authentication, persistence, model invocation, and policy/telemetry hooks. The core MUST accept these as injected dependencies and MUST NOT hardcode billing, metering, or auth decisions.

#### Scenario: Hosted overlay injects commercial concerns
- **GIVEN** a private hosted Next.js app uses the CE repo as a Git submodule
- **WHEN** it composes the server using the core package
- **THEN** it can provide its own `AuthProvider`, `UsagePolicy`, and `MeteringSink` implementations without forking the core route logic

### Requirement: Shareable LLM Router Implementation
The OpenAI/Gemini implementation (providers, prompts, and transformation) MUST live in a reusable package that implements the core `ModelRouter` interface. OSS and hosted deployments SHOULD be able to use the same router implementation without changing prompts or provider code.

#### Scenario: Hosted uses identical prompts/providers by default
- **GIVEN** the hosted deployment does not require proxy routing or custom prompts
- **WHEN** it uses the default `ModelRouter` implementation from the reusable LLM package
- **THEN** workout generation behavior (provider selection, prompts, transformation) matches the Community Edition behavior

### Requirement: BYOK Key Safety
When BYOK keys are accepted from clients, the server MUST treat them as secrets. BYOK keys MUST NOT be persisted and MUST NOT be logged. BYOK keys MUST be used only for the upstream provider call and then discarded.

#### Scenario: BYOK keys are not observable in logs
- **GIVEN** a request contains a BYOK provider key via an HTTP header
- **WHEN** the server processes the request
- **THEN** the server’s structured logs and error messages do not contain the raw key value

### Requirement: No Client-Controlled Upstream Base URLs
The server MUST NOT accept client-provided upstream API base URLs (or equivalent) for model calls. Provider base URLs MAY be configurable server-side only.

#### Scenario: Client cannot override upstream target
- **GIVEN** a client attempts to influence the upstream provider base URL
- **WHEN** the server invokes the model provider
- **THEN** the upstream target is determined only by server configuration and/or the injected router implementation

### Requirement: Policy Hooks Around Model Calls
The core MUST provide hook points to enforce quota/rate limits and to record usage around model calls. The Community Edition defaults MAY be no-op, but hosted overlays MUST be able to enforce policy without modifying core route logic.

#### Scenario: Quota enforcement blocks generation
- **GIVEN** a hosted overlay installs a `UsagePolicy` that rejects generation when over quota
- **WHEN** a user exceeds their allowance and requests generation
- **THEN** the core returns a structured error and does not invoke the upstream model provider
