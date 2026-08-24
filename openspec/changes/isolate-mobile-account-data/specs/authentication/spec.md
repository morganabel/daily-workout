## ADDED Requirements

### Requirement: Authoritative Mobile Auth Resolution

The mobile app MUST resolve backend auth capability, session validity, and local data ownership explicitly. Capability state MUST distinguish `unknown`, `disabled`, and `enabled`. Session state MUST distinguish Better Auth validation from `not-required` auth-disabled mode, and repository access MUST be gated by explicit principal resolution rather than session state alone. The client MUST validate `/api/meta` with the shared response schema; timeout, transport failure, 5xx, backend auth initialization failure, or malformed payload MUST remain `unknown` and MUST NOT be treated as auth-disabled. `/api/ready` MUST NOT replace capability discovery. When auth is enabled, stored credentials MUST be validated with the backend session endpoint before the app reports an authenticated session or derives a principal.

The resolved mobile principal MUST bind the canonical backend identity and verified Better Auth `userId` to an opaque install-local storage scope, regardless of deployment mode. Self-hosted auth-disabled stub mode MUST instead bind that backend identity and a stable per-install ID; hosted mode MUST NOT use stub ownership. Cookies, bearer tokens, rotating session `principalId`, deployment mode, and edition MUST NOT be used as local data ownership identifiers.

Canonical backend identity MUST include normalized scheme, lowercase host, effective port, and normalized base path. It MUST ignore query, fragment, and trailing slash differences while keeping HTTP/HTTPS and distinct base paths separate.

#### Scenario: Capability request is unavailable

- **GIVEN** the app has no previously verified scope for the current backend
- **WHEN** `/api/meta` times out, is unreachable, returns 5xx, or fails shared-schema validation
- **THEN** capability state remains `unknown`, no stub principal is invented, and principal-owned local data remains unmounted

#### Scenario: Stored cookie requires validation

- **GIVEN** SecureStore contains a Better Auth cookie for the current backend
- **WHEN** the app starts and the session endpoint reports no valid session
- **THEN** the app resolves `unauthenticated`, does not expose a principal, and shows Launch

#### Scenario: Verified account resolves stable ownership

- **GIVEN** `/api/meta` reports auth enabled
- **AND** the session endpoint returns a valid stable account ID
- **WHEN** auth resolution completes
- **THEN** the app exposes a principal whose data scope combines that account ID with the canonical backend and does not include credential material

#### Scenario: Auth-disabled mode resolves install ownership

- **GIVEN** `/api/meta` authoritatively reports auth disabled
- **WHEN** auth resolution completes
- **THEN** session state becomes `not-required` and the app exposes a live stub principal scoped by the canonical backend and a stable per-install ID

#### Scenario: Self-hosted Better Auth resolves account ownership

- **GIVEN** a self-hosted backend reports auth enabled
- **AND** a verified session returns stable `userId`
- **WHEN** auth resolution completes
- **THEN** the app uses that `userId` exactly as hosted Better Auth would and does not include deployment mode in the data scope

#### Scenario: Anonymous account transitions to email

- **GIVEN** a verified Better Auth anonymous account already owns a mobile data scope
- **WHEN** Better Auth transitions anonymous A to authenticated B and the B-authenticated server endpoint proves that exact transition completed
- **THEN** the app atomically replaces A's binding with B's binding to the same opaque scope and does not copy or reset local data

#### Scenario: Sequential sign-in has no transition proof

- **GIVEN** anonymous A owns a mobile data scope
- **WHEN** authenticated B becomes current without a matching completed A-to-B server transition
- **THEN** B does not inherit A's scope and resolves its own opaque storage binding

#### Scenario: Equivalent backend URLs are canonicalized

- **WHEN** backend URLs differ only by host casing, query, fragment, or trailing slash
- **THEN** they resolve the same backend identity

#### Scenario: Distinct backend origins or paths stay isolated

- **WHEN** backend URLs differ by scheme, effective port, or normalized base path
- **THEN** they resolve different backend identities and cannot share a mobile data scope

#### Scenario: Previously verified scope opens offline

- **GIVEN** the current backend and principal were successfully verified before
- **AND** no explicit sign-out or unauthorized response invalidated them
- **WHEN** the backend is temporarily unreachable
- **THEN** the app MAY expose an explicit cached-offline principal and reopen that exact scope for local-only use while session state remains unavailable and networked actions remain disabled

### Requirement: Centralized Mobile Unauthorized Recovery

The mobile app MUST process `401 UNAUTHORIZED` from protected API endpoints through one idempotent root transition. That transition MUST invalidate the active and cached principal, unmount principal-owned data and credentials, reset billing identity state, and reset navigation to Launch. Individual screens and hooks MUST NOT implement conflicting unauthorized navigation or retry policies.

#### Scenario: Protected request returns unauthorized

- **GIVEN** a resolved authenticated principal is active
- **WHEN** any protected API request returns `401 UNAUTHORIZED`
- **THEN** the app invalidates the principal, unmounts its data scope, and resets navigation to Launch

#### Scenario: Concurrent requests return unauthorized

- **GIVEN** several protected requests are in flight for one principal
- **WHEN** more than one returns `401 UNAUTHORIZED`
- **THEN** the root unauthorized transition runs once and all callers receive their typed error without repeated navigation resets

#### Scenario: User signs out

- **GIVEN** a principal-owned data scope is mounted
- **WHEN** the user explicitly signs out
- **THEN** the app performs the same principal teardown before another account can authenticate

## MODIFIED Requirements

### Requirement: Mobile Launch Gate

The mobile app MUST show Launch when it has no live verified principal and no eligible cached-offline principal for the canonical backend. It MUST route directly to Home only after live auth resolution or an explicit cached-offline resolution. A stored credential alone MUST NOT satisfy the gate.

While first-time capability is `unknown`, Launch MAY render a connecting state, but actions that assume enabled or disabled auth, including Explore, sign-in, or stub entry, MUST remain unavailable. When Better Auth is enabled, Explore MAY explicitly create an anonymous session. When self-hosted auth-disabled mode is authoritatively known, the app MAY create the stable install-scoped stub principal unless that backend is `reset-held`. Clearing a reset hold and creating a fresh local scope requires an explicit user action.

#### Scenario: Returning live-verified user skips Launch

- **GIVEN** the current canonical backend has a session validated during this launch
- **WHEN** auth resolution completes
- **THEN** the app mounts that principal's scope and routes to Home

#### Scenario: Never-verified capability remains unknown

- **GIVEN** the app has no eligible cached scope for the current backend
- **WHEN** capability discovery is unavailable
- **THEN** Launch remains in a connecting state, no auth-mode action is enabled, and no principal-owned data is mounted

#### Scenario: Eligible cached scope opens locally

- **GIVEN** the exact canonical backend and principal were verified previously and were not invalidated
- **WHEN** the backend is temporarily unavailable
- **THEN** the app may route to local-only Home with cached-offline resolution while all networked actions remain disabled

#### Scenario: Unauthorized response resets the gate

- **GIVEN** a live principal is active
- **WHEN** the centralized protected-request handler receives `401 UNAUTHORIZED`
- **THEN** it invalidates live and cached resolution, unmounts the data scope, and resets navigation to Launch once

#### Scenario: Reset auth-disabled scope remains held

- **GIVEN** an auth-disabled backend's active local scope was reset
- **WHEN** capability discovery again reports auth disabled
- **THEN** the app remains on Launch in `reset-held` state until the user explicitly chooses to start a fresh local scope

### Requirement: Non-Blocking Capability Discovery (Mobile)

The mobile app MUST render a responsive initial shell while `/api/meta` is slow or unavailable, but it MUST NOT use a build-time/default auth assumption to create a principal or enable auth-mode-specific actions. It MUST parse `/api/meta` with the shared schema and distinguish `unknown`, `disabled`, and `enabled` capability states.

A timeout, network failure, 5xx, auth-context initialization failure, or malformed payload MUST leave capability `unknown`. `/api/ready` MUST NOT be used as a capability substitute. Previously verified cached-offline access MAY coexist with unknown live capability only through the explicit cached-offline state.

#### Scenario: Meta is slow on first use

- **GIVEN** the canonical backend has never produced a verified principal on this install
- **WHEN** `/api/meta` is slow or unreachable
- **THEN** Launch remains responsive but Explore, sign-in, and stub entry remain disabled and no local data scope mounts

#### Scenario: Meta payload is malformed

- **WHEN** `/api/meta` returns a payload that fails the shared response schema
- **THEN** capability remains `unknown` rather than falling back to auth-disabled mode

#### Scenario: Live capability recovers

- **GIVEN** the app is displaying a connecting or cached-offline state
- **WHEN** a valid `/api/meta` response and any required session validation complete
- **THEN** the app transitions to the matching live auth state without changing the stable data scope for the same user

### Requirement: Mobile Session Persistence with Backend Isolation

The mobile app MUST persist session credentials securely across restarts. One validated canonical backend descriptor MUST drive the request base URL, ownership `backendId`, and Better Auth `storagePrefix`. It MUST normalize scheme, lowercase host, effective port, and base path; treat explicit and implicit default ports as equal; ignore query, fragment, and trailing slash differences; and reject invalid, non-HTTP(S), or userinfo-bearing URLs.

Session credentials for different canonical backends MUST remain isolated. The first release using the canonical descriptor MUST delete legacy host/port-only auth storage keys through an idempotent marker and MUST NOT copy or reinterpret them as verified credentials.

#### Scenario: Session survives app restart

- **GIVEN** a verified Better Auth session is stored under the canonical backend prefix
- **WHEN** the app restarts and validates that session
- **THEN** the same stable `userId` and data scope are restored

#### Scenario: Equivalent default-port URLs share a prefix

- **WHEN** the app compares `https://api.example.com/base/` and `https://API.example.com:443/base`
- **THEN** both produce the same request base, backend ID, and auth storage prefix

#### Scenario: Scheme or base path differs

- **WHEN** two backend URLs differ by scheme, effective port, or normalized base path
- **THEN** their auth credentials and principal-owned data use different prefixes and scopes

#### Scenario: Backend URL contains userinfo

- **WHEN** configuration supplies a backend URL containing embedded username or password information
- **THEN** backend validation rejects it without storing or logging the credential-bearing URL

#### Scenario: Legacy auth key exists

- **GIVEN** SecureStore contains a host/port-only session key from the pre-change client
- **WHEN** canonical auth-storage cleanup runs
- **THEN** the legacy key is deleted and cannot authenticate or seed a canonical principal

#### Scenario: Session is cleared on logout or scope reset

- **GIVEN** a live or cached-offline principal exists
- **WHEN** the user signs out or resets the active scope
- **THEN** the app invalidates cached-offline eligibility, enters `reset-held` for reset, and clears that scope's session state before another principal can mount
