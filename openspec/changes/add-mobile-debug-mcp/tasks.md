## 1. Shared Contracts and Tool Inventory

- [x] 1.1 Define the initial debug MCP tool inventory and stable tool names in code comments or documentation so the sidecar and app registry stay aligned.
- [x] 1.2 Add Zod schemas/types for cross-boundary debug envelopes, session metadata, app/home state summaries, seed inputs, generation tool inputs, generation trace outputs, and destructive confirmation inputs where reuse is needed.
- [x] 1.3 Add redaction helpers that sanitize BYOK keys, auth cookies, bearer tokens, device tokens, secret-like headers, and error strings before values leave the app or sidecar.
- [x] 1.4 Add unit tests for validation and redaction helpers, including BYOK, auth cookie, bearer token, device token, and `x-*-key` cases.

## 2. Local MCP Sidecar

- [x] 2.1 Add a local Node MCP sidecar under `tools/` that registers the mobile debug tools with the MCP SDK/runtime used by the project environment.
- [x] 2.2 Add a WebSocket server inside the sidecar for React Native app sessions, including hello/registration, ping/pong or heartbeat, request/response correlation, and disconnect handling.
- [x] 2.3 Implement pairing-token validation for app sessions and reject missing or invalid tokens before registering a session.
- [x] 2.4 Implement connected-session tracking with platform/app metadata and require `sessionId` when multiple sessions are connected.
- [x] 2.5 Implement sidecar error handling for no connected app, disconnected app during request, request timeout, invalid app response, and multiple sessions without `sessionId`.
- [x] 2.6 Add a script or documented command for starting the sidecar from the repo root.

## 3. React Native Debug Bridge

- [x] 3.1 Add `DebugMcpBridge` to the mobile app and mount it only when both debug/development mode and `EXPO_PUBLIC_ENABLE_DEBUG_MCP=true` are active.
- [x] 3.2 Add configurable sidecar URL handling for iOS simulator, Android emulator, `adb reverse`, and physical-device LAN workflows.
- [x] 3.3 Implement outbound WebSocket connection setup, hello payload, pairing-token presentation, reconnect/backoff behavior, request dispatch, response serialization, and shutdown cleanup.
- [x] 3.4 Add a debug tool registry in the app that validates inputs, invokes async handlers, catches errors, and applies redaction to outputs.
- [x] 3.5 Add tests or testable module coverage showing the bridge remains disabled when debug gates are absent.

## 4. Debug State Publishing

- [x] 4.1 Add a dev-only debug state store for current route, bridge connection status, last generation trace, Home UI snapshot, and Active Workout UI snapshot.
- [x] 4.2 Add a React Navigation ref/route observer so debug tools can read the current route and bounded navigation tools can navigate safely.
- [x] 4.3 Publish Home screen ephemeral state such as staged quick actions, selected duration/focus/intensity/equipment override, generation status, and visible modal state.
- [x] 4.4 Publish Active Workout ephemeral state such as current workout ID, elapsed seconds, exercise/set completion summary, and submit state without moving that state into production stores.

## 5. Read-Only Debug Tools

- [x] 5.1 Implement `get_app_state` with platform/session metadata, route, backend URL, server capabilities, network state, launch state, redacted auth/BYOK state, local DB counts, and bridge status.
- [x] 5.2 Implement `get_home_state` with today's plan, plan versions, recent sessions, quick actions, offline hint, generation status, and published Home UI state.
- [x] 5.3 Implement `list_history` with limit/date-range filters and optional archive inclusion.
- [x] 5.4 Implement `list_calendar` with planned events and completed workout calendar items for a requested date range.
- [x] 5.5 Implement `get_generation_context` using the existing mobile context builder and return a sanitized context summary/result.

## 6. Mutation and Seeding Tools

- [x] 6.1 Implement `set_profile_preferences` using the existing user repository and shared profile validation.
- [x] 6.2 Implement `seed_history` for valid completed workout session inputs, using existing repository paths where possible and explicit debug-only helpers only where necessary.
- [x] 6.3 Implement `seed_planned_events` using the existing planned event repository.
- [x] 6.4 Implement `quick_log_workout` through the existing mobile quick-log service.
- [x] 6.5 Implement `complete_workout` through the existing workout completion repository path.
- [x] 6.6 Implement `reset_debug_data` with a required confirmation value and a returned count of removed records.

## 7. Generation and Trace Tools

- [ ] 7.1 Wrap the mobile generation service with debug trace capture for sanitized request fields, context summary, provider, scheduled date, counts, response/provenance, saved workout metadata, source/error/fallback, and duration.
- [ ] 7.2 Implement `generate_workout` through the normal mobile generation service so auth, BYOK, hosted, quota, and provider behavior are preserved.
- [ ] 7.3 Implement `regenerate_workout` by resolving a baseline plan/provenance, applying feedback, calling the normal generation service, and returning a version group summary.
- [ ] 7.4 Implement `get_last_generation_trace` with redaction and clear empty-state behavior.
- [ ] 7.5 Add tests for generation debug behavior using mocked API/provider paths and verify hosted/quota errors are surfaced rather than bypassed.

## 8. Bounded Navigation Tools

- [ ] 8.1 Implement safe navigation helpers for `open_home`, `open_history`, and `open_settings`.
- [ ] 8.2 Implement `open_current_workout_preview` only when a selected plan exists.
- [ ] 8.3 Implement `start_current_workout` only when a selected plan exists and reject invalid preconditions with clear errors.

## 9. Documentation and Validation

- [ ] 9.1 Document how to start the MCP sidecar and configure the mobile app environment variables for iOS simulator, Android emulator, and physical devices.
- [ ] 9.2 Document the available tools, expected inputs, redaction behavior, and destructive reset confirmation.
- [ ] 9.3 Run mobile unit tests for debug bridge/tool modules with `nx test @workout-agent-ce/mobile` or targeted Nx test commands.
- [ ] 9.4 Run shared package tests if shared debug contracts are added with `nx test @workout-agent/shared` or the correct Nx project name.
- [ ] 9.5 Run lint/typecheck targets for touched projects via Nx and resolve failures.
- [ ] 9.6 Manually verify a debug app connects to the sidecar and at least `get_app_state`, `get_home_state`, `set_profile_preferences`, `seed_planned_events`, `generate_workout`, and `get_last_generation_trace` work end-to-end.
