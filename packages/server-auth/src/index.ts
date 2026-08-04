/**
 * Server Auth Package
 *
 * Provides Better Auth configuration, provider, and route handlers.
 * No side effects at import time - all initialization happens via factory functions.
 */

// Export auth factory
export { createAuth, type Auth, type CreateAuthOptions } from './lib/auth.js';

// Export shared options (used by CLI schema generation to stay in sync with runtime)
export {
  createBetterAuthOptions,
  getGoogleAuthConfig,
  type CreateBetterAuthOptionsParams,
  type GoogleAuthConfig,
} from './lib/better-auth-options.js';

// Export auth provider for use with server-core
export { BetterAuthProvider } from './lib/provider.js';

// Export route handler factory for Next.js
export { createAuthHandler } from './lib/handler.js';
