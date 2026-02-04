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
import {
  attachRequestId,
  createLogger,
  getOrCreateRequestId,
} from '@workout-agent-ce/server-core';
import { createAuthHandler } from '@workout-agent-ce/server-auth';

/**
 * Handler that delegates to Better Auth or returns 404 for stub mode
 */
async function handler(request: Request): Promise<Response> {
  const requestId = getOrCreateRequestId(request);
  const startedAt = Date.now();
  const log = createLogger({ route: 'api.auth', requestId });
  const ctx = getAuthContext();

  if (ctx.mode !== 'better-auth' || !ctx.auth) {
    // In stub mode, auth endpoints are not available
    const res = Response.json(
      {
        error: 'AUTH_NOT_CONFIGURED',
        message: 'Authentication endpoints are not available in stub mode',
      },
      { status: 404 }
    );
    attachRequestId(res, requestId);
    log.info('request completed', {
      method: request.method,
      path: '/api/auth/*',
      status: 404,
      durationMs: Date.now() - startedAt,
      authMode: ctx.mode,
    });
    return res;
  }

  // Delegate to Better Auth
  try {
    const authHandler = createAuthHandler(ctx.auth);
    const res = await authHandler(request);
    attachRequestId(res, requestId);
    log.info('request completed', {
      method: request.method,
      path: '/api/auth/*',
      status: res.status,
      durationMs: Date.now() - startedAt,
    });
    return res;
  } catch (error) {
    log.error('unhandled auth error', { error });
    const res = Response.json(
      {
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Unexpected server error',
      },
      { status: 500 }
    );
    attachRequestId(res, requestId);
    return res;
  }
}

export const GET = handler;
export const POST = handler;
