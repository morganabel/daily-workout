# Refactor Open Core Server (Design)

## Goals
- Make one canonical server implementation reusable across self-hosted and hosted deployment modes in this repository.
- Keep OpenAI/Gemini behavior (providers, prompts, transformation) shareable and identical by default across OSS and hosted deployments.
- Preserve BYOK as a first-class feature in hosted mode while treating keys as secrets (no persistence, no logging).
- Create explicit seams for repository-owned billing, metering, subscriptions, quota/rate limiting, and stronger auth without forking route logic.

## Non-Goals
- Implementing billing/subscriptions/metering in this refactor; later changes add those implementations to this repository through the same seams.
- Migrating to a real database store (beyond defining interfaces and keeping current behavior).
- Changing client-visible APIs, schemas, or endpoint paths (this is intended to be behavior-preserving).

## Proposed Package Boundaries

### `packages/server-core`
Responsibilities:
- Defines dependency interfaces (`AuthProvider`, `GenerationStore`, `ModelRouter`, `UsagePolicy`, `MeteringSink`).
- Implements the “core” request handling for the existing Next API routes as factories that accept dependencies/config and return standard `Request → Response` handlers.

Constraints:
- MUST NOT import vendor SDKs (`openai`, `@google/genai`) or hardcode provider logic.
- SHOULD avoid importing `next/*` modules; use standard Web `Request`/`Response` so the same handlers can be used by multiple Next apps.
- MUST NOT read `process.env` directly; the wiring layer provides config.

### `packages/server-ai`
Responsibilities:
- Owns the shareable LLM implementation: providers (OpenAI/Gemini), prompts, and transformation logic.
- Implements the `ModelRouter` interface (or exports a helper to construct one) so both CE and hosted deployments use the same “LLM behavior” without copying code.

Constraints:
- MUST NOT depend on app-local path aliases like `@/*`.
- SHOULD keep tightly coupled utilities (e.g., ID attachment + transformer) co-located to avoid package cycles.

### `apps/server` (single deployment-mode-aware Next app)
Responsibilities:
- Composition root for both self-hosted and hosted deployments: reads env/config, constructs the selected dependencies, and exports route handlers.
- Contains no business logic beyond wiring/config.

## Dependency Injection Model

Core handler factories accept a `deps` object, for example:
- `auth`: resolves the caller identity (DeviceToken stub today, replaceable later).
- `store`: persists generation state (current in-memory map, replaceable with DB).
- `router`: performs model calls and returns validated plans + metadata.
- `usagePolicy`: optional guard invoked before expensive operations (rate limit/quota).
- `metering`: optional sink invoked after model calls for usage recording.

Hosted composition in `apps/server` can:
- Reuse `packages/server-ai` directly for OpenAI/Gemini behavior.
- Wrap `router` with additional logic (caching, auditing, proxy routing) without changing prompts/providers unless desired.
- Replace `usagePolicy` and `metering` to enforce entitlements and capture usage, without touching core route logic.

### Entitlements Foundation

The `usagePolicy` and `metering` interfaces form the foundation for a future entitlements model:
- **`UsagePolicy`** is the initial admission hook; later billing work replaces it with exact reservation tokens and durable finalization.
- **`MeteringSink`** records "this user did this action" (the "write" side of usage tracking)

When designing `UsagePolicy`, consider including an optional `getEntitlements()` method so hosted composition can implement full entitlement queries without interface changes:

```typescript
interface UsagePolicy {
  canGenerate(userId: string, request: GenerationRequest): Promise<PolicyResult>;
  getEntitlements?(userId: string): Promise<Entitlements>; // optional, for hosted
}
```

### Protocol Version

Export a protocol version constant from `packages/server-core` to establish the foundation for future API versioning:

```typescript
export const PROTOCOL_VERSION = "1.0.0";
```

This enables a future `/meta` endpoint to advertise compatibility without adding scope now.

## BYOK Handling (Hosted + OSS)
- BYOK remains supported in hosted deployments.
- BYOK keys may be accepted via request headers, but:
  - MUST NOT be logged or stored.
  - MUST NOT be included in error messages or telemetry payloads.
  - MUST be used only for the upstream provider call and discarded.
- The server MUST NOT accept client-controlled upstream base URLs (to avoid SSRF/proxy abuse). Provider base URLs are server-configured only.
- Provider/model selection may be accepted from clients only if allowed by policy (allowlist and/or per-tier configuration).

## Image Publishing Boundary
- Packages and `apps/server` MUST build into standalone server and migration images without private source injection or submodule `file:` dependencies.
- Public APIs should remain stable and documented so deployment-mode composition does not rely on internal file paths.
- A private deployment repository MAY select, publish, and configure a tested image but MUST NOT replace `apps/server` or create a parallel migration lineage.
