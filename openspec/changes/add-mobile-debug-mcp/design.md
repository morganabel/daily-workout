## Context

The mobile app is an Expo 53 / React Native 0.79 app with local-first state in WatermelonDB, secure auth/BYOK storage, and domain flows that depend on hidden inputs: profile preferences, recent workout history, planned events, provider selection, network state, and generation provenance. AI-assisted debugging is currently bottlenecked by manual simulator setup and indirect inspection through UI screens or logs.

React Native is not a Node runtime. It does not provide `stdio`, Node streams, or a built-in HTTP server suitable for hosting a standard MCP server directly inside the JS bundle. Debug builds can, however, open outbound WebSocket connections to a local development machine. The practical architecture is therefore a local Node MCP sidecar that exposes MCP tools to agents and relays requests to the connected debug app over a WebSocket bridge.

This change is debug tooling only. It must preserve the user-facing mobile experience, CE self-hosting behavior, hosted quota/billing overlays, and privacy-first defaults.

## Goals / Non-Goals

**Goals:**

- Provide a debug-only MCP tool surface for inspecting and manipulating the real mobile app state from an AI agent.
- Use a React Native-compatible transport by having the mobile app connect outbound to a local Node sidecar over WebSocket.
- Keep tool handlers domain-specific and bounded rather than exposing arbitrary JavaScript execution or unrestricted database access.
- Redact all auth credentials, BYOK keys, device tokens, cookies, bearer tokens, and secret-like headers from tool results, traces, and logs.
- Support the highest-value debugging flows: app state inspection, home state inspection, profile/history/calendar seeding, generation context inspection, generation/regeneration, history/calendar listing, and controlled reset of debug data.
- Provide reusable Zod contracts for tool inputs/outputs where they cross package boundaries or need validation.

**Non-Goals:**

- No production or hosted-user MCP surface.
- No app-hosted native HTTP/MCP server in the initial implementation.
- No arbitrary code execution, SQL execution, raw WatermelonDB record dumping, or unrestricted route navigation.
- No exposure of raw secrets or full free-form sensitive user notes by default.
- No changes to public workout generation, auth, BYOK, quota, metering, or mobile UI contracts.
- No requirement that MCP tools replace existing Jest, E2E, or generation evaluation workflows.

## Decisions

### Decision: Use a Local Node MCP Sidecar With an RN WebSocket Bridge

The MCP server will run as a local Node process under `tools/`. It will expose MCP tools to the agent and maintain WebSocket connections from one or more debug mobile app sessions. The React Native app will include a `DebugMcpBridge` component that connects outward to the sidecar only when debug gates are enabled.

Alternatives considered:

- App-hosted MCP server: rejected for MVP because Expo/RN lacks Node server primitives and native socket server work would add complexity across iOS and Android.
- Server-only MCP: useful for generation diagnostics but insufficient because many important inputs live only in the mobile local DB and secure storage.
- Direct simulator automation only: useful for UI testing but slower and less precise for seeding local domain state.

### Decision: Gate by Build Mode with Explicit Local Opt-Out

The bridge will mount by default when the app is a debug/dev build and will be disabled when `EXPO_PUBLIC_ENABLE_DEBUG_MCP=false`. The sidecar and app use a local development default pairing token and allow token overrides through debug environment variables. If the token is invalid, the bridge remains disconnected and no tools are available.

Alternatives considered:

- `__DEV__` only without opt-out or pairing: rejected because local developers still need a way to disable the bridge and connected app sessions must be paired to the intended sidecar.
- Runtime hidden UI toggle only: rejected because it still ships bridge code enabled unless backed by environment gates.

### Decision: Keep Tool Semantics Domain-Specific

Tools will call existing app services and repositories where possible: `userRepository`, `workoutRepository`, `plannedEventRepository`, `generateWorkout`, `buildGenerationContext`, auth capability helpers, BYOK helpers, and navigation helpers. Destructive tools will be explicit and require confirmation strings.

Alternatives considered:

- Generic database tools: rejected because they are easy to misuse, couple agents to storage internals, and increase privacy risk.
- Generic navigation tools: rejected for MVP except bounded route helpers, because route params can require domain objects and invalid navigation can destabilize the app.

### Decision: Add a Small Debug State Store for Ephemeral UI State

Persisted app state can be read from repositories, but screen-local UI state such as staged Home selections, modal visibility, active route, and active workout timer state is not globally visible. Debug-aware screens will publish concise snapshots to a dev-only debug state store. Tool responses can then combine persisted domain state with ephemeral UI state.

Alternatives considered:

- Lift all UI state into production stores: rejected because it would add production complexity for debug-only needs.
- Ignore ephemeral state: rejected because it would make tool output misleading when the user has staged settings that have not yet been persisted.

### Decision: Capture Redacted Generation Traces on the Mobile Path

The mobile app will capture the last generation attempt in a debug trace store: sanitized request, computed generation context summary, provider name, scheduled date, upcoming-event count, recent-session count, saved workout ID, response ID/provenance, source/fallback/error, and duration. The trace must not include API keys, cookies, bearer tokens, device tokens, or unredacted secret-like headers.

Server-side diagnostics such as planning brief, stage-one planner output, candidate-pool counts, and fallback reasons can be added behind the same debug gating as a later extension. The initial mobile trace will still provide high value without changing public generation responses.

### Decision: Prefer Shared Contracts for Tool Inputs and Stable Outputs

Tool input/output schemas that are used by both the sidecar and mobile app should live in `packages/shared`, using Zod and existing domain contract types. Purely sidecar-internal transport envelopes may remain under `tools/` or `apps/mobile/src/app/debug` if they do not need package reuse.

Alternatives considered:

- Inline untyped JSON: rejected because MCP tools become brittle and hard to validate.
- New package for debug contracts immediately: deferred until there is enough surface area to justify it.

## Risks / Trade-offs

- Debug bridge accidentally enabled outside intended builds -> Require `__DEV__`, keep an explicit local opt-out, require sidecar token pairing, and keep no production mounting path.
- Secret leakage through debug responses -> Centralize redaction, return presence/hash/last4-style metadata only, and add tests for BYOK/auth/device-token redaction.
- Tool calls mutate user data unexpectedly -> Keep mutation tools explicit, require confirmation for resets, and document that the bridge is for debug/dev data only.
- WebSocket connection differs across iOS simulator, Android emulator, and physical devices -> Allow configurable sidecar URL and document `localhost`, `10.0.2.2`, `adb reverse`, and LAN-IP modes.
- Multiple simulators connect at once -> Sidecar tracks sessions and requires `sessionId` when more than one app is connected.
- Debug tools duplicate test fixture logic -> Prefer existing repositories/services and keep seed tools small, typed, and domain-oriented.
- Server generation internals remain partially opaque in phase one -> Mobile traces capture request/context/provenance now; optional server diagnostics can be added later behind the same debug gate.

## Migration Plan

1. Add shared debug contracts and the sidecar.
2. Add the mobile bridge behind debug build gating and verify it can be disabled with `EXPO_PUBLIC_ENABLE_DEBUG_MCP=false`.
3. Add read-only tools first, then mutation tools, then generation/regeneration tools.
4. Add documentation for running the sidecar with Expo dev builds on iOS simulator, Android emulator, and physical devices.
5. Rollback by setting `EXPO_PUBLIC_ENABLE_DEBUG_MCP=false`; production and hosted builds are unaffected because the bridge never mounts.

Hosted edition does not require a data migration. Hosted quota, billing, auth, and BYOK enforcement remain in the existing API paths. The MCP bridge is a local debug-only client of those paths and must not bypass quota or auth behavior when it invokes real generation.

## Open Questions

- Should the first implementation include optional server-side generation diagnostics, or should that remain a follow-up after the mobile bridge is stable?
- Should debug traces redact free-form user notes entirely or include shortened, marked-as-redacted previews for troubleshooting?
- Should seed tools create richer exercises/sets in phase one, or start with completed session summaries and extend later?
