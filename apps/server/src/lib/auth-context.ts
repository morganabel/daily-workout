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

import {
  StubAuthProvider,
  type AuthProvider,
} from '@workout-agent-ce/server-core';
import { createLogger } from '@workout-agent-ce/server-core';
import { createDbFromEnv, type Database } from '@workout-agent-ce/server-db';
import {
  createAuth,
  BetterAuthProvider,
  getGoogleAuthConfig,
  type Auth,
} from '@workout-agent-ce/server-auth';
import {
  resolveAuthMode,
  validateAuthConfig,
  type AuthMode,
} from './auth-config';

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

  /** Whether Google OAuth is configured for this Better Auth instance. */
  googleAvailable: boolean;
}

// Cached context (and in-flight initialization) to avoid re-initialization.
let cachedContext: AuthContext | null = null;
let contextPromise: Promise<AuthContext> | null = null;

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
    const google = getGoogleAuthConfig();
    const auth = createAuth({
      db,
      secret,
      baseURL: process.env.BETTER_AUTH_URL ?? process.env.NEXTAUTH_URL,
      trustedOrigins: process.env.TRUSTED_ORIGINS?.split(',').map((s) =>
        s.trim()
      ),
      google,
    });

    log.info('initialized auth mode', { mode });
    return {
      mode,
      provider: new BetterAuthProvider(auth),
      auth,
      db,
      googleAvailable: Boolean(google),
    };
  }

  // Stub mode - no database required
  log.info('initialized auth mode', { mode });
  return {
    mode,
    provider: new StubAuthProvider(),
    auth: null,
    db: null,
    googleAvailable: false,
  };
}

/**
 * Resets the cached context (useful for testing)
 */
export function resetAuthContext(): void {
  cachedContext = null;
  contextPromise = null;
}
