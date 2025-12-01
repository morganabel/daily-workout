## 1. Implementation
- [x] 1.1 Introduce archived metadata on workout session storage (local DB; server N/A) and migrate existing data.
- [x] 1.2 Update snapshot/history queries to filter out archived/deleted sessions by default while keeping an explicit way to include them (local history + generation context).
- [x] 1.3 Ensure `GenerationContext.recentSessions` ignores archived and deleted sessions when building prompts.
- [x] 1.4 Add archive/unarchive/delete mutations (local-only via repository/API helpers; no server endpoints required for current flow).
- [x] 1.5 Implement mobile UI affordances for archive/unarchive/delete from recent activity or history, including confirmation for deletes.
- [x] 1.6 Add tests for archive vs delete behavior at the data layer, snapshot endpoints, generation context builder, and mobile Home screen behavior.

## 2. Design & DX
- [x] 2.1 Finalize naming for the archival flag or timestamp (for example `archivedAt` vs `isArchived`) and surface it in shared TypeScript contracts.
- [x] 2.2 Confirm UX copy and iconography for archive vs delete on mobile.
