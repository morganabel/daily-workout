## 1. Shared Contracts And Template Definitions

- [ ] 1.1 Add shared schemas/types for onboarding answers, training blueprint, training template ids, starter-week slot roles, detail state, and versioned planned-slot metadata
- [ ] 1.2 Add deterministic template definitions and answer-to-template mapping for the initial templates
- [ ] 1.3 Add backward-compatible preference parsing so existing users without blueprint fields still validate
- [ ] 1.4 Add unit tests for template selection, blueprint parsing, and planned-slot metadata validation

## 2. Local Profile And Planned Slot Services

- [ ] 2.1 Extend `UserRepository` preference helpers to save onboarding answers, blueprint setup status, inferred rhythm, duration assumptions, equipment/location assumptions, and plan-setting edits
- [ ] 2.2 Add a deterministic starter-week slot service that creates app-owned planned workout events from the accepted blueprint
- [ ] 2.3 Ensure starter-week slot creation preserves user-owned planned events and user-edited, locked, or linked app-owned slots
- [ ] 2.4 Add tests for accepting a blueprint, creating planned slots, preserving existing user events, and keeping metadata versioned/minimal

## 3. Mobile Onboarding And Plan Settings

- [ ] 3.1 Add a first-run onboarding route after Explore/account creation with the goal/experience/environment flow and visual style aligned to the current app and calendar mockups
- [ ] 3.2 Add the recommended starter week screen with primary `Use this plan`, secondary `Adjust`, and skip handling
- [ ] 3.3 Add Profile/Plan Settings editing for power users to modify the accepted template, inferred rhythm, duration assumptions, equipment/location assumptions, and slot preferences after onboarding
- [ ] 3.4 Update the Home profile prompt so completed or skipped blueprint setup is not repeatedly shown
- [ ] 3.5 Add mobile tests for onboarding completion, recommendation acceptance, adjustment entry, skip behavior, and returning-user routing

## 4. Planned Slot UI And Detail Generation

- [ ] 4.1 Render blueprint-owned planned workout slots in the existing calendar/agenda surfaces using planned event metadata
- [ ] 4.2 Add a planned-slot action that generates or opens the linked detailed workout for the selected slot
- [ ] 4.3 Pass planned-slot intent into the existing generation request/context when generating a detailed workout
- [ ] 4.4 Add tests proving planned-slot generation uses the intended role, target duration, equipment/location assumptions, planning date, and nearby planned events

## 5. Server Planning Integration

- [ ] 5.1 Extend generation context/planning inputs so optional planned-slot intent can be represented without changing the public `TodayPlan` response
- [ ] 5.2 Update planning-brief derivation so explicit planned-slot intent has precedence over generic Smart focus while still honoring safety and life-event constraints
- [ ] 5.3 Add server-core tests for pull/push/legs/sprint/recovery planned-slot intents and event-protection interactions

## 6. Mobile Debug MCP Compatibility

- [ ] 6.1 Ensure updated `userPreferencesSchema`, `plannedEventInputSchema`, and `generationRequestSchema` remain compatible with mobile debug MCP inputs
- [ ] 6.2 Add or update mobile debug MCP contract tests for blueprint preferences, planned-slot metadata, and planned-slot generation context
- [ ] 6.3 Update `tools/mobile-debug-mcp/README.md` to document seeding onboarding state and planned workout slots with existing MCP tools
- [ ] 6.4 Do not add a new MCP tool for v1 unless `set_profile_preferences`, `seed_planned_events`, `list_calendar`, `get_generation_context`, and `generate_workout` cannot cover the debug workflow

## 7. Validation

- [ ] 7.1 Run `openspec validate add-template-based-training-onboarding --strict`
- [ ] 7.2 Run targeted shared/mobile/server tests through Nx for changed packages
- [ ] 7.3 Manually review onboarding, recommended-week, and planned-slot screens against current app styling and the provided screenshot direction
