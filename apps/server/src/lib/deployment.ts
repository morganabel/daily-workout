/**
 * Deployment mode + provider selection for the server.
 *
 * A single runtime switch (DEPLOYMENT_MODE) selects how the one server app
 * behaves:
 * - `self-hosted` (default): permissive / no-op providers; billing disabled.
 * - `hosted`: real providers (RevenueCat entitlement billing) when enabled.
 *
 * This module is the single source of truth for mode / provider gating so that
 * route handlers and services depend on these helpers instead of re-reading env
 * (and re-implementing the gating) in each place.
 *
 * `EDITION` and `HOSTED_BILLING_ENABLED` are honored as backward-compatible
 * aliases during the transition away from the edition switch.
 */

export type DeploymentMode = 'self-hosted' | 'hosted';
export type BillingProvider = 'none' | 'revenuecat';

/**
 * Resolves the deployment mode.
 *
 * Precedence:
 * 1. `DEPLOYMENT_MODE` if set (`self-hosted` | `hosted`).
 * 2. Backward-compat: `EDITION=HOSTED` → `hosted`; anything else → `self-hosted`.
 *
 * @throws Error if DEPLOYMENT_MODE is set to an unrecognized value.
 */
export function getDeploymentMode(): DeploymentMode {
  const raw = process.env.DEPLOYMENT_MODE?.toLowerCase();
  if (raw === 'self-hosted' || raw === 'hosted') {
    return raw;
  }
  if (raw) {
    throw new Error(
      `Invalid DEPLOYMENT_MODE value: ${raw} (expected 'self-hosted' or 'hosted')`
    );
  }

  // Backward-compat: derive from EDITION (HOSTED → hosted; CE/OSS/unset → self-hosted).
  const edition = process.env.EDITION?.toUpperCase();
  return edition === 'HOSTED' ? 'hosted' : 'self-hosted';
}

export function isHostedMode(): boolean {
  return getDeploymentMode() === 'hosted';
}

/**
 * Internal edition label consumed by the generate handler and `/api/meta`.
 * Derived from the deployment mode — not a separate switch.
 */
export function resolveEdition(): 'CE' | 'HOSTED' {
  return isHostedMode() ? 'HOSTED' : 'CE';
}

/**
 * Resolves the active billing provider.
 *
 * Billing is only available in hosted mode. Within hosted mode:
 * 1. `BILLING_PROVIDER` if set (`none` | `revenuecat`).
 * 2. Backward-compat: `HOSTED_BILLING_ENABLED=true` → `revenuecat`.
 *
 * @throws Error if BILLING_PROVIDER is set to an unrecognized value.
 */
export function getBillingProvider(): BillingProvider {
  if (!isHostedMode()) {
    return 'none';
  }

  const raw = process.env.BILLING_PROVIDER?.toLowerCase();
  if (raw === 'none' || raw === 'revenuecat') {
    return raw;
  }
  if (raw) {
    throw new Error(
      `Invalid BILLING_PROVIDER value: ${raw} (expected 'none' or 'revenuecat')`
    );
  }

  // Backward-compat: HOSTED_BILLING_ENABLED=true → revenuecat.
  return process.env.HOSTED_BILLING_ENABLED === 'true' ? 'revenuecat' : 'none';
}

export function isBillingEnabled(): boolean {
  return getBillingProvider() !== 'none';
}
