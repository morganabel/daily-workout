/**
 * Auth context factory for the CE server
 *
 * Implements the auth-mode selection algorithm:
 * AUTH_MODE = env.AUTH_MODE ??
 *   ((env.DATABASE_URL || env.INSTANCE_CONNECTION_NAME) ? 'better-auth' : 'stub')
 *
 * The database is created via server-db's createDbFromEnv, which autodetects a
 * standard DATABASE_URL vs the Cloud SQL Connector (INSTANCE_CONNECTION_NAME).
 */

import { StubAuthProvider, type AuthProvider } from '@workout-agent-ce/server-core';
import { createLogger } from '@workout-agent-ce/server-core';
import { createDbFromEnv, type Database } from '@workout-agent-ce/server-db';
import {
  createAuth,
  BetterAuthProvider,
  type Auth,
} from '@workout-agent-ce/server-auth';
import { isHostedMode } from './deployment';

export type AuthMode = 'better-auth' | 'stub';

export interface AuthContext {
  /**
   * The resolved auth mode
   */
  mode: AuthMode;

  /**
   * The configured AuthProvider for request authentication
   */
  provider: AuthProvider;

  /**
   * The Better Auth instance (only available in better-auth mode)
   */
  auth: Auth | null;

  /**
   * The database instance (only available in better-auth mode)
   */
  db: Database | null;
}

// Cached context (and in-flight initialization) to avoid re-initialization.
let cachedContext: AuthContext | null = null;
let contextPromise: Promise<AuthContext> | null = null;

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

  // Fall back based on database configuration: a standard connection string
  // (DATABASE_URL) or a Cloud SQL Connector instance (INSTANCE_CONNECTION_NAME).
  return process.env.DATABASE_URL || process.env.INSTANCE_CONNECTION_NAME
    ? 'better-auth'
    : 'stub';
}

/**
 * Validates auth configuration for the current deployment mode.
 *
 * Fails fast if:
 * - Hosted mode but Better Auth is not configured (no DATABASE_URL)
 *
 * @throws Error if configuration is invalid
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

/**
 * Gets the auth context, initializing it if needed.
 *
 * This is the main entry point for auth in route handlers. It is async because
 * better-auth mode may open the database connection via the Cloud SQL Connector,
 * which is asynchronous. The result (and the in-flight promise) is cached to
 * avoid redundant initialization.
 *
 * @throws Error if hosted mode but auth is misconfigured
 */
export async function getAuthContext(): Promise<AuthContext> {
  if (cachedContext) {
    return cachedContext;
  }

  if (!contextPromise) {
    contextPromise = initializeAuthContext();
  }

  try {
    cachedContext = await contextPromise;
    return cachedContext;
  } catch (error) {
    // Allow a later request to retry after a transient failure.
    contextPromise = null;
    throw error;
  }
}

async function initializeAuthContext(): Promise<AuthContext> {
  const log = createLogger({ route: 'auth.context' });
  const mode = resolveAuthMode();
  validateAuthConfig(mode);

  if (mode === 'better-auth') {
    const secret = process.env.BETTER_AUTH_SECRET;
    if (!secret) {
      throw new Error('BETTER_AUTH_SECRET is required for better-auth mode');
    }

    // Autodetects the Cloud SQL Connector (INSTANCE_CONNECTION_NAME) or a
    // standard DATABASE_URL connection string.
    const db = await createDbFromEnv();
    const auth = createAuth({
      db,
      secret,
      baseURL: process.env.BETTER_AUTH_URL ?? process.env.NEXTAUTH_URL,
      trustedOrigins: process.env.TRUSTED_ORIGINS?.split(',').map((s) =>
        s.trim()
      ),
    });

    log.info('initialized auth mode', { mode });
    return {
      mode,
      provider: new BetterAuthProvider(auth),
      auth,
      db,
    };
  }

  // Stub mode - no database required
  log.info('initialized auth mode', { mode });
  return {
    mode,
    provider: new StubAuthProvider(),
    auth: null,
    db: null,
  };
}

/**
 * Resets the cached context (useful for testing)
 */
export function resetAuthContext(): void {
  cachedContext = null;
  contextPromise = null;
}
