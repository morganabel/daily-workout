/**
 * Auth context factory for the CE server
 *
 * Implements the auth-mode selection algorithm:
 * AUTH_MODE = env.AUTH_MODE ?? (env.DATABASE_URL ? 'better-auth' : 'stub')
 *
 * This factory can be reused by EE verbatim.
 */

import { StubAuthProvider, type AuthProvider } from '@workout-agent-ce/server-core';
import { createLogger } from '@workout-agent-ce/server-core';
import { createDb, type Database } from '@workout-agent-ce/server-db';
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

// Cached context to avoid re-initialization
let cachedContext: AuthContext | null = null;

/**
 * Resolves the auth mode based on environment variables.
 *
 * Algorithm:
 * 1. If AUTH_MODE is explicitly set, use that
 * 2. If DATABASE_URL is set, use 'better-auth'
 * 3. Otherwise, use 'stub'
 */
export function resolveAuthMode(): AuthMode {
  const explicitMode = process.env.AUTH_MODE?.toLowerCase();
  if (explicitMode === 'better-auth' || explicitMode === 'stub') {
    return explicitMode;
  }

  // Fall back based on DATABASE_URL presence
  return process.env.DATABASE_URL ? 'better-auth' : 'stub';
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
      'Hosted mode requires Better Auth (DATABASE_URL must be set). ' +
        'Hosted mode cannot fall back to stub authentication.'
    );
  }
}

/**
 * Gets the auth context, initializing it if needed.
 *
 * This is the main entry point for auth in route handlers.
 * It returns a cached context to avoid redundant initialization.
 *
 * @throws Error if hosted mode but auth is misconfigured
 */
export function getAuthContext(): AuthContext {
  if (cachedContext) {
    return cachedContext;
  }

  const log = createLogger({ route: 'auth.context' });
  const mode = resolveAuthMode();
  validateAuthConfig(mode);

  if (mode === 'better-auth') {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL is required for better-auth mode');
    }

    const secret = process.env.BETTER_AUTH_SECRET;
    if (!secret) {
      throw new Error('BETTER_AUTH_SECRET is required for better-auth mode');
    }

    const db = createDb({ connectionString });
    const auth = createAuth({
      db,
      secret,
      baseURL: process.env.BETTER_AUTH_URL ?? process.env.NEXTAUTH_URL,
      trustedOrigins: process.env.TRUSTED_ORIGINS?.split(',').map((s) =>
        s.trim()
      ),
    });

    cachedContext = {
      mode,
      provider: new BetterAuthProvider(auth),
      auth,
      db,
    };
  } else {
    // Stub mode - no database required
    cachedContext = {
      mode,
      provider: new StubAuthProvider(),
      auth: null,
      db: null,
    };
  }

  log.info('initialized auth mode', { mode });
  return cachedContext;
}

/**
 * Resets the cached context (useful for testing)
 */
export function resetAuthContext(): void {
  cachedContext = null;
}
