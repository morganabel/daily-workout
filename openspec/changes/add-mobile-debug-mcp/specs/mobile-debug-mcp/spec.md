## ADDED Requirements

### Requirement: Debug-Only MCP Availability

The system MUST expose the mobile debug MCP bridge by default in debug/development builds. Production builds and explicitly disabled debug builds MUST NOT mount the bridge or accept MCP tool calls.

#### Scenario: Bridge enabled by default in debug build
- **WHEN** the mobile app starts in a debug/development build without an explicit debug MCP opt-out
- **THEN** the app opens an outbound WebSocket connection to the local debug sidecar and registers its app session metadata

#### Scenario: Bridge disabled by explicit opt-out
- **WHEN** the mobile app starts in a debug/development build with `EXPO_PUBLIC_ENABLE_DEBUG_MCP=false`
- **THEN** the debug MCP bridge is not mounted, no WebSocket connection is opened, and no MCP tool handlers are reachable from the app

#### Scenario: Production build cannot enable bridge
- **WHEN** the mobile app runs as a production build
- **THEN** the debug MCP bridge remains unavailable even if debug MCP environment variables are present

### Requirement: Local MCP Sidecar Relay

The system SHALL provide a local Node MCP sidecar that exposes MCP tools to an AI agent and relays tool calls to connected React Native debug app sessions over WebSocket. The sidecar MUST support at least one connected app session and MUST require an explicit `sessionId` when multiple sessions are connected.

#### Scenario: Sidecar relays tool call to single app session
- **WHEN** one debug app session is connected and the agent invokes a mobile debug tool
- **THEN** the sidecar forwards the request to that app session, waits for the app response, and returns the result as the MCP tool response

#### Scenario: Sidecar requires session for multiple apps
- **WHEN** more than one debug app session is connected and the agent invokes a tool without specifying `sessionId`
- **THEN** the sidecar rejects the tool call with an error listing the connected sessions rather than choosing one implicitly

#### Scenario: Disconnected app produces clear error
- **WHEN** the agent invokes a mobile debug tool and no app session is connected
- **THEN** the sidecar returns a clear error explaining that a debug build must be running and connected

### Requirement: Pairing and Transport Validation

The bridge and sidecar MUST validate a debug pairing token during connection setup. The app and sidecar SHOULD share a local development default token while allowing explicit overrides, and the sidecar MUST reject app sessions that do not present the configured token.

#### Scenario: Valid token registers session
- **WHEN** the app connects to the sidecar with the expected debug pairing token
- **THEN** the sidecar registers the app session and allows MCP tool calls to be relayed to it

#### Scenario: Invalid token rejected
- **WHEN** the app connects with a missing or invalid debug pairing token
- **THEN** the sidecar rejects the session and no MCP tools can be executed against that app

### Requirement: Secret Redaction

The mobile debug MCP surface MUST NOT expose raw secrets. Tool outputs, traces, errors, and sidecar logs MUST redact auth cookies, bearer tokens, device tokens, BYOK API keys, Better Auth secrets, and `x-*-key` style headers.

#### Scenario: BYOK state is redacted
- **WHEN** the agent invokes an app state or BYOK-related debug tool
- **THEN** the result identifies the configured provider and key presence only, without returning the raw key

#### Scenario: Auth state is redacted
- **WHEN** the agent invokes an auth or app state debug tool
- **THEN** the result may report whether a session/cookie/device token is present but MUST NOT return raw cookie, bearer token, session token, or device token values

#### Scenario: Error messages do not leak secrets
- **WHEN** a debug tool fails while processing request headers, auth state, BYOK state, or generation data
- **THEN** the returned error and sidecar/app logs omit raw secret values

### Requirement: App State Inspection Tools

The MCP surface MUST provide read-only app state inspection tools that summarize the debug app session, current route, backend URL, platform, server capabilities, network status, launch state, auth state, BYOK state, local database counts, and relevant ephemeral UI state.

#### Scenario: App state summarizes runtime without secrets
- **WHEN** the agent invokes `get_app_state`
- **THEN** the result includes platform/session metadata, current route, backend URL, debug bridge status, server capabilities if available, network status, launch completion status, redacted auth/BYOK state, and local data counts without exposing secrets

#### Scenario: Home state combines persisted and ephemeral state
- **WHEN** the agent invokes `get_home_state`
- **THEN** the result includes today's selected plan, plan versions, recent sessions, quick actions, generation status, offline hint, and any published Home UI state such as staged selections or modal visibility

### Requirement: Domain Data Seeding Tools

The MCP surface MUST provide typed domain seeding tools for debug builds so agents can create realistic profile preferences, completed workout history, and planned events without manual simulator interaction. Seed tools MUST validate input before mutating local data.

#### Scenario: Profile preferences seeded
- **WHEN** the agent invokes `set_profile_preferences` with valid preferences
- **THEN** the app persists those preferences using the same local profile storage used by the Settings screen

#### Scenario: Completed history seeded
- **WHEN** the agent invokes `seed_history` with valid completed workout summaries
- **THEN** the app creates completed local workout sessions that appear in history queries and can influence future generation context unless archived

#### Scenario: Planned events seeded
- **WHEN** the agent invokes `seed_planned_events` with valid planned event inputs
- **THEN** the app creates local planned events that appear in calendar views and can be included in future generation context

#### Scenario: Invalid seed input rejected
- **WHEN** a seeding tool receives invalid input
- **THEN** the tool rejects the request with validation details and does not partially mutate local data

### Requirement: Generation Debug Tools

The MCP surface MUST provide debug tools for generation workflows that use the same app code paths as the mobile UI. Generation tools MUST preserve existing auth, BYOK, hosted, quota, and provider behavior rather than bypassing the normal API client.

#### Scenario: Generation context can be inspected
- **WHEN** the agent invokes `get_generation_context` with a valid generation request
- **THEN** the app returns the sanitized `GenerationContext` that would be sent for that request, including profile, equipment, recent sessions, upcoming events, and planning date inputs

#### Scenario: Workout generation uses normal app path
- **WHEN** the agent invokes `generate_workout` with a valid generation request
- **THEN** the app calls the normal mobile generation service, persists the returned plan locally, and returns a sanitized summary including plan ID, response ID/provenance when present, and saved workout metadata

#### Scenario: Regeneration uses baseline context
- **WHEN** the agent invokes `regenerate_workout` for an existing generated plan with valid feedback
- **THEN** the app builds a regeneration request using the baseline workout/provenance context, calls the normal generation service, persists the new version, and returns the version group summary

#### Scenario: Hosted and quota behavior preserved
- **WHEN** a generation debug tool invokes a hosted or quota-enforced backend
- **THEN** the tool surfaces the same API errors the app would receive, such as `BYOK_REQUIRED` or `QUOTA_EXCEEDED`, rather than bypassing enforcement

### Requirement: Redacted Generation Trace

The app MUST keep a redacted trace of the latest debug-visible generation attempt. The trace MUST include enough metadata to explain generation behavior while omitting secrets and sensitive raw credential material.

#### Scenario: Successful generation trace recorded
- **WHEN** generation completes successfully through the mobile generation service
- **THEN** `get_last_generation_trace` returns a trace containing sanitized request fields, provider name, scheduled date, context summary, upcoming-event count, recent-session count, response ID/provenance when present, saved workout ID, source, and duration

#### Scenario: Failed generation trace recorded
- **WHEN** generation fails or falls back due to provider/API behavior
- **THEN** `get_last_generation_trace` returns sanitized error or fallback metadata without exposing API keys, auth tokens, cookies, or raw secret headers

### Requirement: History Calendar and Workout Action Tools

The MCP surface MUST provide bounded tools for listing history/calendar data and performing common workout debug actions. These tools MUST call existing app repositories or services and return typed, sanitized results.

#### Scenario: History listed by range
- **WHEN** the agent invokes `list_history` with a valid date range or limit
- **THEN** the app returns matching completed workout summaries with archive/favorite metadata according to the requested filters

#### Scenario: Calendar listed by range
- **WHEN** the agent invokes `list_calendar` with a valid date range
- **THEN** the app returns planned events and completed workout calendar items for that range

#### Scenario: Quick log creates manual session
- **WHEN** the agent invokes `quick_log_workout` with a valid manual workout payload
- **THEN** the app creates a completed manual workout using the same local quick-log service used by the UI

#### Scenario: Complete workout marks planned plan done
- **WHEN** the agent invokes `complete_workout` for an existing planned workout
- **THEN** the app marks the workout completed through the existing local repository path and returns the updated summary

### Requirement: Controlled Debug Reset

The MCP surface MAY provide a debug data reset tool, but it MUST be explicitly destructive, debug-only, and guarded by a confirmation token in the tool input.

#### Scenario: Reset rejected without confirmation
- **WHEN** the agent invokes `reset_debug_data` without the required confirmation value
- **THEN** the app rejects the request and leaves local data unchanged

#### Scenario: Reset clears local debug domain data
- **WHEN** the agent invokes `reset_debug_data` with the required confirmation value
- **THEN** the app clears the configured local debug domain data and returns a summary of removed record counts

### Requirement: Bounded Navigation Tools

The MCP surface MAY provide navigation tools, but they MUST be restricted to known app routes and valid domain preconditions. The tools MUST NOT accept arbitrary route names or arbitrary route params.

#### Scenario: Navigate to known route
- **WHEN** the agent invokes a bounded navigation tool such as `open_home`, `open_history`, or `open_settings`
- **THEN** the app navigates to that known route and updates the published current route state

#### Scenario: Start workout requires current plan
- **WHEN** the agent invokes `start_current_workout` without a valid selected plan
- **THEN** the app rejects the request with a clear precondition error rather than navigating with invalid params
