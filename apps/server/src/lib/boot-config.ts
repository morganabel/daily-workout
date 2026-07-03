/**
 * Boot-time configuration validation.
 *
 * Runs at server startup (via instrumentation) to fail fast on invalid or
 * incomplete configuration, so a misconfigured deployment exits immediately
 * instead of coming up "healthy" and only erroring on the first request.
 *
 * Env checks only (no I/O). Actual database connectivity is verified separately
 * by the /api/ready readiness endpoint.
 */

import { getBillingProvider, getDeploymentMode } from './deployment';
import { resolveAuthMode, validateAuthConfig } from './auth-context';

export function validateBootConfig(): void {
  // These throw on an invalid DEPLOYMENT_MODE / BILLING_PROVIDER value.
  const mode = getDeploymentMode();
  const billingProvider = getBillingProvider();

  // Self-hosted stays permissive; the strict checks apply to hosted deployments.
  if (mode !== 'hosted') {
    return;
  }

  // Hosted requires a configured database (Better Auth cannot fall back to stub).
  if (!process.env.DATABASE_URL && !process.env.INSTANCE_CONNECTION_NAME) {
    throw new Error(
      'Hosted mode requires a database: set DATABASE_URL or INSTANCE_CONNECTION_NAME.'
    );
  }

  // Catch an explicit AUTH_MODE=stub set in hosted mode.
  validateAuthConfig(resolveAuthMode());

  if (!process.env.BETTER_AUTH_SECRET) {
    throw new Error('Hosted mode requires BETTER_AUTH_SECRET.');
  }

  if (
    billingProvider === 'revenuecat' &&
    !process.env.REVENUECAT_WEBHOOK_SECRET &&
    process.env.REVENUECAT_ALLOW_UNSIGNED_WEBHOOKS !== 'true'
  ) {
    throw new Error(
      'Hosted billing (BILLING_PROVIDER=revenuecat) requires REVENUECAT_WEBHOOK_SECRET ' +
        '(or set REVENUECAT_ALLOW_UNSIGNED_WEBHOOKS=true to accept unsigned webhooks).'
    );
  }
}
