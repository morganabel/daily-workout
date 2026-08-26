## MODIFIED Requirements

### Requirement: User Registration with Account Linking

Users MUST be able to register using email and password or Google OAuth when that provider is configured. If the user is currently signed in anonymously, the system SHALL use Better Auth 1.7's standard anonymous account transition to create or resolve a non-anonymous user B and invoke application ownership migration from anonymous user A. The resulting `userId` MAY differ from A; continuity MUST come from the verified account-transition contract rather than custom reassignment of Better Auth credentials or sessions.

#### Scenario: Successful registration

- **WHEN** a user submits a valid email and password to the registration endpoint
- **THEN** Better Auth creates or resolves the credentialed user, generates a bearer session, and returns session credentials

#### Scenario: Anonymous-to-email transition migrates ownership

- **GIVEN** anonymous user A has a verified session
- **WHEN** they register a new email/password user B
- **THEN** Better Auth invokes the account-transition callback from A to B
- **AND** the refreshed session identifies non-anonymous B
- **AND** eligible application data remains available through B

#### Scenario: Anonymous-to-Google transition uses provider profile

- **GIVEN** anonymous user A has a verified session
- **AND** Google OAuth is configured
- **WHEN** they complete Google sign-in for application-empty user B
- **THEN** Better Auth invokes the account-transition callback from A to B
- **AND** Better Auth persists B's verified Google account, email, name, and image
- **AND** the application does not parse the identity token to rewrite A

#### Scenario: Transition callback failure is not success

- **GIVEN** an anonymous user is transitioning to a credentialed user
- **WHEN** application ownership migration fails
- **THEN** eligible application records remain owned by A
- **AND** A is not treated as successfully deleted or transitioned
- **AND** the client reports a recoverable authentication failure

#### Scenario: Existing account with state replaces anonymous use

- **GIVEN** A is anonymous and credentialed B already owns Workout Agent application or billing state
- **WHEN** A attempts to sign in to B
- **THEN** automatic linking does not merge A into B
- **AND** the client discards A's anonymous state and signs in to B independently without additional recovery UI

#### Scenario: Duplicate email rejected

- **WHEN** a user submits an email that is already registered and no supported existing-account transition is completed
- **THEN** the system returns an error indicating the email is already registered without creating a duplicate account

#### Scenario: Incomplete Google OAuth is not reported as success

- **GIVEN** a user starts Google OAuth
- **WHEN** they cancel the browser, the callback lacks trusted anonymous context, or refresh does not establish the expected non-anonymous session and transition
- **THEN** the mobile client reports that sign-in was not completed
- **AND** it does not navigate as though authentication succeeded

#### Scenario: Invalid email format rejected

- **WHEN** a user submits an improperly formatted email address
- **THEN** the system returns a validation error without creating an account
