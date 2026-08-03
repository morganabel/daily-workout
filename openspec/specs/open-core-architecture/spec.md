# open-core-architecture Specification

## Purpose

Define the packaging and dependency boundaries for one canonical product repository, one deployment-mode-aware server, and one database migration lineage while preserving current API behavior and keeping BYOK support safe.

## Requirements

### Requirement: Dependency-Inverted Server Core

The server's business logic MUST be implemented in a reusable core package consumed by the canonical `apps/server` application. The core MUST define interfaces for authentication, persistence, model invocation, and policy/telemetry hooks. The core MUST accept these as injected dependencies and MUST NOT hardcode billing, metering, or auth decisions.

#### Scenario: Hosted mode composes commercial concerns

- **GIVEN** `apps/server` runs in hosted deployment mode
- **WHEN** it composes the server using the core package
- **THEN** it can provide repository-owned authentication, quota, metering, and persistence implementations without forking the core route logic

### Requirement: Canonical Single-Server Product Repository

This repository MUST contain the source code, routes, composition, billing persistence, and single database migration lineage needed to build both self-hosted and hosted server images. `apps/server` MUST remain the one deployment-mode-aware server, and `packages/server-db` MUST remain the one server database schema and migration owner.

A private deployment repository MAY publish or configure images built from this repository, but hosted correctness MUST NOT depend on private source injection, a second Next application, submodule `file:` dependencies, or a parallel migration lineage.

#### Scenario: Hosted image is published

- **GIVEN** a tested standalone server and migration image built from this repository
- **WHEN** a private deployment repository publishes or deploys it
- **THEN** the deployment does not inject billing implementation code or replace the product repository's schema lineage

### Requirement: Shareable LLM Router Implementation

The OpenAI/Gemini implementation (providers, prompts, and transformation) MUST live in a reusable package that implements the core `ModelRouter` interface. Self-hosted and hosted deployments SHOULD be able to use the same router implementation without changing prompts or provider code.

#### Scenario: Hosted uses identical prompts/providers by default

- **GIVEN** the hosted deployment does not require proxy routing or custom prompts
- **WHEN** it uses the default `ModelRouter` implementation from the reusable LLM package
- **THEN** workout generation behavior matches the self-hosted behavior

### Requirement: BYOK Key Safety

When BYOK keys are accepted from clients, the server MUST treat them as secrets. BYOK keys MUST NOT be persisted and MUST NOT be logged. BYOK keys MUST be used only for the upstream provider call and then discarded.

#### Scenario: BYOK keys are not observable in logs

- **GIVEN** a request contains a BYOK provider key via an HTTP header
- **WHEN** the server processes the request
- **THEN** structured logs and error messages do not contain the raw key value

### Requirement: No Client-Controlled Upstream Base URLs

The server MUST NOT accept client-provided upstream API base URLs or equivalent values for model calls. Provider base URLs MAY be configurable server-side only.

#### Scenario: Client cannot override upstream target

- **GIVEN** a client attempts to influence the upstream provider base URL
- **WHEN** the server invokes the model provider
- **THEN** the upstream target is determined only by server configuration and the injected router implementation

### Requirement: Policy Hooks Around Model Calls

The core MUST provide hook points to enforce quota/rate limits and to record usage around model calls. Self-hosted defaults MAY be no-op, but hosted composition MUST enforce policy without modifying core route logic.

#### Scenario: Quota enforcement blocks generation

- **GIVEN** hosted composition installs a policy that rejects generation when over quota
- **WHEN** a user exceeds their allowance and requests generation
- **THEN** the core returns a structured error and does not invoke the upstream model provider
