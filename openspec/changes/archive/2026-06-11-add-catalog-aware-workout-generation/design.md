## Context

The current server path merges the request and local mobile context, derives a deterministic planning brief, builds an exercise-library candidate pool, and invokes a model provider unless configuration or policy prevents it. The exercise library already packages canonical exercise IDs, metadata, and planner-ready filtering in SQLite, but it does not contain curated workout programming.

The desired catalog is not a silent fallback. Users may explicitly opt out of AI features, and even when AI is enabled the server should consider curated catalog workouts when they are a better fit than a fresh model call. This keeps the app simple for users while preserving one creation endpoint and one persisted workout shape.

## Goals / Non-Goals

**Goals:**

- Add a curated server-side workout catalog that references canonical exercise IDs.
- Keep the existing generation endpoint as the single workout creation surface.
- Add explicit creation modes for AI-enabled, library-only, and catalog-aware automatic routing.
- Let excellent catalog matches return directly and ambiguous matches be adapted through the planner/AI path.
- Keep catalog storage relational and portable enough to recreate in PostgreSQL later.
- Preserve local history as resolved workout snapshots rather than live catalog views.

**Non-Goals:**

- Do not require workout catalog selection to run locally on mobile.
- Do not add community-submitted workouts in v1.
- Do not replace the exercise library with workout recipes.
- Do not silently convert AI provider failures into catalog workouts when the user explicitly asked for AI.
- Do not add a separate public endpoint for normal workout creation.

## Decisions

### Decision: Keep one creation endpoint with explicit creation mode

`POST /api/workouts/generate` remains the creation endpoint. The request gains an internal/public mode such as `creationMode: 'auto' | 'library' | 'ai'`, where `auto` is the normal catalog-aware path, `library` is used when the user opts out of AI features, and `ai` preserves the current provider-first behavior.

Why this approach:

- The mobile app already treats generation as "create a workout for this context."
- Both catalog and AI paths return the same `TodayPlan` contract.
- Server internals can branch on quota, catalog fit, and provider availability without creating competing API surfaces.

Alternatives considered:

- Add a new library endpoint: rejected because it duplicates the creation surface and makes the client choose implementation details.
- Hide catalog selection as fallback only: rejected because the user wants explicit AI opt-out and catalog-aware routing.

### Decision: Store workout recipes as a catalog domain that references exercises

The catalog should use relational `workout_*` tables alongside or adjacent to existing `exercise_*` tables. Workout recipes reference canonical exercise IDs for slots and substitutions, while denormalized display fields can be materialized into the returned `TodayPlan`.

Why this approach:

- Exercise facts and workout programming have different lifecycles but must remain referentially linked.
- Validation can fail if a recipe uses a missing or non-planner-ready exercise.
- A relational shape can be recreated in PostgreSQL for hosted/community catalogs later.

Alternatives considered:

- Store workouts only as static `TodayPlan` JSON: rejected because filter-critical fields, exercise references, and future ownership/search behavior would be opaque.
- Merge workout rows into exercise records: rejected because recipes have blocks, slots, substitutions, durations, and programming semantics that are not exercise metadata.

### Decision: Use catalog fit decisions before provider invocation

The server runs a catalog matcher after deterministic planning context is available and before provider generation. It returns `direct`, `adapt`, or `none`.

Why this approach:

- Excellent matches avoid unnecessary model calls.
- Ambiguous matches can still benefit from the existing planner and provider adaptation.
- Weak matches preserve the current AI generation path.

Alternatives considered:

- Always ask AI to adapt catalog workouts: rejected because it wastes model calls on already-good matches.
- Use catalog only when AI is disabled: rejected because AI-enabled users can still benefit from curated workouts.

### Decision: Keep saved workouts as snapshots

The mobile app stores the resolved `TodayPlan` returned by the server. It does not store a live catalog recipe reference as the source of truth for history.

Why this approach:

- Catalog updates must not mutate past workouts.
- Current local persistence and preview/offline rendering already work from serialized plan data.
- Future catalog provenance can be included as metadata without changing history semantics.

Alternatives considered:

- Store only catalog recipe IDs locally: rejected because recipe updates would change user history and require server lookups for old workouts.

## Risks / Trade-offs

- [Catalog matching returns mediocre direct workouts] -> Mitigation: use conservative direct thresholds and route ambiguous matches through planner/AI adaptation.
- [Catalog schema becomes too SQLite-specific] -> Mitigation: keep filter-critical data in normalized tables and avoid SQLite-only behavior in core schema assumptions.
- [Exercise and workout catalog builds drift] -> Mitigation: make workout validation depend on canonical exercise references and planner-ready metadata.
- [AI-disabled users see no-match dead ends] -> Mitigation: return structured no-match errors and ensure v1 catalog coverage targets common onboarding templates, equipment, durations, and focuses.
- [Hosted quota semantics become confusing] -> Mitigation: catalog direct/library paths never consume AI quota; adapted/AI paths follow current provider entitlement rules.

## Migration Plan

1. Add shared contract fields for creation mode and `source: 'library'`.
2. Add catalog source inputs, build output, validation, and query interfaces.
3. Wire catalog matching into server generation behind a feature/config guard until coverage tests pass.
4. Add mobile preference storage for AI opt-out and send creation mode in generation requests.
5. Run catalog coverage, server generation, and mobile Home/settings tests.
6. Roll back by disabling catalog-aware routing and hiding the AI opt-out preference; the existing AI generation path remains intact.

## Open Questions

- What exact threshold separates `direct` from `adapt` after initial catalog coverage is visible?
- Should adapted catalog workouts preserve catalog provenance in a new internal metadata field or only in logs/evaluation output?
- Should v1 include a small admin/debug catalog inspection page, or keep catalog inspection to scripts/tests?
