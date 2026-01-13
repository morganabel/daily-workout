# mobile-ui Specification

## Purpose
Add fast set-level logging (weight, reps, RPE) during Active Workout execution while keeping a simple “finish” flow.

## ADDED Requirements
### Requirement: Workout Session Detail View
The mobile app MUST allow users to open a completed workout session from History/Recent Activity and review exercise-by-exercise set performance (reps, weight + unit, optional integer RPE).

#### Scenario: Open a completed session
- **GIVEN** the user is viewing the History screen
- **WHEN** they tap a completed workout session
- **THEN** the app navigates to a session detail screen showing exercises and their logged sets (if any)

#### Scenario: Completion-only session messaging
- **GIVEN** the user opens a completed workout session that has no set logs
- **WHEN** the session detail screen renders
- **THEN** the UI clearly indicates that no set details were logged and does not show empty placeholder set rows as if they were completed data

#### Scenario: Edit a completed session
- **GIVEN** the user opens a completed workout session detail view
- **WHEN** they switch into edit mode and adjust set values (weight/unit/reps/RPE) or add/remove a set
- **THEN** the changes are saved locally and are visible when the user re-opens the session detail view

## MODIFIED Requirements
### Requirement: Active Workout Mode
The app SHALL provide an active mode for executing a workout plan, tracking time, and logging set-level performance. Users MUST be able to record `weight` (in `lb` or `kg`), `reps`, and optional integer `RPE` per set for each exercise, and mark sets complete as they go.

#### Scenario: Start workout seeds default sets
- **GIVEN** a generated plan is visible on the Preview screen
- **WHEN** the user taps "Start workout"
- **THEN** the app navigates to the Active Workout screen, starts the session timer, and pre-populates each exercise with a default list of sets ready for editing

#### Scenario: Log set performance
- **GIVEN** the Active Workout screen is open and an exercise has one or more sets
- **WHEN** the user enters `weight` + unit and `reps` (and optionally integer `RPE`) for a set and marks it complete
- **THEN** the set row reflects the completed state and the values are persisted so they remain after navigating away and back

#### Scenario: Finish workout with partial data
- **GIVEN** the user has completed zero or more sets (some may be incomplete)
- **WHEN** they tap "Finish Workout"
- **THEN** the workout is marked completed with `completedAt` and duration saved, and any entered set values remain associated with the completed session for later review
