# home-data Specification

## Purpose

TBD - created by archiving change add-mobile-home-data-pipeline. Update Purpose after archive.
## Requirements
### Requirement: Home Snapshot Endpoint

The backend MUST expose a single authenticated endpoint that returns today's plan, quick-action presets, and the last three session summaries. Snapshot responses SHALL now include a `generationStatus` object describing the latest generation attempt (`state: 'idle' | 'pending' | 'error'`, `submittedAt`, optional `etaSeconds` + `message`) so the client can mirror pending/error states even if the plan is still the previous one.

**Reason**: We are moving to a local-first architecture where the home screen state is derived from the local database, not a server snapshot.
**Migration**: The endpoint will be deprecated or repurposed for sync only. The client will no longer call this on load.

#### Scenario: Snapshot exposes pending generation state

- **GIVEN** the user triggered generation within the last 30 seconds and the AI call is still running
- **WHEN** the snapshot endpoint responds
- **THEN** it includes `{ generationStatus: { state: 'pending', submittedAt, etaSeconds } }` plus the most recently available plan (if any) so the client can show progress without losing the previous plan

#### Scenario: Snapshot surfaces persisted plan

- **GIVEN** the latest generation completed successfully
- **WHEN** the client fetches the snapshot after a reload
- **THEN** the `plan` field contains the stored `TodayPlan` (until it is logged/cleared) and `generationStatus.state` returns to `idle`

#### Scenario: Snapshot reports last error

- **GIVEN** the last generation failed (e.g., provider timeout)
- **WHEN** the snapshot endpoint responds
- **THEN** it sets `generationStatus` to `{ state: 'error', message }` while leaving the last good plan untouched so the UI can prompt a retry without discarding context

#### Scenario: Snapshot quick actions stay deterministic

- **GIVEN** no server-side storage of quick-action overrides
- **WHEN** the snapshot endpoint responds
- **THEN** it returns the default quick action presets (or ones derived from the stored plan) so the mobile client can layer its locally staged values on top deterministically

### Requirement: Workout Generation Endpoint
The system MUST accept quick-action parameters and route the generation request to a selectable AI provider (OpenAI or Gemini) using either a managed key or BYOK. It SHALL validate structured output against `TodayPlan`, update per-device generation status before and after the call, and fall back to a deterministic mock when no key or a provider error occurs (except when hosted mode requires BYOK).

#### Scenario: Status transitions to pending
- **GIVEN** a valid generation request
- **WHEN** the server begins processing it
- **THEN** it immediately records `{ state: 'pending', submittedAt=now }` in the store so any concurrent snapshot reflects the in-flight status

#### Scenario: Successful generation persists plan
- **GIVEN** the selected provider returns a valid `TodayPlan`
- **WHEN** the route completes
- **THEN** the plan (with IDs) is stored against the DeviceToken, `generationStatus` resets to `idle`, and the response body matches the stored plan

#### Scenario: Provider failure retains context
- **GIVEN** the provider call throws or returns invalid JSON
- **WHEN** the route handles the error
- **THEN** it logs the failure, sets `generationStatus.state` to `error` with a human-readable message, keeps the last good plan available, and returns the deterministic mock plan (unless hosted BYOK enforcement blocks it)

#### Scenario: Default provider selection
- **GIVEN** no provider override is sent
- **WHEN** the server handles generation
- **THEN** it chooses the provider from server config (`AI_PROVIDER`, defaulting to OpenAI) and applies per-provider model/base defaults before invoking the call

#### Scenario: BYOK provider override
- **GIVEN** the client sends `x-ai-provider: gemini` plus a BYOK key via `x-ai-key` or `x-gemini-key`
- **WHEN** the request is processed
- **THEN** the server uses the Gemini provider with that key (ignoring any OpenAI env key) and returns the validated `TodayPlan`

#### Scenario: Backward-compatible OpenAI BYOK
- **GIVEN** the client only sends `x-openai-key`
- **WHEN** the request is processed
- **THEN** the server infers `provider=openai` and uses that key without requiring `x-ai-provider`, preserving existing clients

#### Scenario: Unsupported provider rejected
- **GIVEN** a request declares `x-ai-provider` outside the supported list
- **WHEN** the server validates the request
- **THEN** it returns `400 INVALID_PROVIDER`, does not invoke any provider, and the generation status records an error state

#### Scenario: Hosted edition without key
- **GIVEN** `EDITION=HOSTED` and no key for the chosen provider (neither env nor BYOK)
- **WHEN** the client requests generation
- **THEN** the server responds with `{ code: 'BYOK_REQUIRED' }` instead of issuing a mock plan

### Requirement: Workout Logging Endpoint

Users MUST be able to mark a plan complete or quick-log an ad-hoc session, and the response refreshes recent activity.

#### Scenario: Log generated plan

- **GIVEN** a plan ID returned by the snapshot
- **WHEN** the client POSTs to `/api/workouts/{id}/log`
- **THEN** the server writes a `WorkoutSession`, timestamps `completedAt`, and returns the updated session summary list

#### Scenario: Quick log without plan

- **GIVEN** no active plan
- **WHEN** the user submits a quick log payload (focus, duration, note)
- **THEN** the server creates a manual session and returns it at the top of `recentSessions`

### Requirement: Preview Payload Persistence

The snapshot MUST include enough detail to render the workout preview offline within the same session.

#### Scenario: Preview fields shipped

- **GIVEN** a generated plan contains blocks/exercises
- **WHEN** the snapshot or generation endpoint returns the plan
- **THEN** it includes `blocks` data (title, focus, duration, exercises with prescription/detail) so the mobile app can render the preview screen without another fetch

#### Scenario: Cache invalidation after log

- **GIVEN** a plan is logged via the logging endpoint
- **WHEN** the client requests a new snapshot
- **THEN** `plan` becomes `null` (or next generated plan), and the completed session appears in `recentSessions`

### Requirement: Local Data Persistence

The mobile application MUST persist all user data (workouts, history, preferences) locally using WatermelonDB.

#### Scenario: Offline data access

- **GIVEN** the device has no network connection
- **WHEN** the user opens the app
- **THEN** the Home Screen loads the current plan and history from the local database instantly

#### Scenario: Data persistence across restarts

- **GIVEN** the user logs a workout and closes the app
- **WHEN** the user reopens the app
- **THEN** the logged workout appears in the history list

### Requirement: Workout History Archiving and Deletion
The home data layer SHALL support archiving (soft delete) and permanent deletion of workout sessions so users can clean up test data and prevent noisy sessions from influencing future plans. Archived sessions remain stored but are excluded from default recency-based views and from any history passed into the AI `GenerationContext`.

#### Scenario: Archive workout session
- **GIVEN** a completed workout session appears in `recentSessions` on the Home snapshot
- **WHEN** the client sends a request to archive that session
- **THEN** the system marks the session as archived, removes it from `recentSessions` and other default snapshot activity lists, and ensures it is not included in any future `GenerationContext.recentSessions`

#### Scenario: Unarchive workout session
- **GIVEN** a workout session has previously been archived
- **WHEN** the client sends a request to unarchive that session
- **THEN** the system clears the archived flag so the session becomes eligible again for inclusion in history lists and `GenerationContext.recentSessions` (subject to existing recency limits)

#### Scenario: Delete workout session
- **GIVEN** a workout session exists in storage (archived or not)
- **WHEN** the client sends a request to delete that session
- **THEN** the system permanently removes the session from the backing store (or marks it as deleted such that it is never returned), and it no longer appears in snapshot responses, history lists, or `GenerationContext.recentSessions`

#### Scenario: History queries exclude archived by default
- **GIVEN** the backend (or local-only data layer) powers any endpoint or query that returns workout history or recent activity
- **WHEN** the client requests the default history (without an explicit "include archived" flag)
- **THEN** only non-archived, non-deleted sessions are returned so that archived test data does not clutter the UI or model context

### Requirement: Flattened LLM Workout Schema
The generation pipeline MUST support a flattened LLM workout schema with a maximum nesting depth of 3. The flattened schema SHALL represent blocks without nested exercises and SHALL represent exercises as a top-level list keyed by `blockIndex` with explicit `order`. The transformer MUST rebuild the canonical `TodayPlan` blocks and exercises in stable order without altering client-visible fields. The flattened schema MUST include required fields for: `focus`, `durationMinutes`, `equipment`, `source`, `energy`, `summary`, `blocks[]`, and `exercises[]`. Each block SHALL include `title`, `durationMinutes`, and `focus`. Each exercise SHALL include `blockIndex`, `order`, `name`, `prescription`, and `detail` (nullable).

#### Scenario: Flat schema rebuilds ordered exercises
- **GIVEN** an LLM payload with `blocks` and a top-level `exercises` list that includes `blockIndex` and `order`
- **WHEN** the transformer processes the payload
- **THEN** each `TodayPlan.block` contains its exercises sorted by `order` and no exercises are dropped or reordered

#### Scenario: Depth stays within limit
- **GIVEN** the provider requires a low-depth structured output schema
- **WHEN** the generation request is configured for the flattened schema
- **THEN** the schema depth does not exceed 3 levels while still representing the full workout

#### Scenario: Invalid block mapping fails transformation
- **GIVEN** an LLM payload where an exercise references a `blockIndex` outside `[0, blocks.length)`
- **WHEN** the transformer processes the payload
- **THEN** the transformation fails and is treated as an invalid provider response (no best-effort dropping)

#### Scenario: Missing blocks fails transformation
- **GIVEN** an LLM payload with no `blocks` or an empty `blocks` list
- **WHEN** the transformer processes the payload
- **THEN** the transformation fails and is treated as an invalid provider response

#### Scenario: Duplicate order per block fails transformation
- **GIVEN** an LLM payload where two exercises share the same `order` for the same `blockIndex`
- **WHEN** the transformer processes the payload
- **THEN** the transformation fails and is treated as an invalid provider response

### Requirement: Flattened Schema Invariants
For the flattened schema, `blockIndex` MUST be 0-based and within `[0, blocks.length)`. `order` MUST be 0-based and unique per `blockIndex`. These invariants MUST be enforced during transformation.

#### Scenario: Enforced ordering invariants
- **GIVEN** a flat payload with valid `blockIndex` and unique `order` values
- **WHEN** the transformer processes the payload
- **THEN** it emits a canonical `TodayPlan` with exercises in deterministic order

### Requirement: Schema Depth Definition
Schema depth SHALL be measured as the maximum nesting of objects/arrays along any path, counting each object or array as +1 from the root object. The flattened schema MUST remain at depth <= 3 by this definition.

#### Scenario: Depth calculation is enforceable
- **GIVEN** the flattened JSON schema definition
- **WHEN** depth is computed for the schema
- **THEN** the maximum depth is <= 3

### Requirement: Token-Efficient Schema Selection
When multiple LLM schemas are supported, the generation pipeline SHALL prefer the most token-efficient schema available for the active provider (estimated JSON size, defaulting to the flattened schema) and MUST record the selected schema version in internal generation metadata.

#### Scenario: Provider uses flattened schema by default
- **GIVEN** a provider that supports structured output for the flattened schema
- **WHEN** a generation request runs without an explicit override
- **THEN** the system selects the flattened schema, records its version, and returns the same canonical `TodayPlan` to the client

#### Scenario: Explicit schema override wins
- **GIVEN** an operator-configured override for the LLM schema version
- **WHEN** a generation request runs
- **THEN** the system selects the overridden schema version regardless of size estimates

### Requirement: Schema Selection Algorithm
The selection algorithm MUST be deterministic and configurable. It SHALL: (1) apply explicit overrides first, (2) fall back to provider-supported schemas when only one is available, (3) otherwise choose the smallest estimated JSON size with ties resolved in favor of the flattened schema, and (4) record the selected schema version in generation metadata.

#### Scenario: Tie breaks to flattened schema
- **GIVEN** two supported schemas with equal estimated size
- **WHEN** a generation request runs without an override
- **THEN** the flattened schema is selected

### Requirement: Fallback Semantics
Fallback behavior MUST be selection-time only. If a chosen schema fails validation or transformation, the generation request SHALL fail under the existing provider error rules and SHALL NOT automatically retry with another schema during the same request.

#### Scenario: No runtime retry on transform failure
- **GIVEN** a generation request using the flattened schema
- **WHEN** the transformation fails
- **THEN** the request fails with the existing provider error handling and does not re-invoke the provider with a different schema

### Requirement: Schema Versioning & Metadata
The generation pipeline MUST record the LLM output schema version used for parsing/transformation (e.g., `v1-current` or `v2-flat`) in internal generation metadata. The choice of schema version MUST NOT change any non-ID fields in the canonical `TodayPlan`.

#### Scenario: Metadata reflects LLM output schema
- **GIVEN** a generation request processed with the flattened schema
- **WHEN** the plan is persisted and returned
- **THEN** internal metadata records the flattened schema version and the client-visible fields match the canonical format

### Requirement: Enum Expansion Mapping
The transformer MUST support expanding compact enum values from the LLM payload into canonical complex objects or arrays required by the API response.

#### Scenario: Enum value expands into canonical structure
- **GIVEN** the LLM returns a compact enum value for a field that maps to a richer structure
- **WHEN** the transformer processes the payload
- **THEN** the resulting `TodayPlan` includes the expanded object/array as defined by server mapping rules

#### Scenario: Unknown enum value fails transformation
- **GIVEN** the LLM returns an enum value that is not mapped in the server ruleset
- **WHEN** the transformer processes the payload
- **THEN** the transformation fails and is treated as an invalid provider response

### Requirement: LLM Response Transformation Layer
The workout generation pipeline MUST normalize LLM responses into the canonical API workout schema so client contracts stay stable even when prompt schemas change or are simplified for cost/performance.

#### Scenario: Canonical response preserved
- **GIVEN** the transformer receives a simplified LLM plan output (e.g., missing derived IDs or secondary metadata)
- **WHEN** it processes the payload
- **THEN** it emits a fully populated `TodayPlan` matching the existing API fields and persists/returns that normalized plan to the client

#### Scenario: Identity path for current schema
- **GIVEN** the LLM still returns the current `TodayPlan` schema
- **WHEN** the transformer runs
- **THEN** it validates and passes the payload through without altering its semantic content so responses remain structurally equivalent to today’s format (same fields and values, regardless of whitespace or key ordering)

#### Scenario: Versioned schema selection
- **GIVEN** the server configures an `llmSchemaVersion` (or feature flag) for generation
- **WHEN** a generation request executes
- **THEN** the transformer selects the matching parser/mapping rules, records the configured `llmSchemaVersion` in internal generation metadata (for observability and persistence alongside the plan), and keeps the API response shape constant

#### Scenario: Transformation failure handling
- **GIVEN** the LLM output cannot be mapped or validated (e.g., missing required block structure)
- **WHEN** the transformer detects the failure
- **THEN** it treats the request as a provider failure: logs the mapping error, sets `generationStatus` to `error`, and triggers the existing deterministic/mock fallback rules (respecting hosted BYOK enforcement)

