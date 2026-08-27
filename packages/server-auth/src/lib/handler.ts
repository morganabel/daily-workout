/**
 * Next.js route handler factory for Better Auth
 *
 * Creates route handlers that delegate to Better Auth's built-in endpoints.
 */

import type { Auth } from './auth.js';

/**
 * Creates Next.js App Router handlers for Better Auth endpoints.
 *
 * Mount at `/api/auth/[...all]/route.ts`:
 *
 * @example
 * ```ts
 * // apps/server/src/app/api/auth/[...all]/route.ts
 * import { createAuthHandler } from '@leveza/server-auth';
 * import { auth } from '@/lib/auth-context';
 *
 * const handler = createAuthHandler(auth);
 *
 * export const GET = handler;
 * export const POST = handler;
 * ```
 */
export function createAuthHandler(auth: Auth) {
  return auth.handler;
}
