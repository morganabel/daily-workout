## MODIFIED Requirements

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
