## Why

Users need a fast, visual way to review training history and plan around upcoming activities (e.g., a hike on Saturday) so they can see their fitness picture at a glance and optionally inform workout generation with upcoming context.

## What Changes

- Add an **Activity Calendar** view (month grid + day agenda) as the primary way to browse workout history.
- Add **planned events** (future activities/constraints) that appear on the calendar (e.g., hike, long run, rest day, planned workout).
- Add **quick log from the calendar** so users can backfill a workout/activity in a few taps on the selected date.
- Pass planned events as **generation context** so generated workouts can consider upcoming activities (e.g., avoid heavy legs the day before a hike).

## Impact

- Affected specs:
  - New: `activity-calendar`
  - Updated: `home-data` (generation can accept upcoming event context)
- Affected code (anticipated):
  - Mobile: `apps/mobile/src/app/HistoryScreen.tsx`, navigation, new calendar UI components, local DB repositories/migrations
  - Shared: `packages/shared` contracts for planned events and generation request/context
  - Server: generation endpoint to accept optional upcoming-event context
