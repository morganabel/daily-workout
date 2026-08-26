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
import { expo } from '@better-auth/expo';
import type {
  PromoteAnonymousUserInput,
  User,
} from '@workout-agent-ce/server-db';

export interface GoogleAuthConfig {
  clientId: string;
  clientSecret: string;
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

  /**
   * Runtime-only persistence callback for atomically preserving an anonymous
   * user's id during an email/password upgrade. The Better Auth CLI can omit
   * this because it never handles requests.
   */
  promoteAnonymousUser?: (input: PromoteAnonymousUserInput) => Promise<User>;
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

interface GoogleOAuthProfile {
  accountId: string;
  email: string;
  name: string;
  image?: string;
}

function readGoogleOAuthProfile(
  idToken: string | null | undefined,
  expectedAccountId: string,
  expectedAudience: string
): GoogleOAuthProfile | undefined {
  if (!idToken) {
    return undefined;
  }

  try {
    const payloadPart = idToken.split('.')[1];
    if (!payloadPart) {
      return undefined;
    }

    // Better Auth obtained this token directly from Google's code exchange and
    // used the same payload to establish the provider account. Bind the claims
    // again here before persisting the provider profile on our preserved user.
    const claims = JSON.parse(
      Buffer.from(payloadPart, 'base64url').toString('utf8')
    ) as Record<string, unknown>;
    const audience = claims.aud;
    const hasExpectedAudience = Array.isArray(audience)
      ? audience.includes(expectedAudience)
      : audience === expectedAudience;
    const issuerIsGoogle =
      claims.iss === 'https://accounts.google.com' ||
      claims.iss === 'accounts.google.com';
    const isUnexpired =
      typeof claims.exp === 'number' &&
      claims.exp > Math.floor(Date.now() / 1000);

    if (
      claims.sub !== expectedAccountId ||
      !hasExpectedAudience ||
      !issuerIsGoogle ||
      !isUnexpired ||
      claims.email_verified !== true ||
      typeof claims.email !== 'string' ||
      !claims.email.trim()
    ) {
      return undefined;
    }

    const email = claims.email.trim();
    return {
      accountId: expectedAccountId,
      email,
      name:
        typeof claims.name === 'string' && claims.name.trim()
          ? claims.name.trim()
          : email,
      ...(typeof claims.picture === 'string' && claims.picture.trim()
        ? { image: claims.picture.trim() }
        : {}),
    };
  } catch {
    return undefined;
  }
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
    promoteAnonymousUser,
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
        // Keep the anonymous record while we move a newly-created email
        // account's Better Auth rows onto its original userId. Google uses
        // the explicit authenticated linkSocial flow below instead.
        emailDomainName: 'anonymous.workout-agent.local',
        disableDeleteAnonymousUser: true,
        onLinkAccount: async ({ anonymousUser, newUser, ctx }) => {
          const anonymousUserId = anonymousUser.user.id;
          const newUserId = newUser.user.id;

          if (anonymousUserId === newUserId) {
            await ctx.context.internalAdapter.updateUser(anonymousUserId, {
              isAnonymous: false,
            });
            return;
          }

          // Only the explicit email sign-up route creates a new account here.
          // Sign-in routes may resolve an existing account; leaving those
          // accounts canonical avoids merging unrelated anonymous data into an
          // account the user is merely signing into. Google upgrades use
          // /link-social, which already carries the authenticated user id.
          if (!ctx.path?.startsWith('/sign-up')) {
            return;
          }

          if (!promoteAnonymousUser) {
            throw new Error(
              'Atomic anonymous user promotion is not configured at runtime'
            );
          }

          const promotedUser = await promoteAnonymousUser({
            anonymousUserId,
            temporaryUserId: newUserId,
            email: newUser.user.email,
            name: newUser.user.name,
            emailVerified: newUser.user.emailVerified,
            ...(newUser.user.image !== undefined
              ? { image: newUser.user.image }
              : {}),
          });

          // The session cookie already contains the same token. Point its
          // database row and Better Auth's in-flight session at the preserved
          // user id before the response is finalized.
          ctx.context.setNewSession({
            session: {
              ...newUser.session,
              userId: anonymousUserId,
            },
            user: promotedUser,
          });
        },
      }),
      expo(),
    ],

    databaseHooks: {
      account: {
        create: {
          after: async (account, context) => {
            if (account.providerId !== 'google' || !context) {
              return;
            }

            const user = await context.context.internalAdapter.findUserById(
              account.userId
            );
            if (!user || !(user as { isAnonymous?: boolean }).isAnonymous) {
              return;
            }

            const profile = readGoogleOAuthProfile(
              account.idToken,
              account.accountId,
              google?.clientId ?? ''
            );
            if (!profile) {
              throw new Error(
                'Google account link did not include a valid verified profile'
              );
            }

            // The link-social flow already attached the Google account to the
            // anonymous user's id. Preserve that id while replacing the
            // generated anonymous profile with Google's verified identity.
            try {
              await context.context.internalAdapter.updateUser(account.userId, {
                email: profile.email,
                emailVerified: true,
                name: profile.name,
                ...(profile.image !== undefined
                  ? { image: profile.image }
                  : {}),
                isAnonymous: false,
              });
            } catch (error) {
              // The account create hook runs after Better Auth inserts the row.
              // Remove it if profile promotion fails so the user can retry
              // instead of being left with a linked-but-anonymous identity.
              await context.context.internalAdapter.deleteAccount(account.id);
              throw error;
            }
          },
        },
      },
    },

    experimental: {
      joins: true,
    },
  };
}
