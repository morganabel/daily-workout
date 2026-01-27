## 1. Implementation

- [ ] 1.1 Add shared Zod schemas/types for `PlannedEvent`, `PlannedEventInput`, `PlannedEventPatch`, `CalendarItem`, and `UpcomingEventContext` (plus canonical event kinds) in `@workout-agent/shared`
- [ ] 1.2 Add mobile local DB storage + repository APIs for planned events (create/update/delete/list by date range)
- [ ] 1.3 Update History UI to support a month calendar view with day markers and a day agenda
- [ ] 1.4 Add "Plan event" create/edit flow (bottom sheet) from the calendar with kind selection
- [ ] 1.5 Add "Quick log" flow from the calendar that defaults `completedAt` to the selected date/time
- [ ] 1.6 Extend generation request to accept optional `upcomingEvents: UpcomingEventContext[]` (bounded) and include it in generation context/prompt
- [ ] 1.7 Add special handling for `kind: 'workout'` planned events (generation action, session linking)
- [ ] 1.8 Add focused unit tests for schemas and any new repository logic

## 2. Validation

- [ ] 2.1 Run `openspec validate add-activity-calendar --strict`
