## MODIFIED Requirements
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

