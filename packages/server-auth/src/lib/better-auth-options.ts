/**
 * Shared Better Auth options used by both:
 * - runtime auth initialization (`packages/server-auth`)
 * - CLI schema generation (`apps/server/src/lib/auth.ts`)
 *
 * Keep schema-affecting settings here to prevent drift between runtime and
 * `better-auth generate` output.
 */

import { APIError, type BetterAuthOptions } from 'better-auth';
import { anonymous, bearer } from 'better-auth/plugins';
import { expo } from '@better-auth/expo';

export type AccountTransitionMethod = 'email' | 'google';

export interface AnonymousAccountTransitionInput {
  sourceUserId: string;
  targetUserId: string;
  method: AccountTransitionMethod;
}

export interface GoogleAuthConfig {
  clientId: string;
  clientSecret: string;
}

const ACCOUNT_TRANSITION_FAILURE_CODES = new Set([
  'source_not_anonymous',
  'target_not_authenticated',
  'target_has_application_state',
  'source_target_conflict',
  'migration_failed',
  'transition_disabled',
]);

function getAccountTransitionFailureCode(error: unknown): string | null {
  if (!error || typeof error !== 'object' || !('code' in error)) return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' && ACCOUNT_TRANSITION_FAILURE_CODES.has(code)
    ? code
    : null;
}

function getAccountTransitionMethod(ctx: {
  path?: string;
  params?: Record<string, unknown>;
}): AccountTransitionMethod {
  return ctx.params?.id === 'google' || ctx.path?.includes('google')
    ? 'google'
    : 'email';
}

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

  /**
   * Optional Google OAuth credentials. When omitted, Google sign-in is not
   * registered and the rest of Better Auth remains available.
   */
  google?: GoogleAuthConfig;

  /** Runtime-only migration of Workout Agent-owned rows from anonymous A to B. */
  transitionAnonymousAccount?: (
    input: AnonymousAccountTransitionInput
  ) => Promise<void>;
}

/**
 * Resolve the optional Google provider configuration from an environment-like
 * object. Google sign-in remains unavailable until both values are present.
 */
export function getGoogleAuthConfig(
  env: Record<string, string | undefined> = process.env
): GoogleAuthConfig | undefined {
  const clientId = env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = env.GOOGLE_CLIENT_SECRET?.trim();

  if (!clientId || !clientSecret) {
    return undefined;
  }

  return { clientId, clientSecret };
}

/**
 * Create the shared Better Auth options (excluding the database adapter).
 */
export function createBetterAuthOptions(
  params: CreateBetterAuthOptionsParams
): Omit<BetterAuthOptions, 'database'> {
  const {
    secret,
    baseURL,
    trustedOrigins = [],
    google,
    transitionAnonymousAccount,
  } = params;

  return {
    secret,
    baseURL,
    trustedOrigins,

    ...(google
      ? {
          socialProviders: {
            google: {
              clientId: google.clientId,
              clientSecret: google.clientSecret,
            },
          },
        }
      : {}),

    account: {
      // OAuth access and refresh tokens are credentials; encrypt them at rest.
      encryptOAuthTokens: true,
      accountLinking: {
        enabled: true,
        // Google returns verified identities. Keeping it trusted also permits
        // linking Google to an existing email/password account without making
        // email verification a prerequisite for the legacy email flow.
        trustedProviders: ['google'],
        // Anonymous users intentionally have a generated email address, so
        // their explicit Google upgrade cannot match emails literally.
        allowDifferentEmails: true,
      },
    },

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
        emailDomainName: 'anonymous.workout-agent.local',
        ...(transitionAnonymousAccount
          ? {
              onLinkAccount: async ({ anonymousUser, newUser, ctx }) => {
                try {
                  await transitionAnonymousAccount({
                    sourceUserId: anonymousUser.user.id,
                    targetUserId: newUser.user.id,
                    method: getAccountTransitionMethod(ctx),
                  });
                } catch (error) {
                  const code = getAccountTransitionFailureCode(error);
                  if (!code) throw error;
                  throw new APIError(
                    code === 'migration_failed'
                      ? 'INTERNAL_SERVER_ERROR'
                      : 'CONFLICT',
                    {
                      code,
                      message: code,
                    }
                  );
                }
              },
            }
          : {}),
      }),
      expo(),
    ],
  };
}
