/**
 * Environment-only auth configuration helpers.
 *
 * Keep this module free of database and auth-provider imports so boot-time
 * validation can run from Next.js instrumentation without bundling Node-only
 * database dependencies.
 */

import { isHostedMode } from './deployment';

export type AuthMode = 'better-auth' | 'stub';

/**
 * Resolves the auth mode based on environment variables.
 *
 * Algorithm:
 * 1. If AUTH_MODE is explicitly set, use that
 * 2. If a database is configured (DATABASE_URL or the Cloud SQL Connector's
 *    INSTANCE_CONNECTION_NAME), use 'better-auth'
 * 3. Otherwise, use 'stub'
 */
export function resolveAuthMode(): AuthMode {
  const explicitMode = process.env.AUTH_MODE?.toLowerCase();
  if (explicitMode === 'better-auth' || explicitMode === 'stub') {
    return explicitMode;
  }

  return process.env.DATABASE_URL || process.env.INSTANCE_CONNECTION_NAME
    ? 'better-auth'
    : 'stub';
}

/**
 * Rejects stub authentication in hosted deployments.
 */
export function validateAuthConfig(mode: AuthMode): void {
  if (isHostedMode() && mode !== 'better-auth') {
    throw new Error(
      'Hosted mode requires Better Auth (set DATABASE_URL or ' +
        'INSTANCE_CONNECTION_NAME). Hosted mode cannot fall back to stub ' +
        'authentication.'
    );
  }
}
