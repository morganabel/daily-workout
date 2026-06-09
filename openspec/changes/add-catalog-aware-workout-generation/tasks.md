## 1. Shared Contracts And Preferences

- [x] 1.1 Extend shared workout contracts with `source: 'library'` and generation `creationMode` validation.
- [x] 1.2 Add user preference fields and defaults for AI-enabled catalog-aware creation versus library-only creation.
- [x] 1.3 Update shared fixtures and contract tests for library-sourced `TodayPlan` objects and existing-profile compatibility.

## 2. Catalog Data Model And Build

- [x] 2.1 Define workout catalog source inputs for curated system recipes, blocks, slots, substitutions, tags, constraints, ownership, and version metadata.
- [x] 2.2 Add a generated SQLite catalog schema with normalized `workout_*` tables that reference canonical `exercise_*` IDs and keep filter-critical data relational.
- [x] 2.3 Add catalog validation for stable IDs, exercise references, planner-ready eligibility, recipe coverage, and representative query behavior.
- [x] 2.4 Document how the SQLite catalog shape can be recreated in PostgreSQL for future hosted/community catalogs.

## 3. Catalog Matching And Materialization

- [x] 3.1 Implement the catalog query/matcher interface that returns `direct`, `adapt`, or `none` decisions.
- [x] 3.2 Implement hard filtering for equipment, experience, injuries, avoid tags, environment, duration, and event-protected stressors.
- [x] 3.3 Implement scoring for focus, adaptive plan intent, duration fit, energy/load, recent-session diversity, and catalog recipe quality.
- [x] 3.4 Implement materialization from selected recipe to canonical `TodayPlan` with `source: 'library'`.
- [x] 3.5 Add unit tests for direct/adapt/none thresholds, no-match diagnostics, and materialized plan validity.

## 4. Server Generation Integration

- [ ] 4.1 Wire catalog matching into `POST /api/workouts/generate` before provider invocation.
- [ ] 4.2 Ensure library mode bypasses provider configuration, BYOK, entitlement quota, and AI metering.
- [ ] 4.3 Ensure auto mode returns direct catalog matches, passes ambiguous matches into planner/provider adaptation, and preserves current AI behavior for weak matches.
- [ ] 4.4 Add internal diagnostics for catalog match decision, selected recipe identity, provider invocation, and catalog route outcome.
- [ ] 4.5 Add server tests for library mode, auto direct match, auto adapted match, weak-match AI flow, explicit AI mode, and quota/metering boundaries.

## 5. Mobile Integration

- [ ] 5.1 Add settings/onboarding UI and persistence for opting out of AI-powered workout creation without adding explanatory copy noise.
- [ ] 5.2 Send the appropriate `creationMode` from mobile generation requests based on the persisted preference.
- [ ] 5.3 Persist returned library workouts through the existing planned workout repository path and show them in Home/history/version flows.
- [ ] 5.4 Add mobile tests proving AI-disabled mode avoids BYOK/paywall prompts and saves `source: 'library'` workouts.

## 6. Evaluation And Validation

- [ ] 6.1 Run catalog matching against the existing generation evaluation corpus and record schema, duration, equipment, injury/avoid, and event-sensitivity results.
- [ ] 6.2 Add targeted evaluation/reporting metadata for catalog decisions and provider invocation.
- [ ] 6.3 Run targeted Nx tests for shared contracts, catalog package, server-core generation, server wiring, and mobile Home/settings behavior.
