## ADDED Requirements

### Requirement: Generation Accepts Upcoming Event Context
The workout generation endpoint MUST accept an optional `upcomingEvents` field that provides a bounded summary of planned events so the LLM can consider upcoming activities when generating a workout (e.g., avoid heavy leg work the day before a planned hike). Each item MUST be treated as prompt/context input only and MUST NOT be required for persistence.

#### Scenario: Upcoming events are included in generation prompt
- **GIVEN** the client sends a generation request with `upcomingEvents`
- **WHEN** the server generates a workout
- **THEN** the server includes the upcoming event context in its prompt so the LLM can consider it when planning the workout

#### Scenario: Upcoming events have a stable minimal shape
- **GIVEN** the client sends `upcomingEvents`
- **THEN** each event item includes at least `kind`, `title`, and a calendar bucketing key such as `localDate` (`YYYY-MM-DD`)
- **AND** it MAY include `startsAt`, `allDay`, `durationMinutes`, `intensity`, `tags`, `notes`, and `metadata`

#### Scenario: Upcoming events are bounded
- **GIVEN** the server validates the request
- **THEN** it MUST accept at least 10 upcoming events
- **GIVEN** the client sends more than the supported maximum number of upcoming events
- **WHEN** the server validates the request
- **THEN** it rejects the request with `400` and does not invoke an AI provider

#### Scenario: Missing upcoming events preserves existing behavior
- **GIVEN** the client sends a generation request without `upcomingEvents`
- **WHEN** the server generates a workout
- **THEN** generation proceeds using the existing context sources without requiring any planned event data

#### Scenario: Invalid upcoming events are rejected
- **GIVEN** the client sends malformed `upcomingEvents` data
- **WHEN** the server validates the request
- **THEN** it returns a `400` error and does not invoke an AI provider
