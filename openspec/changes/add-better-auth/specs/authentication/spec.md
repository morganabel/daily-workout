## ADDED Requirements

### Requirement: Anonymous Session Bootstrap
When Better Auth is enabled, the system MUST support anonymous sign-in that creates a server-side principal without user interaction. The mobile app SHALL perform anonymous sign-in on first run and persist the resulting bearer session securely.

#### Scenario: First-run anonymous sign-in
- **GIVEN** the mobile app has no stored session
- **WHEN** the app starts and the backend supports Better Auth
- **THEN** the app obtains a bearer session and subsequent API requests include `Authorization: Bearer <token>`

#### Scenario: Anonymous session survives app restart
- **GIVEN** the user has an active anonymous session
- **WHEN** they close and reopen the app
- **THEN** the session is restored from secure storage and API calls remain authenticated

### Requirement: User Registration
Users MUST be able to register using email and password. If the user is currently signed in anonymously, the system SHALL upgrade/link that anonymous principal to the provided credentials (so the underlying user identity remains stable) and return a valid bearer session.

#### Scenario: Successful registration
- **WHEN** a user submits a valid email and password to the registration endpoint
- **THEN** the system creates (or upgrades) a user record, generates a bearer session, and returns session credentials

#### Scenario: Duplicate email rejected
- **WHEN** a user submits an email that already exists in the system
- **THEN** the system returns an error indicating the email is already registered without creating a duplicate account

#### Scenario: Invalid email format rejected
- **WHEN** a user submits an improperly formatted email address
- **THEN** the system returns a validation error without creating an account

### Requirement: User Authentication
Users MUST be able to authenticate using their registered email and password. The system SHALL validate credentials and return a bearer session upon successful authentication.

#### Scenario: Valid credentials
- **WHEN** a user submits correct email and password to the login endpoint
- **THEN** the system validates the credentials and returns a valid bearer session

#### Scenario: Invalid credentials
- **WHEN** a user submits incorrect email or password
- **THEN** the system returns an authentication error without revealing which field was incorrect

### Requirement: Bearer-Based API Authorization
All protected API endpoints MUST validate a bearer token provided via `Authorization: Bearer <token>` before processing requests. The system SHALL use the `AuthProvider` interface to authenticate requests and extract user identity. Cookie-based auth MUST NOT be required for mobile/API clients.

#### Scenario: Valid session allows access
- **GIVEN** a request includes a valid bearer session token in the `Authorization` header
- **WHEN** the server validates the request via `AuthProvider.authenticate()`
- **THEN** the handler receives an `AuthResult` with `userId` and proceeds with the request

#### Scenario: Missing session denies access
- **GIVEN** a request has no bearer token
- **WHEN** the server validates the request via `AuthProvider.authenticate()`
- **THEN** it returns `null` and the handler responds with 401 UNAUTHORIZED

#### Scenario: Expired session denies access
- **GIVEN** a request includes an expired bearer session token
- **WHEN** the server validates the request
- **THEN** it returns 401 UNAUTHORIZED and the client must re-authenticate

### Requirement: Credential and Token Secrecy
The system MUST treat all authentication credentials and tokens as secrets and MUST NOT log or persist them. This includes bearer tokens (`Authorization`), any session/refresh tokens, and email/password fields. Error responses MUST NOT include these secrets.

#### Scenario: Authorization header never logged
- **GIVEN** a request includes `Authorization: Bearer <token>`
- **WHEN** the server processes the request and emits structured logs
- **THEN** the logs do not contain the raw bearer token value

#### Scenario: Client debug logs never include tokens
- **GIVEN** the mobile app is running with debug logging enabled
- **WHEN** it makes an authenticated API request
- **THEN** logs do not include the raw bearer token value (or other auth secrets)

### Requirement: Mobile Session Persistence
The mobile app MUST persist session credentials securely across app restarts using platform-appropriate secure storage.

#### Scenario: Session survives app restart
- **GIVEN** a user is logged in and closes the app
- **WHEN** the user reopens the app
- **THEN** the session is restored from secure storage and the user remains authenticated

#### Scenario: Session cleared on logout
- **GIVEN** a user is logged in
- **WHEN** the user triggers logout
- **THEN** the session is cleared from secure storage and the user is redirected to sign-in

### Requirement: Backward-Compatible Stub Authentication (CE/dev)
The system MUST support stub authentication for CE/dev deployments without a database. When Better Auth is not enabled (for example, `DATABASE_URL` is not configured), the server SHALL fall back to `StubAuthProvider`.

#### Scenario: Stub auth when no database
- **GIVEN** the server is running without `DATABASE_URL` configured
- **WHEN** a request includes any non-empty bearer token
- **THEN** `StubAuthProvider` accepts the token and returns a stub user identity

#### Scenario: Real auth when database configured
- **GIVEN** the server is running with `DATABASE_URL` configured
- **WHEN** a request is received
- **THEN** `BetterAuthProvider` validates the session against the database

#### Scenario: Hosted auth fails closed when misconfigured
- **GIVEN** the server is configured with `EDITION=HOSTED`
- **AND** Better Auth is not enabled/configured
- **WHEN** the server starts or receives an authenticated request
- **THEN** it fails closed (does not accept stub auth) and requires Better Auth to be configured
