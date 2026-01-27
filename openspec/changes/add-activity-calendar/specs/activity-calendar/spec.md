## ADDED Requirements

### Requirement: Calendar Entry Point

The mobile app MUST provide an Activity Calendar view that is reachable from the primary navigation and is usable as the default way to browse workout history.

#### Scenario: Open calendar from navigation

- **GIVEN** the user opens the History area of the app
- **WHEN** the Activity Calendar view is available
- **THEN** the user can reach a month-based calendar view without needing to search or change settings

### Requirement: Month Grid Shows Activity Markers

The Activity Calendar month grid MUST render day cells that reflect whether the user has completed sessions or planned events on that date.

#### Scenario: Day markers reflect activity

- **GIVEN** the user has two completed workouts on a date and one planned event on another date
- **WHEN** the month grid renders
- **THEN** each of those dates displays a visual marker indicating the presence of items on that day

### Requirement: Day Agenda Lists Completed And Planned Items

The Activity Calendar MUST provide a day-level agenda view that lists all items for the selected date, including completed workout sessions and planned events.

#### Scenario: Selecting a day shows its agenda

- **GIVEN** the user taps a date cell in the month grid
- **THEN** the app shows a day agenda listing that date's items ordered by time (timed items first in chronological order, then all-day items)

### Requirement: Planned Event Data Model

The system MUST represent planned events with a stable, extensible contract so calendar UI and generation can use them while allowing future expansion without breaking changes.

#### Scenario: Minimal planned event fields

- **GIVEN** a planned event is created
- **THEN** it includes a stable `id` (UUIDv7), a user-facing `title`, a `kind` string, and a calendar bucketing key `localDate` (`YYYY-MM-DD`)

#### Scenario: Timezone context preserved

- **GIVEN** a planned event is created
- **THEN** it stores the user's timezone at creation time (`createdAtTimezone`) to allow future re-interpretation if needed

#### Scenario: Optional timing and all-day support

- **GIVEN** a planned event is created as all-day
- **THEN** it can be represented with `localDate` plus an `allDay` flag (and MAY omit an explicit `startsAt` time)
- **GIVEN** a planned event is created with a specific time
- **THEN** it includes `startsAt` (and optionally `endsAt` or `durationMinutes`) and appears at the expected position in the day agenda ordering

#### Scenario: Extensible fields via metadata/details

- **GIVEN** a planned event includes kind-specific fields (for example hike distance/elevation)
- **WHEN** the event is stored and later edited
- **THEN** those fields are preserved via explicit extension points such as `details` and/or `metadata` rather than requiring new top-level schema fields

#### Scenario: Soft delete for future sync compatibility

- **GIVEN** a planned event is deleted by the user
- **WHEN** the deletion is processed
- **THEN** the event is archived (via `archivedAt` timestamp) rather than permanently deleted, to support future sync scenarios

### Requirement: Canonical Event Kinds With Flexibility

The system MUST support a set of canonical event kinds that cover common use cases while allowing arbitrary kind strings for flexibility.

#### Scenario: Canonical kinds have UI treatment

- **GIVEN** the app defines canonical kinds: `workout`, `hike`, `run`, `sport`, `rest`, `travel`, `other`
- **WHEN** a planned event uses a canonical kind
- **THEN** the UI displays an appropriate icon and label for that kind

#### Scenario: Unknown kinds fall back gracefully

- **GIVEN** a planned event uses a non-canonical kind string
- **WHEN** the calendar renders that event
- **THEN** it displays the event using the `other` kind treatment (generic icon, kind string as label)

### Requirement: Planned Workouts Are Distinguished From Life Events

The system MUST treat planned events with `kind: 'workout'` as app-owned planned workouts, distinct from external life events (hikes, travel, etc.).

#### Scenario: Planned workout offers generation action

- **GIVEN** a planned event with `kind: 'workout'` exists on a future date
- **WHEN** the user views that event in the day agenda
- **THEN** the app offers an action to generate a workout for that date

#### Scenario: Planned workout can link to completed session

- **GIVEN** the user completes or logs a workout on a date with a planned workout event
- **WHEN** the session is saved
- **THEN** the planned workout event MAY be linked to the session via `linkedEntity`

#### Scenario: Life events remain as external constraints

- **GIVEN** a planned event with a non-workout kind (e.g., `hike`, `travel`)
- **THEN** the app treats it as an external constraint visible on the calendar but does not offer workout-specific actions

### Requirement: Planned Events Included In Generation Context

When the user generates a workout, the mobile app MUST include relevant planned event summaries in the generation request so the LLM can consider upcoming activities when planning the workout.

#### Scenario: Upcoming events included in generation request

- **GIVEN** the user has at least one planned event in the next 7 days
- **WHEN** they generate a workout
- **THEN** the request includes a bounded list of `upcomingEvents` summaries derived from planned events

#### Scenario: Generation considers upcoming events

- **GIVEN** the user has a hike planned for Saturday
- **WHEN** they generate a workout for Friday
- **THEN** the LLM receives the hike as context and MAY adjust the workout accordingly (e.g., avoid heavy leg work)

### Requirement: Quick Log From Calendar

From the Activity Calendar, the user MUST be able to create a completed manual activity for a chosen date with minimal input.

#### Scenario: Quick log defaults to selected date

- **GIVEN** the user has selected a date in the calendar
- **WHEN** they choose `Quick log` and submit a valid entry
- **THEN** the created log is stored as a completed manual session whose `completedAt` defaults to the selected date with the current wall-clock time (or 12:00 PM if the date is not today), and the calendar updates to show that day as having activity

### Requirement: Planned Events CRUD

The Activity Calendar MUST allow the user to create, edit, and delete planned events that appear on the calendar.

#### Scenario: Create a planned event

- **GIVEN** the user opens the calendar on any date
- **WHEN** they create a planned event with a kind, title, and optional duration/notes
- **THEN** the event is stored locally and appears on that date in the month grid and day agenda

#### Scenario: Edit or delete a planned event

- **GIVEN** a planned event exists on a date
- **WHEN** the user edits or deletes it from the day agenda
- **THEN** the calendar reflects the updated event (or removes it) without requiring an app restart

#### Scenario: Past planned events remain visible

- **GIVEN** a planned event's date has passed
- **WHEN** the user views that date in the calendar
- **THEN** the event remains visible in the day agenda (it does not auto-archive or change state)

### Requirement: Offline-First Calendar Behavior

The Activity Calendar MUST remain usable offline for browsing history, viewing planned events, and creating/editing planned events and manual logs.

#### Scenario: Offline planned events and quick logs

- **GIVEN** the device is offline
- **WHEN** the user creates a planned event or a quick log from the calendar
- **THEN** the app records the data locally and updates the calendar UI without attempting a network request
