## ADDED Requirements

### Requirement: UI-Ready Coach Projection State

The Home data layer MUST expose UI-ready coach projection state including today's recommendation, upcoming projected sessions, repair notes, conflict warnings, and available actions. The data MUST remain local-first.

#### Scenario: Home data includes next coach action

- **WHEN** a user has an active coach program and projection output exists
- **THEN** Home data exposes the next recommended coach action and rationale

#### Scenario: Home data includes upcoming projection

- **WHEN** projection output covers future days
- **THEN** Home data exposes upcoming projected sessions with status and action metadata

### Requirement: UI Action Handlers

The Home data layer MUST provide handlers or mutations for skip, pin, unpin, move, and generate-from-projection actions. These actions MUST operate on local durable inputs and allow projection repair to recompute.

#### Scenario: Skip handler updates local state

- **WHEN** the UI invokes skip for a projected session
- **THEN** Home data records the skip locally and refreshes projection output

#### Scenario: Generate handler uses projection intent

- **WHEN** the UI invokes generate for a projected session
- **THEN** Home data builds a generation request using that projection's coach intent

### Requirement: Local-First Coach Home

Coach projection UI state MUST be derived locally and MUST NOT require a backend Home snapshot endpoint.

#### Scenario: No backend snapshot required

- **WHEN** the Home screen renders coach projection state
- **THEN** it reads local repositories/selectors rather than an authoritative backend Home snapshot
