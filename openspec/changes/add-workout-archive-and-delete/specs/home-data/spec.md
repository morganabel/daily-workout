## ADDED Requirements
### Requirement: Workout History Archiving and Deletion
The home data layer MUST support archiving (soft delete) and permanent deletion of workout sessions so users can clean up test data and prevent noisy sessions from influencing future plans. Archived sessions remain stored but are excluded from default recency-based views and from any history passed into the AI `GenerationContext`.

#### Scenario: Archive workout session
- **GIVEN** a completed workout session appears in `recentSessions` on the Home snapshot
- **WHEN** the client sends a request to archive that session
- **THEN** the system marks the session as archived, removes it from `recentSessions` and other default snapshot activity lists, and ensures it is not included in any future `GenerationContext.recentSessions`

#### Scenario: Unarchive workout session
- **GIVEN** a workout session has previously been archived
- **WHEN** the client sends a request to unarchive that session
- **THEN** the system clears the archived flag so the session becomes eligible again for inclusion in history lists and `GenerationContext.recentSessions` (subject to existing recency limits)

#### Scenario: Delete workout session
- **GIVEN** a workout session exists in storage (archived or not)
- **WHEN** the client sends a request to delete that session
- **THEN** the system permanently removes the session from the backing store (or marks it as deleted such that it is never returned), and it no longer appears in snapshot responses, history lists, or `GenerationContext.recentSessions`

#### Scenario: History queries exclude archived by default
- **GIVEN** the backend (or local-only data layer) powers any endpoint or query that returns workout history or recent activity
- **WHEN** the client requests the default history (without an explicit "include archived" flag)
- **THEN** only non-archived, non-deleted sessions are returned so that archived test data does not clutter the UI or model context

