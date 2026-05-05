# user-profile Specification

## Purpose
TBD - created by archiving change add-user-profile-onboarding. Update Purpose after archive.
## Requirements
### Requirement: User Profile Storage
The app MUST persist user profile data locally in the WatermelonDB `User.preferences` field as a JSON string. Profile data MUST include existing equipment, experience level, goals, injuries, style, focus, and avoid-list preferences, and MAY include onboarding answers, setup state, and a training blueprint used for starter-week planned slots. Existing preference JSON without training-blueprint fields MUST remain valid.

#### Scenario: Save profile data
- **GIVEN** the user is on the Profile settings screen
- **WHEN** they select equipment and experience level and tap Save
- **THEN** the data is persisted to the local database and available on next app launch

#### Scenario: Load profile data
- **GIVEN** the user has previously saved their profile
- **WHEN** they open the Profile settings screen
- **THEN** the form is pre-populated with their saved values

#### Scenario: Save training blueprint data
- **WHEN** a user accepts or adjusts the recommended starter week from onboarding
- **THEN** the accepted training blueprint, onboarding answer summary, inferred rhythm, default duration assumptions, equipment/location assumptions, and setup status are persisted in local preferences

#### Scenario: Existing preferences remain valid
- **GIVEN** a user has preferences saved before training blueprints exist
- **WHEN** the app parses those preferences
- **THEN** parsing succeeds and missing blueprint fields are treated as absent rather than invalid

### Requirement: Profile Configuration UI
The app MUST provide a settings interface where users can configure their available equipment, experience level, primary goal, injuries or constraints, and accepted training blueprint. The blueprint editing surface MUST be outside the default first-run onboarding path so advanced structure controls do not block new users.

#### Scenario: Equipment selection
- **GIVEN** the user is on the Profile screen
- **WHEN** they tap equipment options
- **THEN** they can select multiple items from a predefined list (Bodyweight, Dumbbells, Barbell, Kettlebells, Pull-up Bar, Resistance Bands, etc.)

#### Scenario: Experience level selection
- **GIVEN** the user is on the Profile screen
- **WHEN** they tap the experience level picker
- **THEN** they can choose from Beginner, Intermediate, or Advanced

#### Scenario: Plan settings edit blueprint
- **GIVEN** the user has accepted a recommended training blueprint
- **WHEN** they open Profile or Plan Settings
- **THEN** they can adjust the template, inferred rhythm, slot types, duration assumptions, or equipment/location assumptions without re-running onboarding

### Requirement: Real Generation Context
The workout generation flow MUST use the user's actual profile data instead of mock data when building the `GenerationContext` sent to the AI. Quick Action overrides take precedence over profile defaults for a single generation. Archived workouts MUST be excluded from `recentSessions` and any other history passed to the model.

#### Scenario: Generate with real profile
- **GIVEN** the user has configured their profile with "Dumbbells, Pull-up Bar" and "Intermediate"
- **WHEN** they generate a workout without any quick action overrides
- **THEN** the API request includes their real equipment and experience level (not hardcoded mock values)

#### Scenario: Quick action overrides profile equipment
- **GIVEN** the user has configured their profile with "Dumbbells, Pull-up Bar"
- **WHEN** they set the Equipment quick action to "Bodyweight" and generate a workout
- **THEN** the API request uses "Bodyweight" (the override) instead of their profile equipment

#### Scenario: Quick action reset falls back to profile
- **GIVEN** the user has configured their profile with "Dumbbells, Pull-up Bar"
- **AND** they previously set an Equipment quick action override
- **WHEN** they reset the quick actions and generate a workout
- **THEN** the API request uses their profile equipment "Dumbbells, Pull-up Bar"

#### Scenario: Include recent history
- **GIVEN** the user has completed workouts in the past that are not archived
- **WHEN** they generate a new workout
- **THEN** the `recentSessions` field includes their last 3-5 completed, non-archived sessions and excludes any sessions that have been archived or deleted

#### Scenario: Ignore archived history
- **GIVEN** the user has archived one or more past workouts
- **WHEN** they generate a new workout
- **THEN** the `GenerationContext` and any human-readable history sent to the AI omit those archived sessions entirely

### Requirement: Onboarding Prompt
The app MUST prompt new users to complete template-based onboarding when they have not configured or explicitly skipped profile setup. The prompt MUST lead to the guided onboarding flow rather than only to the full Profile settings screen.

#### Scenario: Show onboarding prompt
- **GIVEN** the user has not configured profile setup and has not skipped onboarding
- **WHEN** they view the Home Screen or first-run launch flow completes
- **THEN** the app offers template-based setup for better starter-week planning

#### Scenario: Skip suppresses repeated prompt
- **GIVEN** the user skips onboarding
- **WHEN** they return to Home
- **THEN** the app does not repeatedly show a blocking onboarding prompt
