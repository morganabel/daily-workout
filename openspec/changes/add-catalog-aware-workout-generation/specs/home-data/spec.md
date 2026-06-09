## ADDED Requirements

### Requirement: Catalog-Aware Workout Creation Mode
The workout generation request MUST support an explicit creation mode that lets the server choose between catalog-aware automatic routing, explicit catalog/library creation, and explicit AI generation while preserving `POST /api/workouts/generate` as the single workout creation endpoint.

#### Scenario: Auto mode uses one endpoint
- **WHEN** the mobile app requests a workout with catalog-aware automatic mode
- **THEN** it calls `POST /api/workouts/generate` and the server may return a catalog or AI-generated `TodayPlan`

#### Scenario: Library mode avoids AI provider requirements
- **WHEN** the mobile app requests a workout in library mode
- **THEN** the server does not require BYOK headers, managed provider keys, AI quota, or model metering for that request

#### Scenario: Explicit AI mode preserves provider path
- **WHEN** a request explicitly asks for AI generation
- **THEN** provider errors, BYOK requirements, and quota behavior follow the existing AI generation rules rather than silently returning a catalog workout

### Requirement: Library Workout Source
Generated workout plans MUST be able to identify catalog/library origin without changing the rest of the canonical `TodayPlan` persistence and preview contract.

#### Scenario: Library plan persists locally
- **WHEN** the server returns a catalog-selected workout
- **THEN** the response validates as `TodayPlan` with `source: 'library'` and the mobile app persists it through the existing planned workout path

#### Scenario: Saved workout snapshots catalog output
- **WHEN** a catalog workout is saved locally
- **THEN** the saved workout stores the resolved plan snapshot so future catalog updates do not change workout history
