/**
 * Shared Better Auth options used by both:
 * - runtime auth initialization (`packages/server-auth`)
 * - CLI schema generation (`apps/server/src/lib/auth.ts`)
 *
 * Keep schema-affecting settings here to prevent drift between runtime and
 * `better-auth generate` output.
 */

import type { BetterAuthOptions } from 'better-auth';
import { anonymous, bearer } from 'better-auth/plugins';

export interface CreateBetterAuthOptionsParams {
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
 * Create the shared Better Auth options (excluding the database adapter).
 */
export function createBetterAuthOptions(
  params: CreateBetterAuthOptionsParams
): Omit<BetterAuthOptions, 'database'> {
  const { secret, baseURL, trustedOrigins = [] } = params;

  return {
    secret,
    baseURL,
    trustedOrigins,

    // Use bearer tokens for mobile compatibility
    session: {
      cookieCache: {
        enabled: false, // Disable cookie caching for bearer token auth
      },
    },

    // Configure email/password authentication
    emailAndPassword: {
      enabled: true,
      // Don't require email verification for initial implementation
      requireEmailVerification: false,
    },

    plugins: [
      // Default behavior: accepts either a signed bearer token (from `set-auth-token`)
      // or a raw session token (it will be signed internally).
      bearer(),
      anonymous({
        // Allow linking anonymous accounts to email/password
        // This preserves userId when upgrading from anonymous
        emailDomainName: 'anonymous.workout-agent.local',
      }),
    ],

    experimental: {
      joins: true,
    },
  };
}

