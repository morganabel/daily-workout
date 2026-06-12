## Context

The current adaptive plan resolver can use recent history and block signals, but reliable coach state needs session-level attribution. Exercise records already carry block metadata, while the session-level `workouts` table has no durable link to the adaptive plan, block, projection, or strategy that produced the session.

This change is deliberately limited to attribution, migration, and deterministic strategy selection. Projection repair, exercise slots, and coach UI are separate changes.

## Goals / Non-Goals

**Goals:**

- Add session-level coach attribution to generated, completed, skipped, and manually logged workouts.
- Add the mobile WatermelonDB migration required for workout attribution.
- Preserve existing adaptive plan fields during migration.
- Use explicit attribution before legacy string matching.
- Define deterministic initial strategy selection and explicit program revision semantics.

**Non-Goals:**

- Generate multi-day projections.
- Implement skip repair or pinned conflict behavior.
- Add exercise-slot templates.
- Change Home, calendar, or settings UI beyond what is needed to persist attribution.
- Use an LLM to choose or silently change stored strategy state.

## Decisions

### 1. Attribution Lives On Workout Sessions

Add session-level attribution to `workouts`, not only to `exercises`. The implementation may use a single JSON column for forward compatibility or explicit columns plus a JSON payload, but the persisted record must be available without reading every exercise log.

The attribution payload must include program id, program version, source block id when known, optional template id, optional projection id, schedule strategy, source kind, and attribution confidence.

Source kind enumerates how the session attached to the program: `generated` (created from a coach recommendation or projection), `manual-log` (user logged against a coach session), `quick-log`, `substitution` (an alternative the coach recommended in place of blocked or skipped work), and `legacy-inferred`. The `substitution` kind exists so later projection repair can retire skipped ordered work explicitly instead of treating the substitute as normal completion of the original block.

### 2. Exercise-Level Block Fields Remain Detail Metadata

Existing exercise-level `blockId`, `blockTitle`, `blockFocus`, and related fields remain useful for rendering and block-level exercise grouping. They are not the authoritative source for whether the session completes or skips coach-program work.

### 3. Legacy Matching Is Low Confidence

The resolver can keep legacy title/focus matching to interpret old workouts, but new program state must prefer explicit session attribution. Inferred attribution is recorded as low confidence and must not be used as though it were a stamped source.

### 4. Strategy Selection Is Deterministic

Blueprint/template seeding chooses the initial strategy from deterministic rules. Template defaults are the primary input; user goal, availability, equipment, and constraints can select among supported template variants.

LLMs may explain strategy choice in later UI, but the stored strategy is not silently changed by a model. A strategy change creates an explicit program revision with a reason.

### 5. Migration Preserves Current Behavior

Existing adaptive plan v1 data is migrated into coach-program-aware shape while preserving blocks, target ranges, typical preferences, pinned sessions, recommendation settings, source template id, coach notes, and rationale. This change should not alter the next-workout recommendation result except where metadata-first attribution makes an existing session link more reliable.

## Risks / Trade-offs

- [Risk] Mobile schema migration breaks local data. Mitigation: add WatermelonDB migration tests and fixture migration coverage before wiring projection logic.
- [Risk] A JSON attribution column is less queryable than explicit columns. Mitigation: this stage optimizes for schema flexibility; later sync/search needs can add indexed columns if required.
- [Risk] Legacy workouts remain ambiguous. Mitigation: preserve low-confidence fallback and avoid using fallback as the only basis for new program advancement.
- [Risk] Strategy choice feels hidden. Mitigation: keep it deterministic and explainable, with explicit revisions for changes.

## Migration Plan

1. Add shared attribution and coach-program revision contracts.
2. Add WatermelonDB schema version and migration for session-level workout attribution.
3. Update workout models, mappers, repositories, and tests to round-trip attribution.
4. Add adaptive plan migration fixtures from v1 to coach-program-aware data.
5. Stamp generated workouts and manual logs when a coach source exists.
6. Update resolver attribution helpers to prefer explicit metadata and keep legacy matching as low-confidence fallback.
