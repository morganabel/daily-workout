# Refactor Open Core Server (Design)

## Goals
- Make the Community Edition server logic reusable from a private Next.js repo that includes this repo as a Git submodule.
- Keep OpenAI/Gemini behavior (providers, prompts, transformation) shareable and identical by default across OSS and hosted deployments.
- Preserve BYOK as a first-class feature in hosted mode while treating keys as secrets (no persistence, no logging).
- Create explicit seams for private overlays to add billing, metering, subscriptions, quota/rate limiting, and stronger auth without forking route logic.

## Non-Goals
- Implementing billing/subscriptions/metering in this repo.
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

### `apps/server` (OSS Next app)
Responsibilities:
- Composition root for the OSS deployment: reads env/config, constructs dependencies (stub auth, in-memory store, default model router), and exports route handlers.
- Contains no business logic beyond wiring/config.

## Dependency Injection Model

Core handler factories accept a `deps` object, for example:
- `auth`: resolves the caller identity (DeviceToken stub today, replaceable later).
- `store`: persists generation state (current in-memory map, replaceable with DB).
- `router`: performs model calls and returns validated plans + metadata.
- `usagePolicy`: optional guard invoked before expensive operations (rate limit/quota).
- `metering`: optional sink invoked after model calls for usage recording.

The private hosted repo can:
- Reuse `packages/server-ai` directly for OpenAI/Gemini behavior.
- Wrap `router` with additional logic (caching, auditing, proxy routing) without changing prompts/providers unless desired.
- Replace `usagePolicy` and `metering` to enforce entitlements and capture usage, without touching core route logic.

### Entitlements Foundation

The `usagePolicy` and `metering` interfaces form the foundation for a future entitlements model:
- **`UsagePolicy`** answers "can this user do this action?" (the "read" side of entitlements)
- **`MeteringSink`** records "this user did this action" (the "write" side of usage tracking)

When designing `UsagePolicy`, consider including an optional `getEntitlements()` method so hosted overlays can implement full entitlement queries without interface changes:

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

## Submodule Consumption (Private Repo)
- Packages MUST build to standard ESM outputs with proper `exports` so the private repo can depend on them via `file:` dependencies pointing into the submodule (or via a build step that produces artifacts).
- Public APIs should remain stable and documented (handler factories + dependency interfaces) so overlays don’t rely on internal file paths.
