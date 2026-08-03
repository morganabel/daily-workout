## MODIFIED Requirements

### Requirement: Canonical Single-Server Product Repository

This repository MUST contain the source code, routes, composition, billing persistence, and single database migration lineage needed to build both self-hosted and hosted server images. `apps/server` MUST remain the one deployment-mode-aware server, and `packages/server-db` MUST remain the one server database schema and migration owner.

A private deployment repository MAY publish or configure images built from this repository, but hosted correctness MUST NOT depend on private source injection, a second Next application, submodule `file:` dependencies, or a parallel migration lineage.

#### Scenario: Hosted server image is built

- **GIVEN** this repository is checked out without private application source
- **WHEN** the standalone server and migration images are built
- **THEN** they contain the hosted billing routes, durable repositories, and migrations required for hosted RevenueCat mode

#### Scenario: Private deployment publishes an image

- **GIVEN** the deployment repository selects a tested image from this repository
- **WHEN** it publishes or deploys that image
- **THEN** it does not inject billing implementation code or replace the product repository's schema lineage

## ADDED Requirements

### Requirement: Canonical Billing Policy Packages

The product MUST expose one entitlement/quota reservation contract and one metering contract. `packages/quotas` MUST own entitlement and exact reserve/commit/rollback semantics, `packages/metering` MUST own non-secret usage-event and sink semantics, and generation/server composition MUST consume or adapt to those contracts rather than maintaining competing production models.

#### Scenario: Generation reserves managed usage

- **GIVEN** the selected credential is managed or Vertex
- **WHEN** generation asks to reserve included usage
- **THEN** it uses the canonical quota contract and retains the exact returned reservation until commit or rollback

#### Scenario: Existing prototypes overlap

- **GIVEN** check-only quota, process-array metering, `server-core` policy, or app-local billing abstractions overlap the canonical packages
- **WHEN** B1 is complete
- **THEN** each obsolete abstraction is removed or reduced to an adapter over the canonical contract

### Requirement: Reservation-Oriented Generation Integration

The reusable generation core MUST support asynchronous reserve, commit, and rollback operations using an exact reservation token and an operation key scoped by stable `auth.userId`. It MUST expose a finalization boundary that allows the consolidated server to make a replayable validated result and the exact reservation commit durable atomically. Billing dependency errors MUST be distinguishable from quota denials.

#### Scenario: Durable policy returns a reservation

- **GIVEN** the PostgreSQL policy atomically approves included usage
- **WHEN** generation receives the approval
- **THEN** it retains that reservation token until it commits or rolls back that exact reservation

#### Scenario: Hosted generation finalizes successfully

- **GIVEN** hosted generation has a validated result and active reservation
- **WHEN** it crosses the durable finalization boundary
- **THEN** the replayable attempt result and exact reservation commit become durable together before the result is returned

#### Scenario: Policy dependency fails

- **GIVEN** the durable policy cannot read or reserve quota
- **WHEN** the server processes a managed-key generation request
- **THEN** it returns a service-unavailable error and does not invoke the model provider

#### Scenario: Billing-disabled policy follows the same flow

- **GIVEN** `BILLING_PROVIDER=none` selects the no-op policy
- **WHEN** generation reserves, commits, or rolls back usage
- **THEN** the contract completes without billing persistence while preserving the same handler control flow

### Requirement: Hosted RevenueCat Mode Fails Closed

A production process with `DEPLOYMENT_MODE=hosted` and `BILLING_PROVIDER=revenuecat` MUST require `REVENUECAT_WEBHOOK_SECRET`, the allowed app/environment/entitlement/product lists, the `BILLING_*` quota settings, and a configured durable adapter. It MUST accept only the `Authorization: Bearer` webhook form. A process-local adapter, removed configuration alias, unsigned mode, or permissive failure fallback MUST NOT satisfy this requirement.

Boot validation MUST remain environment-only. Missing/invalid configuration or inability to construct the selected adapter MUST fail startup. Database connectivity and schema health MUST be reported through readiness; failure MUST keep readiness false and block dependent requests without requiring the process itself to exit.

#### Scenario: Durable adapter configuration is missing at startup

- **GIVEN** hosted production RevenueCat mode
- **WHEN** required configuration is absent or the selected adapter cannot be constructed without I/O
- **THEN** the existing boot-validation path fails before route handlers accept traffic

#### Scenario: Unsigned production webhook mode is requested

- **GIVEN** hosted production RevenueCat mode
- **WHEN** configuration attempts to allow unsigned webhooks
- **THEN** boot validation fails rather than weakening webhook authentication

#### Scenario: Billing repository becomes unhealthy

- **GIVEN** hosted production RevenueCat mode started successfully
- **WHEN** the billing repository or required schema becomes unavailable
- **THEN** readiness reports unhealthy and managed generation fails before provider invocation

#### Scenario: Explicit local memory mode

- **GIVEN** a test or non-production local process
- **WHEN** it explicitly selects the memory billing adapter
- **THEN** billing flows may run for local verification without implying persistence or production suitability

### Requirement: Self-Hosted Billing-Neutral Default

A self-hosted deployment with `BILLING_PROVIDER=none` MUST start without RevenueCat configuration or billing table health requirements and MUST advertise billing disabled. The presence of durable billing code in the product image MUST NOT enable billing or quota enforcement implicitly.

#### Scenario: Self-host starts without RevenueCat

- **GIVEN** `DEPLOYMENT_MODE=self-hosted` and `BILLING_PROVIDER=none`
- **WHEN** the server validates configuration and becomes ready
- **THEN** RevenueCat credentials and billing repository checks are not required and generation uses the billing-neutral policy
