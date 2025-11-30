## 1. Implementation
- [ ] 1.1 Introduce archived metadata on workout session storage (local DB and any server models) and migrate existing data.
- [ ] 1.2 Update snapshot and history queries to filter out archived/deleted sessions by default while keeping an explicit way to include them.
- [ ] 1.3 Ensure `GenerationContext.recentSessions` ignores archived and deleted sessions when building prompts.
- [ ] 1.4 Add API/route handlers or mutations to archive, unarchive, and delete a workout session.
- [ ] 1.5 Implement mobile UI affordances for archive/unarchive/delete from recent activity or history, including confirmation for deletes.
- [ ] 1.6 Add tests for archive vs delete behavior at the data layer, snapshot endpoints, generation context builder, and mobile Home screen behavior.

## 2. Design & DX
- [ ] 2.1 Finalize naming for the archival flag or timestamp (for example `archivedAt` vs `isArchived`) and surface it in shared TypeScript contracts.
- [ ] 2.2 Confirm UX copy and iconography for archive vs delete on mobile.

