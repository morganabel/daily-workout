## ADDED Requirements

### Requirement: AI Feature Preference
The user profile MUST persist whether the user allows AI-powered workout creation. Existing profiles without the preference MUST remain valid and default to AI-enabled catalog-aware automatic workout creation.

#### Scenario: Existing profile defaults to auto mode
- **WHEN** an existing user profile has no AI feature preference
- **THEN** the app treats workout creation as AI-enabled catalog-aware automatic mode

#### Scenario: User opts out of AI features
- **WHEN** a user disables AI-powered workout creation in settings or onboarding
- **THEN** future workout creation requests use library mode and do not prompt for BYOK, upgrade, or provider setup for normal workout creation

#### Scenario: User re-enables AI features
- **WHEN** a user re-enables AI-powered workout creation
- **THEN** future workout creation requests use catalog-aware automatic mode and may invoke AI when catalog fit is not sufficient
