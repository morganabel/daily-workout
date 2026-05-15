# home-data Specification

## Purpose

Home data is local-first. The mobile app derives Home state from local repositories for planned workouts, workout versions, recent sessions, preferences, planned events, and transient generation UI state. The backend remains responsible for AI workout generation and provider policy, not for serving an authoritative Home snapshot.
## Requirements
### Requirement: Local-First Home Data

The mobile app MUST derive Home state from local data sources rather than calling a backend Home snapshot endpoint. Home state SHALL include today's selected generated workout, generated workout versions for that day, quick-action presets derived from local preferences, recent session summaries, offline hints, and transient generation status (`state: 'idle' | 'pending' | 'error'`, `submittedAt`, optional `etaSeconds` + `message`).

#### Scenario: Home derives plan from local data

- **GIVEN** the user has one or more planned generated workouts for the current local date
- **WHEN** the Home screen loads
- **THEN** it selects the locally marked version and exposes the full local version group without calling `/api/home/snapshot`

#### Scenario: Local pending generation state

- **GIVEN** the user triggered generation and the AI call is still running
- **WHEN** the Home screen renders
- **THEN** local UI state exposes `{ generationStatus: { state: 'pending', submittedAt, etaSeconds? } }` while keeping the previous local plan visible when available

#### Scenario: Local generation error state

- **GIVEN** the last generation failed
- **WHEN** the Home screen renders
- **THEN** local UI state exposes `{ generationStatus: { state: 'error', message } }` while leaving the last good local plan available so the UI can prompt a retry without discarding context

#### Scenario: Quick actions are derived locally

- **GIVEN** local user preferences contain equipment and focus defaults
- **WHEN** Home builds quick actions
- **THEN** it derives deterministic presets locally and layers any locally staged values on top

### Requirement: Workout Generation Endpoint

The system MUST accept generation parameters and route the generation request to a selectable AI provider (OpenAI or Gemini) using either a managed key or BYOK. It SHALL validate structured output against `TodayPlan`, return the generated plan to the client, and fall back to a deterministic mock when no key or a provider error occurs (except when hosted mode requires BYOK). The mobile client is responsible for persisting the returned plan locally.

#### Scenario: Status transitions to pending

- **GIVEN** a valid generation request
- **WHEN** the server begins processing it
- **THEN** it records pending status for internal generation state and observability while the mobile client maintains its own local pending UI state

#### Scenario: Successful generation returns plan

- **GIVEN** the selected provider returns a valid `TodayPlan`
- **WHEN** the route completes
- **THEN** the response body contains the generated plan with IDs and provenance needed for local persistence and later regeneration

#### Scenario: Provider failure retains context

- **GIVEN** the provider call throws or returns invalid JSON
- **WHEN** the route handles the error
- **THEN** it logs the failure and returns an appropriate generation error or deterministic fallback plan according to edition and provider policy

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

### Requirement: Planning-Date And Baseline-Aware Generation Requests

The workout generation flow MUST accept the operational request inputs needed by the planning layer, including an optional planning date, explicit regeneration baseline workout context, and optional adaptive plan intent. Regeneration and adaptive-plan requests MUST be able to include full merged context rather than assuming provider-side memory.

#### Scenario: Scheduled generation can plan for a future day

- **WHEN** the client requests workout generation for a specific future local date
- **THEN** the generation request includes that planning date so the server can evaluate recent history and upcoming events relative to the intended workout day

#### Scenario: Adaptive recommendation generation includes block intent

- **WHEN** the client requests workout generation from an adaptive plan recommendation
- **THEN** the generation request includes the primary block, optional add-ons, target range context, rationale, and planning date so the server can plan the concrete workout for that recommendation

#### Scenario: Regeneration request includes explicit baseline workout data

- **WHEN** the client requests regeneration of an existing workout
- **THEN** it can submit baseline workout context alongside current constraints so the server can support stateless regeneration paths

#### Scenario: Full context remains available during regeneration

- **WHEN** the client requests regeneration
- **THEN** the request may include merged context instead of relying solely on prior-response continuity

### Requirement: Regeneration-Capable Plan Provenance

When a workout is generated by a provider-backed flow, the system MUST preserve the minimal provenance needed to determine whether later regeneration can use provider continuity or must use a stateless path.

#### Scenario: Generated plan preserves regeneration provenance

- **WHEN** the server returns and persists a provider-generated workout plan
- **THEN** it preserves the minimal provenance required for later regeneration-path selection

#### Scenario: Regeneration falls back safely when provenance is insufficient

- **WHEN** a later regeneration request lacks valid provider continuity provenance
- **THEN** the server uses the stateless regeneration path instead of assuming memory continuity

### Requirement: Planning Layer Precedes Provider Prompting

The workout generation endpoint MUST run the server-side planning layer, including candidate-pool derivation when available, before invoking provider prompting. The endpoint SHALL continue to return the canonical `TodayPlan` response contract.

#### Scenario: Planning layer runs before provider generation

- **WHEN** the endpoint handles a valid generation or regeneration request
- **THEN** it derives the planning brief and any bounded candidate pool before invoking the provider

#### Scenario: Public response remains canonical

- **WHEN** generation uses planning-date context, baseline workout data, and candidate-pool inputs internally
- **THEN** the response body still returns the canonical `TodayPlan` contract rather than internal planning artifacts

#### Scenario: Planning metadata stays server-side

- **WHEN** the generation flow computes planning metadata such as fallback reason, candidate diagnostics, or library version
- **THEN** that metadata remains internal to the server/runtime flow and is not required in the public generation response body

### Requirement: Regeneration Uses Shared Planning Logic

Regeneration flows MUST reuse the same internal planning path as initial generation so that stateless providers, variation requests, and baseline exercise exclusions behave consistently.

#### Scenario: Regeneration reuses the planner for stateless providers

- **WHEN** a regeneration request targets a provider that needs a fresh prompt
- **THEN** the server derives a new internal planning brief from the current request plus baseline workout context instead of relying on provider memory

#### Scenario: Variation exclusions come from planning rather than prompt-only hints

- **WHEN** regeneration asks for a different exercise selection where eligible alternatives exist
- **THEN** the planner excludes the prior exercise IDs from the bounded candidate set before building the provider request

### Requirement: Exercise-Library-Backed Candidate Pool Inputs

The workout generation flow MUST be able to derive server-side candidate pools from the exercise library using generation request inputs, merged user context, and internal planning constraints while preserving the existing `TodayPlan` response contract.

Candidate-pool selection metadata and diagnostics SHALL remain internal to the server-side planning flow and MUST NOT be required in the public generation response.

By default, generation-facing candidate-pool queries SHALL use only exercises whose `metadataCompleteness` is `planner-ready`.

#### Scenario: Generation derives a bounded candidate pool from context

- **WHEN** the server prepares a generation request with equipment, injury or avoid constraints, and environment limits such as quiet or low-impact
- **THEN** it can query the exercise library to produce a bounded eligible candidate pool before invoking model generation

#### Scenario: Public workout response stays stable

- **WHEN** generation uses an exercise-library-backed candidate pool internally
- **THEN** the user-facing generation response still returns the canonical `TodayPlan` contract rather than exposing candidate-pool internals

#### Scenario: Regeneration can reuse the same exercise-library filtering path

- **WHEN** the server prepares a regeneration request for a provider without prior-response memory
- **THEN** it can derive a fresh bounded candidate pool from the exercise library using the current constraints and baseline workout context

#### Scenario: Generation ignores non-ready records by default

- **WHEN** the built exercise library contains imported records that are only `raw`, `derived`, or `curated`
- **THEN** the default generation candidate-pool path excludes those records unless an internal non-production workflow explicitly requests them

### Requirement: Local Workout Logging

Users MUST be able to mark a plan complete or quick-log an ad-hoc session through the mobile local data layer, and Home recent activity MUST update from local repository emissions.

#### Scenario: Log generated plan

- **GIVEN** a locally persisted generated workout
- **WHEN** the user completes it
- **THEN** the app marks the local workout completed, timestamps `completedAt`, and refreshes recent activity from local data

#### Scenario: Quick log without plan

- **GIVEN** no active plan
- **WHEN** the user submits a quick log payload (focus, duration, note)
- **THEN** the app creates a local manual session and recent activity includes it at the top

### Requirement: Preview Payload Persistence

Generated workouts MUST include enough detail for the mobile app to persist and render the workout preview offline.

#### Scenario: Preview fields shipped

- **GIVEN** a generated plan contains blocks/exercises
- **WHEN** the generation endpoint returns the plan
- **THEN** it includes `blocks` data (title, focus, duration, exercises with prescription/detail) so the mobile app can render the preview screen without another fetch

#### Scenario: Local active plan clears after log

- **GIVEN** a plan is logged locally
- **WHEN** local repository observers emit
- **THEN** the active planned workout updates and the completed session appears in recent activity

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

### Requirement: Local Planned Slot Data

The mobile data layer MUST maintain the starter-week planned workout slots locally using planned events. Blueprint-owned planned slots MUST be distinguishable from user-owned life events through metadata, and local queries MUST be able to return planned slots for a date range.

#### Scenario: Blueprint-owned planned slots are queryable

- **WHEN** the mobile app queries planned events for a date range
- **THEN** blueprint-owned planned slots are returned with metadata sufficient to identify schema version, source, template id, slot id, role or label, planned date, target duration, detail state, locked/user-edited marker, and ownership

#### Scenario: User-owned events remain separate

- **WHEN** planned events are used as life context for generation
- **THEN** user-owned life events and blueprint-owned planned workout slots remain distinguishable so starter-week logic updates only app-owned slots

#### Scenario: Planned slots work offline

- **WHEN** the device is offline
- **THEN** the app can still display deterministic starter-week planned slots from local data

### Requirement: Planned Slot To Workout Persistence

When a concrete workout is generated for a planned slot, the mobile data layer MUST link the generated workout to the source planned event and preserve that link across app restarts.

#### Scenario: Generated workout links to planned event

- **WHEN** the app saves a workout generated from a planned slot
- **THEN** it records the link from the planned event to the generated workout

#### Scenario: Linked slot survives metadata updates

- **WHEN** blueprint-owned planned slot metadata is read or updated
- **THEN** it preserves slots that have linked generated workouts

### Requirement: Workout History Archiving and Deletion

The home data layer SHALL support archiving (soft delete) and permanent deletion of workout sessions so users can clean up test data and prevent noisy sessions from influencing future plans. Archived sessions remain stored but are excluded from default recency-based views and from any history passed into the AI `GenerationContext`.

#### Scenario: Archive workout session

- **GIVEN** a completed workout session appears in local recent activity
- **WHEN** the client sends a request to archive that session
- **THEN** the system marks the session as archived, removes it from `recentSessions` and other default local activity lists, and ensures it is not included in any future `GenerationContext.recentSessions`

#### Scenario: Unarchive workout session

- **GIVEN** a workout session has previously been archived
- **WHEN** the client sends a request to unarchive that session
- **THEN** the system clears the archived flag so the session becomes eligible again for inclusion in history lists and `GenerationContext.recentSessions` (subject to existing recency limits)

#### Scenario: Delete workout session

- **GIVEN** a workout session exists in storage (archived or not)
- **WHEN** the client sends a request to delete that session
- **THEN** the system permanently removes the session from the backing store (or marks it as deleted such that it is never returned), and it no longer appears in history lists, local recent activity, or `GenerationContext.recentSessions`

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

### Requirement: Home Adaptive Plan State
Home data MUST expose the active adaptive plan state when available, including target range progress, recent relevant exposures, upcoming schedule constraints, projected or pinned sessions for the active date, and the current recommendation.

#### Scenario: Home loads recommendation from plan state
- **WHEN** a user with an adaptive plan opens Home
- **THEN** Home data includes the recommended primary block, optional add-on blocks, rationale, and alternatives for the active planning date

#### Scenario: Home falls back without adaptive plan
- **WHEN** a user has no adaptive plan
- **THEN** Home shows the one-off Today setup flow without hydrating starter planned-slot metadata

### Requirement: Home Generation Uses Adaptive Recommendation
When a user generates from an adaptive recommendation, Home MUST build a generation request containing structured adaptive plan intent derived from the recommendation.

#### Scenario: Generate from combined recommendation
- **WHEN** Home recommends Pull plus Easy Cardio and the user taps Generate
- **THEN** the generation request includes the primary Pull block and Easy Cardio add-on intent

#### Scenario: User override beats recommendation
- **WHEN** the user explicitly changes the focus before generation
- **THEN** Home sends the explicit focus while retaining adaptive plan context only as background context where applicable
