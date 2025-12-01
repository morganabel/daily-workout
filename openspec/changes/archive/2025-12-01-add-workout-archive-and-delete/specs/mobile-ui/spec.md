## ADDED Requirements
### Requirement: Workout History Management UI
The mobile app MUST provide controls from the Home screen and/or history views to archive (soft delete) and permanently delete individual workout sessions, with clear feedback and alignment to the data-layer semantics.

#### Scenario: Archive from recent activity
- **GIVEN** a completed workout appears in the Recent Activity list on the Home screen
- **WHEN** the user opens its context menu and taps `Archive`
- **THEN** the app calls the archive operation for that session, removes it from the Recent Activity list, shows a lightweight confirmation (for example a toast), and future generations treat that session as excluded from `recentSessions`

#### Scenario: Unarchive from history
- **GIVEN** the user navigates to a workout history view that can show archived sessions
- **WHEN** they choose `Unarchive` on an archived session
- **THEN** the app calls the unarchive operation, updates the UI so the session appears in the normal (non-archived) history view again, and it becomes eligible for inclusion in `recentSessions` and future generation context

#### Scenario: Delete with confirmation
- **GIVEN** a workout session is visible in Recent Activity or the history view
- **WHEN** the user chooses `Delete` and confirms the action
- **THEN** the app calls the delete operation, removes the session from all local lists, and shows a confirmation that the action cannot be undone

#### Scenario: Archived sessions clearly labeled
- **GIVEN** a history view includes archived sessions
- **WHEN** the list renders those items
- **THEN** each archived session is visually distinguished (for example with an "Archived" badge and de-emphasized styling) so users understand it will not affect future recommendations

