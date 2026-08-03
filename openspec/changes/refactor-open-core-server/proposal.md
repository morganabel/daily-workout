## Why
We want one canonical product repository that can build both self-hosted and hosted server images without forking business logic. This repository owns the deployment-mode-aware server, billing and metering integration points, and the database migration lineage. A private deployment repository may publish and configure tested images, but it must not inject a second application or source overlay.

Today the server’s business logic lives inside `apps/server/src/lib/*` and is coupled to app-local wiring (global registries, `process.env` reads, and Next route modules). That makes it harder to:
- Reuse the same logic across self-hosted and hosted deployment modes in the canonical `apps/server` application.
- Inject cross-cutting concerns (quota/rate limits/metering) cleanly around model calls.
- Keep BYOK support safe (no accidental logging/persistence of keys) while still allowing hosted BYOK.

## What Changes
- Introduce a dependency-inverted server core package that exports Next-compatible handler factories (or framework-agnostic handlers using standard `Request`/`Response`) and defines the interfaces for:
  - authentication (`AuthProvider`)
  - persistence (`GenerationStore` / future DB store)
  - model invocation (`ModelRouter`)
  - policy + telemetry hooks (`UsagePolicy`, `MeteringSink`)
- Extract OpenAI/Gemini + prompts + transformation into a reusable package that implements the `ModelRouter` interface so OSS and hosted deployments share identical LLM behavior by default.
- Refactor `apps/server` to be the single thin wiring layer that composes deployment-mode-specific implementations and exports the route handlers, preserving all existing API paths and schemas.
- Establish BYOK security invariants: accept keys via headers when BYOK is enabled, but never log or persist them; do not accept client-controlled base URLs; optionally gate provider/model selection through policy.

## Impact
- Specs: add a new `open-core-architecture` capability defining the canonical package, composition, and image-publishing boundaries; no intended user-facing behavior changes to existing capabilities.
- Code: significant file moves and import rewrites; Next route modules become thin adapters; LLM/provider code becomes shareable across repos.
- Ops: hosted deployments can support BYOK and managed credentials using the same core, with billing, metering, and persistence implemented in this repository and private deployment automation limited to publishing/configuring images.

## Follow-Up Work (Out of Scope)
This refactor establishes the DI foundation. Subsequent changes will build upon it:
- **Better Auth Integration**: Server-side auth instance + Expo client integration with backend-switching support (per-backend session isolation via `storagePrefix`).
- **`/meta` Endpoint**: Capabilities discovery for backend-switching (auth methods, protocol version, billing support).
- **API Versioning**: Protocol negotiation so clients can validate compatibility with arbitrary backends.
- **Storage Abstraction**: General-purpose storage interface beyond `GenerationStore` (S3/local for media, exports, etc.).
