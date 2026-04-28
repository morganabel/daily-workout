## Why

Debugging workout generation, personalization, and calendar-aware behavior currently requires slow manual simulator setup and indirect inspection of local mobile state. A debug-only MCP bridge would let AI agents and developers reproduce app states, inspect redacted domain context, and execute targeted app actions without compromising production privacy or UX simplicity.

## What Changes

- Add a debug-only mobile MCP bridge architecture where a local Node MCP sidecar communicates with the React Native app over WebSocket.
- Expose a bounded set of domain-specific debug tools for app state inspection, local data seeding, generation context inspection, workout generation/regeneration, history/calendar inspection, and safe navigation helpers.
- Capture redacted generation traces so agents can explain why a plan was generated from a given profile, history, planned-event, provider, and request context.
- Add strict debug gating and secret redaction so production builds, hosted billing/quota behavior, BYOK keys, auth cookies, bearer tokens, and device tokens are not exposed.
- Provide implementation tasks for the mobile bridge, sidecar MCP server, shared debug contracts, tests, and documentation.

## Capabilities

### New Capabilities

- `mobile-debug-mcp`: Defines the debug-only MCP sidecar and React Native bridge, available tools, security gates, redaction rules, and expected app/server diagnostic behavior.

### Modified Capabilities

- None.

## Impact

- Affected apps: `apps/mobile` for the React Native debug bridge, tool registry, route/state publishing, and domain tool handlers; `apps/server` only if optional server generation diagnostics are added behind debug gates.
- Affected packages: `packages/shared` for reusable Zod schemas/types for debug tool inputs and outputs if needed; existing domain contracts remain unchanged.
- New tooling: a local Node MCP sidecar under `tools/` that exposes MCP tools to agents and relays requests to connected debug app sessions over WebSocket.
- No breaking changes to public API contracts, production mobile UX, CE self-hosting behavior, hosted quota enforcement, or BYOK generation flows.
- Security impact is limited to debug builds when explicitly enabled; secrets must be redacted and destructive tools must require explicit confirmation.
