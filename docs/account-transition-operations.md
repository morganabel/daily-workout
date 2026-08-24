# Account transition operations

Anonymous-to-authenticated ownership transition is part of Better Auth mode and
is not independently configurable. Better Auth deployments advertise
`auth.accountTransitionAvailable=true`; auth-disabled stub deployments advertise
it as false.

## Rollout order

1. Apply the additive PostgreSQL migration, including `account.issuer` and
   `account_transition`, before deploying code that requires it.
2. Deploy server code with the write guards, status handling, diagnostics, and
   Better Auth transition callback together.
3. Deploy a compatible mobile build that verifies B and the completed A-to-B
   ledger before handing off local state. RevenueCat remains on the stable
   server-generated identity C; the transition does not log in as A or B.
4. Verify `/api/meta` advertises `auth.accountTransitionAvailable=true` and
   monitor the aggregate transition diagnostics.

## Rollback

Rollback requires deploying server code that rejects new transition entry
points; there is no environment toggle. Do not roll back the additive schema or
move completed ownership from B back to A.

Completed transitions remain canonical on B: application rows, RevenueCat
mapping and entitlement projection, and the mobile opaque storage binding stay
owned by B. A writes remain frozen by the transition ledger. Retrying a
completed A-to-B callback is idempotent and may finish Better Auth cleanup.

## Diagnostics

`getAccountTransitionDiagnostics` returns aggregate-only counts for transition
state, redacted failure class, retried records, and completed transitions whose
anonymous Better Auth user remains beyond the cleanup threshold. It does not
return user IDs, emails, credentials, cookies, OAuth tokens, RevenueCat IDs, or
BYOK values.

Investigate non-zero `completedButNotCleanedUp` counts before re-enabling the
feature. Supported recovery is retrying the same A-to-B flow or cleaning up A
through Better Auth; never reverse B's application ownership automatically.
