## 1. Shared Contracts

- [x] 1.1 Add Zod schemas and exported types for adaptive training plans, training blocks, target ranges, typical week preferences, projection status, pinned sessions, recommendation rationale, and adaptive plan intent.
- [x] 1.2 Add default adaptive template data for PPL + conditioning with Push, Pull, Legs, Easy Cardio, Sprint, Abs/Accessory, Mobility, and Rest-style blocks.
- [x] 1.3 Add schema validation for target ranges, block compatibility/conflict rules, block target contributions, and plan versioning.
- [x] 1.4 Add shared contract tests for valid adaptive plans, invalid ranges, combined block intent, and every onboarding template producing an adaptive plan.

## 2. Template And Profile Persistence

- [x] 2.1 Extend template selection/creation logic so every onboarding template seeds an adaptive training plan instead of a 7-day starter slot sequence.
- [x] 2.2 Persist the accepted adaptive training plan in local user preferences without creating starter-week planned events.
- [x] 2.3 Add profile repository helpers for saving and updating adaptive plan settings with validation.
- [x] 2.4 Add repository tests covering adaptive plan save, update, invalid range rejection, and template seeding.

## 3. Recommendation Resolver

- [x] 3.1 Implement a deterministic resolver that computes target progress over rolling windows from recent completed sessions and plan block target contributions.
- [x] 3.2 Score primary block candidates using target ranges, preferred rotation, recent stress, recovery guidance, available context, and upcoming planned events.
- [x] 3.3 Score compatible add-on blocks using available time, target progress, compatibility rules, conflict rules, and recent stress.
- [x] 3.4 Return recommendation output with primary block, optional add-ons, alternatives, rationale, and coach notes.
- [x] 3.5 Add resolver tests for PPL sequencing, target ranges, extra lift exposures, Pull + Easy Cardio, Push + Abs, sprint/legs conflicts, and a Saturday hike causing Friday Legs to swap or reflow.

## 4. Home Data And Generation

- [x] 4.1 Extend Home data hydration to load the active adaptive plan, recent-session target progress, upcoming schedule constraints, and recommendation result.
- [x] 4.2 Preserve one-off Home setup behavior for users with no adaptive plan.
- [x] 4.3 Build generation requests from adaptive recommendations, including primary block and optional add-on intent.
- [x] 4.4 Add Home data and generation service tests for recommendation display data, combined session generation, explicit user overrides, and one-off fallback.

## 5. Mobile UI

- [x] 5.1 Update onboarding copy and recommendation UI for adaptive templates from “starter week” to “training rhythm,” blocks, and target ranges.
- [x] 5.2 Add Plan Settings UI for editing target ranges, inspecting blocks, editing typical week preferences, and saving local adaptive plan updates.
- [x] 5.3 Update Home to show the recommended next session, optional add-ons, rationale, alternatives, and customize/generate actions.
- [x] 5.4 Add projected vs pinned language where adaptive plan sessions appear in planning or calendar surfaces.
- [x] 5.5 Add mobile UI tests for adaptive onboarding, plan settings edits, Home recommendation rationale, combined session presentation, and pinned/projected labels.

## 6. Calendar Projection And Planned Events

- [x] 6.1 Decide whether V1 projections are computed on demand, persisted as `planned_events`, or both; document the decision in `design.md` if it changes.
- [x] 6.2 If persisted, add metadata for adaptive projected and pinned workout events without overwriting user-owned events.
- [x] 6.3 Ensure user-owned events such as hikes, sports, travel, and manual plans feed recommendation context without being modified by projection logic.
- [x] 6.4 Add tests for preserving pinned sessions, reflowing projected sessions, and using upcoming events as coach constraints.

## 7. Server Planning And Prompts

- [x] 7.1 Extend shared generation request contracts with optional adaptive plan intent and remove planned-slot generation intent.
- [x] 7.2 Extend server planning brief derivation to record adaptive-plan source metadata, primary block intent, add-on block intent, target context, and rationale.
- [x] 7.3 Ensure explicit focus, injuries, avoid lists, equipment, energy, recent fatigue, and upcoming event protection can override or adjust adaptive intent.
- [x] 7.4 Update provider prompt construction to include adaptive plan intent when present.
- [x] 7.5 Add server-core and prompt tests for adaptive intent, combined blocks, upcoming-event overrides, and explicit-focus precedence.

## 8. Compatibility And Debugging

- [x] 8.1 Remove starter-week planned-slot generation from onboarding, Home, and generation planning.
- [x] 8.2 Update mobile debug MCP schemas/tools if needed so adaptive plan state and recommendation traces remain inspectable without exposing secrets.
- [x] 8.3 Add regression tests proving users without adaptive plans still get one-off Today generation.
- [x] 8.4 Confirm CE and hosted behavior remains identical for adaptive planning, with no new billing or quota paths.

## 9. Coaching Vision Continuity

- [x] 9.1 Document follow-up changes for template library expansion, multi-week progression, plan adaptation, and coach evaluation.
- [x] 9.2 Verify schemas can represent future template families without hardcoding PPL-specific logic.
- [x] 9.3 Add tests proving recommendations derive from structured plan state rather than fixed 7-day slots.
- [x] 9.4 Capture known limitations for periodization, deloads, advanced load metrics, and AI-assisted plan tuning.

## 10. Verification

- [x] 10.1 Run shared package tests for adaptive plan contracts.
- [x] 10.2 Run mobile tests for onboarding, profile persistence, Home data, resolver behavior, and UI presentation.
- [x] 10.3 Run server-core and server-ai tests for generation planning and prompt construction.
- [x] 10.4 Run lint/typecheck targets for affected Nx projects.
