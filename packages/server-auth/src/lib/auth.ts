/**
 * Better Auth configuration factory
 *
 * Creates a Better Auth instance with the configured plugins and settings.
 * No side effects at import time - EE can call the factory at runtime.
 */

import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import type { Database } from '@workout-agent-ce/server-db';
import { createBetterAuthOptions } from './better-auth-options.js';

/**
 * Options for creating a Better Auth instance
 */
export interface CreateAuthOptions {
  /**
   * Drizzle database instance
   */
  db: Database;

  /**
   * Secret key for signing tokens (from BETTER_AUTH_SECRET env var)
   */
  secret: string;

  /**
   * Base URL of the application (e.g., http://localhost:3000)
   */
  baseURL?: string;

  /**
   * Trusted origins for CORS (mobile app URLs, etc.)
   */
  trustedOrigins?: string[];
}

/**
 * Type of the Better Auth instance - using ReturnType of betterAuth
 */
export type Auth = ReturnType<typeof betterAuth>;

/**
 * Creates a Better Auth instance configured for the workout app.
 *
 * Features:
 * - Anonymous sessions (default for first-run experience)
 * - Email/password authentication (upgrade path from anonymous)
 * - Bearer token transport (mobile-friendly, no cookies required)
 * - Account linking (anonymous → email preserves userId)
 *
 * @example
 * ```ts
 * const auth = createAuth({
 *   db,
 *   secret: process.env.BETTER_AUTH_SECRET!,
 *   baseURL: 'http://localhost:3000',
 * });
 * ```
 */
export function createAuth(options: CreateAuthOptions): Auth {
  const { db, secret, baseURL, trustedOrigins = [] } = options;

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: 'pg',
    }),
    ...createBetterAuthOptions({
      secret,
      baseURL,
      trustedOrigins,
    }),
  });
}
