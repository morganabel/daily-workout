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
import { resolveAuthMode, validateAuthConfig } from './auth-config';
import { getBillingConfig } from './billing-config';

const hasEnvValue = (key: string): boolean => Boolean(process.env[key]?.trim());

export function validateBootConfig(): void {
  // DEPLOYMENT_MODE is always parsed; BILLING_PROVIDER is parsed below when
  // hosted mode makes billing configuration relevant.
  const mode = getDeploymentMode();
  const hasCloudSqlConfig = Boolean(process.env.INSTANCE_CONNECTION_NAME);

  // Self-hosted stays permissive; the strict checks apply to hosted deployments.
  if (mode !== 'hosted') {
    return;
  }

  const billingProvider = getBillingProvider();

  // Hosted requires a configured database (Better Auth cannot fall back to stub).
  if (!hasEnvValue('DATABASE_URL') && !hasCloudSqlConfig) {
    throw new Error(
      'Hosted mode requires a database: set DATABASE_URL or INSTANCE_CONNECTION_NAME.'
    );
  }

  if (hasCloudSqlConfig) {
    const missingCloudSqlVars = [
      'INSTANCE_CONNECTION_NAME',
      'DB_NAME',
      'DB_USER',
      'DB_PASSWORD',
    ].filter((key) => !hasEnvValue(key));
    if (missingCloudSqlVars.length > 0) {
      throw new Error(
        'Hosted mode with INSTANCE_CONNECTION_NAME requires ' +
          `${missingCloudSqlVars.join(', ')}.`
      );
    }
  }

  // Catch an explicit AUTH_MODE=stub set in hosted mode.
  validateAuthConfig(resolveAuthMode());

  if (!hasEnvValue('BETTER_AUTH_SECRET')) {
    throw new Error('Hosted mode requires BETTER_AUTH_SECRET.');
  }

  if (billingProvider === 'revenuecat') getBillingConfig();
}
