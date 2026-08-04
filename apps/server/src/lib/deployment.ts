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
 */

export type DeploymentMode = 'self-hosted' | 'hosted';
export type BillingProvider = 'none' | 'revenuecat';

/**
 * Resolves the deployment mode.
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

  if (
    process.env.EDITION?.toUpperCase() === 'HOSTED' ||
    process.env.HOSTED_BILLING_ENABLED?.toLowerCase() === 'true'
  ) {
    throw new Error(
      'Legacy hosted configuration detected: set DEPLOYMENT_MODE explicitly.'
    );
  }

  return 'self-hosted';
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

  if (process.env.HOSTED_BILLING_ENABLED?.toLowerCase() === 'true') {
    throw new Error(
      'Legacy hosted billing configuration detected: set BILLING_PROVIDER explicitly.'
    );
  }

  return 'none';
}

export function isBillingEnabled(): boolean {
  return getBillingProvider() !== 'none';
}
