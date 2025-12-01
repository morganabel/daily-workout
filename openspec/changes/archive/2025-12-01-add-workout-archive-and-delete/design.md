## Context
Workout sessions today are either active or completed, and every completed session is treated equally when building recent history for the Home snapshot and for the AI `GenerationContext`. During testing and normal use this leads to noisy histories (for example short test workouts, accidental duplicates, or outlier sessions) that still influence the model and clutter the recent activity UI.

We want a way to:
- Soft delete (archive) a session so it no longer affects generation or default history views but remains available for inspection.
- Hard delete a session so it is removed entirely when the user wants to clean up test data or mistakes.

## Goals / Non-Goals
- Goals:
  - Allow users to archive individual workout sessions so they are excluded from AI context and default "recent activity" lists.
  - Allow users to permanently delete sessions they no longer want stored on-device.
  - Keep the mental model simple: archived = hidden from context but recoverable; deleted = gone.
- Non-Goals:
  - Building a full analytics dashboard or bulk history management.
  - Implementing cross-device archival semantics beyond whatever sync already provides.
  - Retroactively changing the behavior of past generations that already used now-archived history.

## Decisions
- Decision: Represent archival as a nullable timestamp (for example `archivedAt: Date | null`) on `WorkoutSession` at both the server and local database layers; any non-null value means the session is archived.
  - Alternatives considered: a simple boolean flag (`isArchived`) without timestamp; rejected because a timestamp is useful for debugging and future filtering while still simple to handle.
- Decision: Treat archived sessions as excluded from all recency-based default surfaces:
  - Home snapshot `recentSessions`.
  - Any workout history lists shown by default on mobile.
  - `GenerationContext.recentSessions` and any human-readable history sent to the AI.
- Decision: Provide explicit operations for:
  - Archive (set `archivedAt`).
  - Unarchive (reset `archivedAt` to null).
  - Delete (remove the record or mark it as deleted so it never appears in APIs).
  - These operations may be implemented as dedicated endpoints (for example `POST /api/workouts/{id}/archive`) or as mutations on an eventual history endpoint; the spec focuses on behavior rather than exact route names.

## Risks / Trade-offs
- Users may be confused by the difference between archive and delete; clear labeling and copy are required.
- If filters are not applied consistently, archived sessions could still leak into the AI context or UI, violating user expectations.
- Hard deletion removes data that may have been useful for long-term analytics; for CE/local mode this is an explicit user choice and acceptable trade-off.

## Migration Plan
- Extend the workout session schema (server and local DB) with an archival field (`archivedAt` or equivalent), defaulting to null for all existing sessions.
- Update any query that powers Home snapshot `recentSessions`, history lists, or `GenerationContext.recentSessions` to filter on "not deleted and not archived" by default.
- Ensure existing sessions continue to appear until the user explicitly archives or deletes them.
- Add targeted tests to confirm that archived/deleted sessions never appear in snapshot responses or generation context unless a future endpoint explicitly asks for archived history.

## Open Questions
- Where should archived sessions remain discoverable, if at all, in the mobile UI (for example a filter or separate "Archived" section on the history screen)?
- Should we support bulk archive/delete actions (for example "Archive all sessions before date X") or only per-session actions for now?
- Do we need any safeguards to prevent accidental deletion of long workouts (for example confirmation if duration exceeds a threshold)?

