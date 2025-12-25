## Why
We want an “open core” architecture where this repo (Community Edition) is deployed directly as a hosted service from a private repo via a Git submodule, without forking business logic. The private repo should be able to add billing, metering, subscriptions, and stronger auth as an overlay, while reusing the exact same workout generation behavior (including OpenAI/Gemini support, prompts, and BYOK flows).

Today the server’s business logic lives inside `apps/server/src/lib/*` and is coupled to app-local wiring (global registries, `process.env` reads, and Next route modules). That makes it harder to:
- Reuse the same logic from another Next.js app (the private hosted repo).
- Inject cross-cutting concerns (quota/rate limits/metering) cleanly around model calls.
- Keep BYOK support safe (no accidental logging/persistence of keys) while still allowing hosted BYOK.

## What Changes
- Introduce a dependency-inverted server core package that exports Next-compatible handler factories (or framework-agnostic handlers using standard `Request`/`Response`) and defines the interfaces for:
  - authentication (`AuthProvider`)
  - persistence (`GenerationStore` / future DB store)
  - model invocation (`ModelRouter`)
  - policy + telemetry hooks (`UsagePolicy`, `MeteringSink`)
- Extract OpenAI/Gemini + prompts + transformation into a reusable package that implements the `ModelRouter` interface so OSS and hosted deployments share identical LLM behavior by default.
- Refactor `apps/server` to be a thin wiring layer that composes concrete implementations (OSS defaults) and exports the route handlers, preserving all existing API paths and schemas.
- Establish BYOK security invariants: accept keys via headers when BYOK is enabled, but never log or persist them; do not accept client-controlled base URLs; optionally gate provider/model selection through policy.

## Impact
- Specs: add a new `open-core-architecture` capability defining the packaging and injection requirements for hosted overlays; no intended user-facing behavior changes to existing capabilities.
- Code: significant file moves and import rewrites; Next route modules become thin adapters; LLM/provider code becomes shareable across repos.
- Ops: hosted deployments can support BYOK (customer pays vendor) and/or managed keys (service pays vendor) using the same core, with billing/metering implemented only in the private overlay.

## Follow-Up Work (Out of Scope)
This refactor establishes the DI foundation. Subsequent changes will build upon it:
- **Better Auth Integration**: Server-side auth instance + Expo client integration with backend-switching support (per-backend session isolation via `storagePrefix`).
- **`/meta` Endpoint**: Capabilities discovery for backend-switching (auth methods, protocol version, billing support).
- **API Versioning**: Protocol negotiation so clients can validate compatibility with arbitrary backends.
- **Storage Abstraction**: General-purpose storage interface beyond `GenerationStore` (S3/local for media, exports, etc.).
