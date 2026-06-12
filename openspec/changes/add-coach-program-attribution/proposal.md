## Why

Coach projection and repair cannot be correct until completed, skipped, generated, and manually logged workouts can be reliably tied back to the program session they came from. The app currently has exercise-level block fields, but not durable session-level program attribution on workout records.

## What Changes

- Add coach-program contract fields for session-level workout attribution and attribution confidence.
- Add a WatermelonDB schema migration for session-level attribution on `workouts` records.
- Stamp generated workouts with program id, program version, primary/add-on source block ids, optional projection id, optional template id, schedule strategy, and attribution confidence.
- Allow manual and quick logs to attach to a projected or recommended coach session when the user logs against that session.
- Migrate existing adaptive plans into coach-program-aware plan data without changing current recommendation behavior.
- Keep legacy name/focus matching only as a low-confidence fallback for old workouts.
- Add deterministic v1 strategy selection during blueprint seeding. The initial strategy comes from template defaults and user context; later strategy changes require explicit program revisions.

## Capabilities

### New Capabilities

- `adaptive-coach-program`: Introduces the coach-program attribution substrate, deterministic v1 strategy selection, and explicit program revision behavior.

### Modified Capabilities

- `training-plan`: Adds metadata-first session attribution and adaptive-plan migration requirements.
- `training-blueprint`: Adds deterministic initial strategy selection during template seeding.

## Impact

- Affected code: `packages/shared/src/lib/contracts/workouts.ts`, shared contract tests, mobile WatermelonDB schema/migrations/models, workout mappers/repositories, adaptive resolver attribution helpers, onboarding/template seeding, and migration fixtures.
- Affected data: `workouts` records gain session-level coach attribution data; adaptive plan schema migrates forward while preserving existing v1 plan fields.
- Affected APIs: public `TodayPlan` content remains stable, but generation/local persistence paths must carry attribution metadata for saved workouts.
- CE/hosted impact: local-first CE behavior is unchanged. Hosted behavior, quota, and billing overlays are unchanged.
