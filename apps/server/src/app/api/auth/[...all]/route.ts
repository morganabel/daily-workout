/**
 * Better Auth catch-all route handler
 *
 * Delegates all /api/auth/* requests to Better Auth.
 * Only active when auth mode is 'better-auth'.
 *
 * Endpoints handled by Better Auth:
 * - POST /api/auth/sign-in/email - Email/password sign in
 * - POST /api/auth/sign-up/email - Email/password registration
 * - POST /api/auth/sign-in/anonymous - Anonymous sign in
 * - GET /api/auth/session - Get current session
 * - POST /api/auth/sign-out - Sign out
 * - And more...
 */

import { getAuthContext } from '@/lib/auth-context';
import { createAuthHandler } from '@workout-agent-ce/server-auth';

/**
 * Handler that delegates to Better Auth or returns 404 for stub mode
 */
async function handler(request: Request): Promise<Response> {
  const ctx = getAuthContext();

  if (ctx.mode !== 'better-auth' || !ctx.auth) {
    // In stub mode, auth endpoints are not available
    return Response.json(
      {
        error: 'AUTH_NOT_CONFIGURED',
        message: 'Authentication endpoints are not available in stub mode',
      },
      { status: 404 }
    );
  }

  // Delegate to Better Auth
  const authHandler = createAuthHandler(ctx.auth);
  return authHandler(request);
}

export const GET = handler;
export const POST = handler;
