## ADDED Requirements

### Requirement: Principal-Gated Mobile Data Scope

The mobile app MUST expose local repositories only while a resolved mobile principal is active. The data scope MUST be an opaque install-local identifier stored in a durable binding from canonical backend identity and stable subject ID. Canonical backend identity MUST contain normalized scheme, host, effective port, and base path while ignoring query, fragment, and trailing slash differences. Credential values, deployment mode, edition, rotating session identifiers, and raw subject IDs MUST NOT determine or reveal the scope identifier.

#### Scenario: Principal has not resolved

- **GIVEN** capability or session resolution is still unknown
- **WHEN** a screen or service requests a local repository
- **THEN** the repository is unavailable and no unscoped database is opened

#### Scenario: Principal resolves

- **GIVEN** a stable principal has been resolved for the current backend
- **WHEN** the mobile data provider mounts
- **THEN** it opens only that principal's database partition and provides repositories bound to it

#### Scenario: Principal changes

- **GIVEN** Account A's data scope is mounted
- **WHEN** the active principal changes to Account B
- **THEN** Account A's observers and repositories are disposed before Account B's scope is exposed

#### Scenario: Auth-disabled scope is reset

- **GIVEN** a self-hosted stub principal's active scope is mounted
- **WHEN** the user resets that scope
- **THEN** repositories unmount, the backend enters `reset-held`, and a clean stub scope is not created until explicit user re-entry

### Requirement: Account And Backend Partitioned SQLite Persistence

The mobile app MUST store each resolved principal's local records in a separate SQLite/WatermelonDB partition. All users, preferences, workouts, exercises, sets, planned events, coach actions, queries, subscriptions, generation context, and debug tools MUST operate through the active partition.

#### Scenario: Two accounts use one backend

- **GIVEN** Account A and Account B both use the same backend on one device
- **WHEN** each account creates local workouts and preferences
- **THEN** each account can read and mutate only its own partition

#### Scenario: Same account identifier appears on two backends

- **GIVEN** two different canonical backends return the same account ID
- **WHEN** the app connects to each backend
- **THEN** each backend receives a different data scope and their records never mix

#### Scenario: Debug tooling inspects data

- **GIVEN** mobile debug tooling is enabled
- **WHEN** it lists, seeds, or resets local records
- **THEN** the operation is bounded to the active data scope and does not enumerate another scope

### Requirement: Principal-Owned BYOK Credentials

The mobile app MUST namespace BYOK provider selection and API keys by `dataScopeId`. BYOK storage helpers MUST require an active scope, MUST NOT fall back to device-wide legacy entries, and MUST remove in-memory credentials before exposing a different scope.

#### Scenario: Account changes with a stored BYOK key

- **GIVEN** Account A stored an OpenAI or Gemini key
- **WHEN** the app signs into Account B
- **THEN** Account B cannot read or attach Account A's provider or key to an API request

#### Scenario: Account returns to its scope

- **GIVEN** Account A previously stored a BYOK key in its scope
- **WHEN** Account A is verified again on the same backend
- **THEN** the app MAY load Account A's retained key without exposing it to any other scope

#### Scenario: Active scope is reset

- **GIVEN** Account A is active and Account B also has retained local state
- **WHEN** the user resets Account A's local data
- **THEN** Account A's database and secure settings are removed while Account B's remain unchanged

### Requirement: Scoped Storage Has No Legacy Database Path

The principal-scoped storage implementation MUST start directly with per-principal databases. It MUST NOT detect, open, migrate, quarantine, copy, or delete a legacy unscoped database, and it MUST NOT add a database cleanup marker or compatibility path.

#### Scenario: Scoped database is opened

- **GIVEN** a principal resolves to storage scope S
- **WHEN** scoped-storage bootstrap runs
- **THEN** the app opens only S's database without inspecting any unscoped database

#### Scenario: No legacy database marker exists

- **WHEN** the app initializes scoped database storage
- **THEN** it does not read or write a marker for legacy database cleanup
