# home-data Specification

## Purpose
Add set-level performance logging (weight, reps, RPE) while preserving completion-only and quick-log flows.

## ADDED Requirements
### Requirement: Set-Level Performance Persistence
The system MUST persist workout performance at set granularity for exercises within a workout session. Each set record MUST preserve stable ordering within an exercise and MUST support capturing `reps`, `weight` + `weightUnit` (`lb` or `kg`), and optional integer `RPE` (1-10), plus a completion state.

#### Scenario: Persist and read back set performance
- **GIVEN** a user completes a workout and records set data for at least one exercise
- **WHEN** the user later opens that session’s detail view
- **THEN** the system renders the same set count, ordering, and recorded values (reps/weight/weightUnit/RPE/completed) that the user entered

### Requirement: Post-Completion Set Log Edits
The system MUST support editing set-level performance for completed workout sessions so users can correct mistakes. Edits MUST allow updating set values (`weight`, `weightUnit`, `reps`, optional integer `RPE`, and completion state) and adding/removing sets. Editing set logs MUST NOT clear the session’s completed state.

#### Scenario: Correct a completed session
- **GIVEN** a user has completed a workout and later notices an incorrect recorded weight
- **WHEN** they edit the session and change the set’s `weight` and/or `weightUnit`
- **THEN** the updated set values are persisted and shown on subsequent session detail views

### Requirement: Completion-Only Sessions Remain Valid
The system MUST support “completion-only” sessions where no set-level data is recorded, so the fastest logging paths remain available.

#### Scenario: Completion without set details
- **GIVEN** a user finishes a workout without entering any set values
- **WHEN** the session is stored and shown in history
- **THEN** the session is treated as completed and viewable, and the absence of set details does not block any history or recency views

## MODIFIED Requirements
### Requirement: Workout Logging Endpoint
Users MUST be able to mark a plan complete or quick-log an ad-hoc session, and the response refreshes recent activity. The system MUST additionally support logging set-level performance for generated plans, including `weight` + `weightUnit` (`lb` or `kg`), `reps`, and optional integer `RPE` per set, without breaking completion-only logging.

#### Scenario: Log generated plan (completion-only, backward compatible)
- **GIVEN** a plan ID returned by the snapshot
- **WHEN** the client POSTs to `/api/workouts/{id}/log` with an empty body
- **THEN** the system records a completed session for that plan and returns a valid `WorkoutSessionSummary`

#### Scenario: Log generated plan with set-level performance
- **GIVEN** a plan ID returned by the snapshot
- **WHEN** the client POSTs to `/api/workouts/{id}/log` with a payload that includes per-exercise set performance
- **THEN** the system stores the set-level data for the session and returns a valid `WorkoutSessionSummary`

#### Scenario: Quick log without plan
- **GIVEN** no active plan
- **WHEN** the user submits a quick log payload (focus, duration, note)
- **THEN** the system creates a completed manual session and returns it in recency/history views
