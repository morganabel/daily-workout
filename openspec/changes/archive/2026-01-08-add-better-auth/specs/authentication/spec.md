## ADDED Requirements

### Requirement: Capabilities Discovery Endpoint
The server MUST expose a `/api/meta` endpoint that returns auth capabilities, protocol version, and feature flags. This endpoint MUST be accessible without authentication so clients can detect backend capabilities before attempting auth. The response schema (`MetaResponse`) MUST be exported from `@leveza/shared` for type-safe client consumption.

#### Scenario: Client discovers auth capabilities
- **WHEN** a client sends a GET request to `/api/meta`
- **THEN** the server returns JSON with `protocolVersion`, `auth.enabled`, `auth.methods`, and `edition`

#### Scenario: Meta endpoint accessible without auth
- **GIVEN** a request to `/api/meta` with no authorization header
- **WHEN** the server processes the request
- **THEN** it returns the capabilities response (no 401)

#### Scenario: Response type is shared
- **GIVEN** the mobile app imports `MetaResponse` from `@leveza/shared`
- **WHEN** it fetches `/api/meta`
- **THEN** the response can be type-safely consumed as `MetaResponse`

### Requirement: Mobile Launch Gate
The mobile app MUST include a Launch (onboarding) screen that appears for brand new users or when the backend requires authentication and the app has no valid session.

- Returning users who already have a valid session MUST be routed directly to Home without seeing the Launch screen.
- The Launch screen MUST present clear actions to explore immediately (temporary session) or sign up/sign in.
- BYOK MAY be exposed as an advanced option, but it MUST NOT be a prominent/primary first-run requirement.

#### Scenario: Returning user skips Launch
- **GIVEN** the user has a valid persisted session for the current backend
- **WHEN** they open the app
- **THEN** the app navigates directly to Home without rendering the Launch screen

#### Scenario: Auth required and no session shows Launch
- **GIVEN** the backend requires authentication (`/api/meta` indicates `auth.enabled=true`)
- **AND** the app has no valid session for the current backend
- **WHEN** the user opens the app
- **THEN** the Launch screen is shown with Explore / Create account / Sign in options

#### Scenario: 401 redirects to Launch
- **GIVEN** the user triggers a protected action
- **AND** the server responds with `401 UNAUTHORIZED`
- **WHEN** the app receives the response
- **THEN** the app navigates to the Launch screen so the user can restore a session

### Requirement: Anonymous Session Bootstrap
When Better Auth is enabled, the system MUST support anonymous sign-in that creates a server-side principal without requiring the user to provide credentials. The mobile app SHALL initiate anonymous sign-in only when the user explicitly chooses to explore (for example, by tapping an `Explore` button on the Launch screen) and SHALL persist the resulting session securely.

#### Scenario: Explore creates an anonymous session
- **GIVEN** the Launch screen is visible and the app has no stored session
- **WHEN** the user taps `Explore`
- **THEN** the app obtains a session and subsequent API requests are authenticated (cookie preferred; bearer token acceptable)

#### Scenario: No session is created until user action
- **GIVEN** the app starts with no stored session
- **WHEN** the user has not tapped `Explore` and has not signed in
- **THEN** the app does not create an anonymous session implicitly

#### Scenario: Anonymous session survives app restart
- **GIVEN** the user has an active anonymous session
- **WHEN** they close and reopen the app
- **THEN** the session is restored from secure storage and API calls remain authenticated

### Requirement: Non-Blocking Capability Discovery (Mobile)
The mobile app MUST NOT block the initial UI while `/api/meta` is slow or unavailable.

- The app MUST have a build-time/default assumption for whether authentication is enabled (for example `EXPO_PUBLIC_AUTH_ENABLED=true|false`).
- While capabilities are unknown, the Launch screen MUST still render and allow the user to choose Explore or sign up/sign in.

#### Scenario: Meta is slow but onboarding remains usable
- **GIVEN** `/api/meta` is slow or temporarily unreachable
- **WHEN** the app starts
- **THEN** the Launch screen is shown (with a non-blocking "connecting" state) and the user can still choose `Explore` or sign up/sign in

### Requirement: User Registration with Account Linking
Users MUST be able to register using email and password. If the user is currently signed in anonymously, the system SHALL upgrade/link that anonymous principal to the provided credentials, preserving the same `userId` for metering/billing continuity.

#### Scenario: Successful registration
- **WHEN** a user submits a valid email and password to the registration endpoint
- **THEN** the system creates (or upgrades) a user record, generates a bearer session, and returns session credentials

#### Scenario: Anonymous-to-email upgrade preserves userId
- **GIVEN** an anonymous user with `userId=abc123`
- **WHEN** they register with email/password
- **THEN** the resulting account retains `userId=abc123` and all prior usage/metering data remains associated

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
- **THEN** the handler receives an `AuthResult` with `userId` (account identity) and `principalId` (device/session identity) and proceeds with the request

#### Scenario: Missing session denies access
- **GIVEN** a request has no bearer token
- **WHEN** the server validates the request via `AuthProvider.authenticate()`
- **THEN** it returns `null` and the handler responds with 401 UNAUTHORIZED

#### Scenario: Expired session denies access
- **GIVEN** a request includes an expired bearer session token
- **WHEN** the server validates the request
- **THEN** it returns 401 UNAUTHORIZED and the client must re-authenticate

### Requirement: Stable Principal Identity for Server-Side Storage
The `AuthResult` returned by `AuthProvider.authenticate()` MUST include both `userId` and `principalId`. These serve distinct purposes:
- `userId`: Stable account-level identity for billing, metering, and cross-device account data.
- `principalId`: Session/device-scoped identity for device-specific state (e.g., GenerationStore, last plan).

The `principalId` MUST NOT be the bearer token itself, as bearer tokens can rotate. The `principalId` SHOULD be derived from the session ID, making it unique per device/session.

#### Scenario: Principal ID remains stable across token refresh
- **GIVEN** a user's bearer token is refreshed on a specific device
- **WHEN** the server validates the new token
- **THEN** the `AuthResult.principalId` for that device remains unchanged and server-side state (e.g., `GenerationStore`) is accessible

#### Scenario: Principal ID is device-scoped
- **GIVEN** a user authenticates from multiple devices
- **WHEN** each device's session is validated
- **THEN** each device has a different `principalId` but the same `userId`

#### Scenario: User ID is account-scoped
- **GIVEN** a user authenticates from multiple devices
- **WHEN** each device's session is validated
- **THEN** all devices return the same `userId` for billing/metering purposes

### Requirement: No Identity from Arbitrary Headers
In Better Auth mode, user identity MUST come exclusively from validating the bearer session via `AuthProvider.authenticate()`. The server MUST NOT trust identity claims from arbitrary headers such as `x-user-id`, `x-plan-id`, or similar.

#### Scenario: x-user-id header ignored
- **GIVEN** a request includes `x-user-id: attacker-id` header and a valid bearer token for `userId=victim`
- **WHEN** the server processes the request
- **THEN** the handler receives `userId=victim` from the validated session, ignoring the header

#### Scenario: Missing bearer token not bypassed by headers
- **GIVEN** a request includes `x-user-id: some-id` but no bearer token
- **WHEN** the server validates the request
- **THEN** it returns 401 UNAUTHORIZED (header does not grant access)

### Requirement: Credential and Token Secrecy
The system MUST treat all authentication credentials and tokens as secrets. The following MUST NOT appear in logs or error responses: `Authorization` header value, request bodies for auth routes (email, password), session tokens, Better Auth secrets, and any `x-*-key` headers.

#### Scenario: Authorization header never logged
- **GIVEN** a request includes `Authorization: Bearer <token>`
- **WHEN** the server processes the request and emits structured logs
- **THEN** the logs do not contain the raw bearer token value

#### Scenario: Auth endpoint request bodies never logged
- **GIVEN** a POST to `/api/auth/sign-up/email` with email and password in the body
- **WHEN** the server processes the request
- **THEN** logs do not contain the email or password values

#### Scenario: Error responses exclude secrets
- **GIVEN** an auth request fails
- **WHEN** the server returns an error response
- **THEN** the response body does not include the submitted password or session tokens

#### Scenario: Client debug logs never include tokens
- **GIVEN** the mobile app is running with debug logging enabled
- **WHEN** it makes an authenticated API request
- **THEN** logs do not include the raw bearer token value (or other auth secrets)

### Requirement: Mobile Session Persistence with Backend Isolation
The mobile app MUST persist session credentials securely across app restarts using platform-appropriate secure storage. The `storagePrefix` MUST be derived from a canonical backend URL (for example a stable hash or normalized host+port string) to prevent session collisions when switching backends.

#### Scenario: Session survives app restart
- **GIVEN** a user is logged in and closes the app
- **WHEN** the user reopens the app
- **THEN** the session is restored from secure storage and the user remains authenticated

#### Scenario: Session cleared on logout
- **GIVEN** a user is logged in
- **WHEN** the user triggers logout
- **THEN** the session is cleared from secure storage and the user is redirected to sign-in

#### Scenario: Backend switch does not overwrite other sessions
- **GIVEN** a user has sessions stored for `https://api.example.com` and `https://localhost:3000`
- **WHEN** they switch from one backend to another
- **THEN** each backend's session is stored/retrieved independently (different `storagePrefix`)

### Requirement: Auth-Mode Selection Algorithm
The server MUST use a deterministic algorithm for auth-mode resolution: `AUTH_MODE = env.AUTH_MODE ?? (env.DATABASE_URL ? 'better-auth' : 'stub')`. This algorithm MUST be reusable by EE verbatim.

#### Scenario: Explicit AUTH_MODE takes precedence
- **GIVEN** `AUTH_MODE=stub` and `DATABASE_URL` is set
- **WHEN** the server resolves auth mode
- **THEN** it uses stub auth (explicit override wins)

#### Scenario: DATABASE_URL implies better-auth
- **GIVEN** `AUTH_MODE` is not set and `DATABASE_URL` is set
- **WHEN** the server resolves auth mode
- **THEN** it uses better-auth

#### Scenario: No DATABASE_URL implies stub
- **GIVEN** neither `AUTH_MODE` nor `DATABASE_URL` is set
- **WHEN** the server resolves auth mode
- **THEN** it uses stub auth

### Requirement: Fail-Closed Hosted Authentication
When `EDITION=HOSTED`, the server MUST NOT silently fall back to stub auth. If Better Auth is not properly configured (e.g., `DATABASE_URL` missing), the server MUST fail at startup with a clear error message.

#### Scenario: Hosted auth fails closed when misconfigured
- **GIVEN** the server is configured with `EDITION=HOSTED`
- **AND** `DATABASE_URL` is not set
- **WHEN** the server starts
- **THEN** it crashes with an error message indicating Better Auth configuration is required

#### Scenario: Hosted mode with valid config starts normally
- **GIVEN** `EDITION=HOSTED` and `DATABASE_URL` is properly configured
- **WHEN** the server starts
- **THEN** it initializes Better Auth and starts successfully

### Requirement: Backward-Compatible Stub Authentication (CE/dev)
The system MUST support stub authentication for CE/dev deployments without a database. When auth-mode resolves to `stub`, the server SHALL use `StubAuthProvider` which accepts any non-empty bearer token.

#### Scenario: Stub auth when no database
- **GIVEN** the server is running with auth-mode `stub`
- **WHEN** a request includes any non-empty bearer token
- **THEN** `StubAuthProvider` accepts the token and returns a stub user identity

#### Scenario: Real auth when database configured
- **GIVEN** the server is running with auth-mode `better-auth`
- **WHEN** a request is received
- **THEN** `BetterAuthProvider` validates the session against the database

### Requirement: No DB-Backed Auth in Edge Middleware
DB-backed session validation and quota lookup MUST NOT be performed in Next.js Edge middleware (`middleware.ts`). Auth and quota enforcement MUST happen in Node route handlers via `AuthProvider` and `UsagePolicy`.

#### Scenario: Auth validated in route handler
- **GIVEN** a protected API route receives a request
- **WHEN** authentication is performed
- **THEN** it happens in the Node runtime route handler, not Edge middleware

### Requirement: Package Export Conventions
Auth-related packages (`packages/server-db`, `packages/server-auth`) MUST export factory functions and MUST NOT have side effects at import time. This enables EE to initialize DB/auth at runtime.

#### Scenario: No side effects on import
- **GIVEN** an EE app imports `@leveza/server-db`
- **WHEN** the import statement executes
- **THEN** no database connections are opened until a factory function is called
