# user-profile Specification

## Purpose
TBD - created by archiving change add-user-profile-onboarding. Update Purpose after archive.
## Requirements
### Requirement: User Profile Storage
The app MUST persist user profile data (equipment, experience level, goals, injuries) locally in the WatermelonDB `User.preferences` field as a JSON string.

#### Scenario: Save profile data
- **GIVEN** the user is on the Profile settings screen
- **WHEN** they select equipment and experience level and tap Save
- **THEN** the data is persisted to the local database and available on next app launch

#### Scenario: Load profile data
- **GIVEN** the user has previously saved their profile
- **WHEN** they open the Profile settings screen
- **THEN** the form is pre-populated with their saved values

### Requirement: Profile Configuration UI
The app MUST provide a settings interface where users can configure their available equipment, experience level, primary goal, and any injuries or constraints.

#### Scenario: Equipment selection
- **GIVEN** the user is on the Profile screen
- **WHEN** they tap equipment options
- **THEN** they can select multiple items from a predefined list (Bodyweight, Dumbbells, Barbell, Kettlebells, Pull-up Bar, Resistance Bands, etc.)

#### Scenario: Experience level selection
- **GIVEN** the user is on the Profile screen
- **WHEN** they tap the experience level picker
- **THEN** they can choose from Beginner, Intermediate, or Advanced

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
The app MUST prompt new users to configure their profile if they have not done so.

#### Scenario: Show onboarding banner
- **GIVEN** the user has not configured their profile (preferences is empty or default)
- **WHEN** they view the Home Screen
- **THEN** a banner appears suggesting they set up their profile for better workouts

#### Scenario: Navigate to profile
- **GIVEN** the onboarding banner is visible
- **WHEN** the user taps it
- **THEN** they are navigated to the Profile settings screen

