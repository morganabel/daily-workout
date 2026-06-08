## MODIFIED Requirements

### Requirement: Capabilities Discovery Endpoint

The server MUST expose a `/api/meta` endpoint that returns auth capabilities, protocol version, and runtime feature flags including billing capability hints for upgrade UX gating. This endpoint MUST be accessible without authentication so clients can detect backend capabilities before attempting auth or rendering upgrade surfaces. The response schema (`MetaResponse`) MUST be exported from `@workout-agent-ce/shared` for type-safe client consumption, and billing fields MUST be optional so older servers and clients remain backward compatible.

#### Scenario: Client discovers auth and billing capabilities

- **WHEN** a client sends a GET request to `/api/meta`
- **THEN** the server returns JSON with `protocolVersion`, `auth.enabled`, `auth.methods`, `edition`, and billing capability fields (`billing.enabled`, `billing.showUpgradeUi`, `billing.purchaseMethod`, `billing.allowByok`) when billing is configured

#### Scenario: Meta endpoint accessible without auth

- **GIVEN** a request to `/api/meta` with no authorization header
- **WHEN** the server processes the request
- **THEN** it returns the capabilities response (no 401)

#### Scenario: Response type is shared

- **GIVEN** the mobile app imports `MetaResponse` from `@workout-agent-ce/shared`
- **WHEN** it fetches `/api/meta`
- **THEN** the response can be type-safely consumed as `MetaResponse`, including optional billing fields

#### Scenario: CE/self-host advertises billing-disabled behavior

- **GIVEN** the backend is CE/self-host with no billing overlay
- **WHEN** a client fetches `/api/meta`
- **THEN** the response indicates billing is disabled (explicitly or by omitted optional billing fields) so the client does not show upgrade/paywall UI

#### Scenario: Hosted billing advertises upgrade path

- **GIVEN** hosted billing is enabled for the backend
- **WHEN** a client fetches `/api/meta`
- **THEN** the response indicates upgrade UX is available (`billing.enabled=true`, `billing.showUpgradeUi=true`, `billing.purchaseMethod='iap'`)
