# Mobile Debug MCP

This debug-only MCP sidecar lets an AI agent call bounded tools inside a running Expo/React Native debug build. The MCP server runs on the development machine; the mobile app connects outward over WebSocket.

## Start the Sidecar

Start the sidecar from the repo root:

```sh
npm run debug:mcp:mobile
```

Optional sidecar environment:

- `MOBILE_DEBUG_MCP_HOST`: WebSocket bind host. Defaults to `127.0.0.1`; use `0.0.0.0` or a LAN IP only when a physical device must connect over the network.
- `MOBILE_DEBUG_MCP_PORT`: WebSocket port for app sessions. Defaults to `8765`.
- `MOBILE_DEBUG_MCP_TOKEN`: Pairing token. Defaults to `local-debug-token` for local development.
- `MOBILE_DEBUG_MCP_REQUEST_TIMEOUT_MS`: App request timeout. Defaults to `15000`.

The sidecar exposes MCP over stdio and listens for app sessions at `ws://127.0.0.1:8765` by default.

## Configure the Mobile App

Run an Expo debug/development build normally:

```sh
npm run dev:mobile
```

The bridge is enabled by default in debug/development builds. Set `EXPO_PUBLIC_ENABLE_DEBUG_MCP=false` to opt out for a local run.
If the sidecar is not running yet, the app keeps working normally and retries the bridge connection with exponential backoff from 2 seconds up to 60 seconds.

Optional app environment:

- `EXPO_PUBLIC_ENABLE_DEBUG_MCP`: Set to `false` to disable the bridge in a debug/development build. Any other value, including unset, leaves it enabled in dev mode.
- `EXPO_PUBLIC_DEBUG_MCP_TOKEN`: Pairing token. Defaults to `local-debug-token` and must match the sidecar token.
- `EXPO_PUBLIC_DEBUG_MCP_URL`: Full WebSocket URL, such as `ws://192.168.1.5:8765`.
- `EXPO_PUBLIC_DEBUG_MCP_HOST`: Host when no full URL is set.
- `EXPO_PUBLIC_DEBUG_MCP_PORT`: Port when no full URL is set. Defaults to `8765`.

Simulator/device host notes:

- iOS simulator: `ws://localhost:8765` usually works.
- Android emulator: use `ws://10.0.2.2:8765`, or run `adb reverse tcp:8765 tcp:8765` and use `localhost`.
- Physical device: bind the sidecar with `MOBILE_DEBUG_MCP_HOST=0.0.0.0` or the development machine LAN IP, then set the app URL to that LAN IP, for example `ws://192.168.1.5:8765`.

The bridge is still gated by debug/development mode. Production builds do not mount the bridge even if debug MCP environment variables are present.

## Tool Input Shape

The sidecar registers each mobile tool as an MCP tool. Tool calls accept:

```json
{
  "sessionId": "optional when only one app is connected",
  "input": {
    "tool-specific": "payload"
  }
}
```

If multiple app sessions are connected, provide `sessionId`. Use `list_debug_sessions` to see connected sessions.

## Tools

Read-only tools:

- `get_app_state`: route, bridge state, backend URL, server capabilities, network status, launch state, redacted auth/BYOK state, DB counts, and UI snapshots.
- `get_home_state`: current plan, plan versions, recent sessions, quick actions, generation status, offline hint, and Home UI state.
- `list_history`: completed workout summaries by limit or date range.
- `list_calendar`: planned events and completed sessions by date range.
- `get_generation_context`: sanitized generation context for a request.
- `get_last_generation_trace`: latest sanitized generation trace.

Mutation tools:

- `set_profile_preferences`: update local profile preferences.
- `seed_history`: create completed manual workout sessions.
- `seed_planned_events`: create planned calendar events.
- `quick_log_workout`: create a manual completed workout through the app service.
- `complete_workout`: mark an existing workout complete.
- `generate_workout`: generate through the normal mobile generation service.
- `regenerate_workout`: regenerate from an existing baseline workout.

Navigation tools:

- `open_home`
- `open_history`
- `open_settings`
- `open_current_workout_preview`: requires a selected/current plan.
- `start_current_workout`: requires a selected/current plan.

Destructive tool:

- `reset_debug_data`: requires `{ "confirm": "reset-debug-data" }` and clears local debug domain data.

## Redaction

The bridge and shared contracts redact raw secrets before returning debug output. Tool responses must not include raw BYOK keys, cookies, bearer tokens, device tokens, or secret-like headers. Secret state is represented as presence metadata or redacted previews.

Generation traces redact free-form request notes as `[REDACTED]` while preserving structured context counts and metadata needed for debugging.
