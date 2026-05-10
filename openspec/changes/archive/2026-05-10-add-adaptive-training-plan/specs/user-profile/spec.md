## ADDED Requirements

### Requirement: Adaptive Plan Preferences Persistence
The system MUST persist the accepted adaptive training plan and its user-editable preferences locally with the user profile. Persisted data MUST include the active plan id, source template, blocks, target ranges, typical week preferences, recommendation settings, and updated timestamp.

#### Scenario: Profile stores accepted adaptive plan
- **WHEN** a user accepts an adaptive plan during onboarding or Plan Settings
- **THEN** the user profile stores the adaptive plan so Home and generation can use it later

#### Scenario: Existing preferences parse without adaptive plan
- **WHEN** an existing user profile has no adaptive plan fields
- **THEN** the profile parser keeps using default or existing starter behavior without data loss

### Requirement: Local-First Plan Editing
The system MUST allow adaptive plan settings to be edited locally without requiring hosted account features, sync, or an AI provider key.

#### Scenario: CE user edits target ranges
- **WHEN** a CE user changes lift or cardio target ranges in Plan Settings
- **THEN** the app saves those changes locally without invoking hosted billing, quota, or provider flows

#### Scenario: Invalid ranges are rejected
- **WHEN** a user attempts to save a target range whose minimum exceeds its maximum
- **THEN** the profile update is rejected with a validation error and the previous valid plan remains intact
