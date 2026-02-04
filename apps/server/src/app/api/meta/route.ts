/**
 * Server capabilities discovery endpoint
 *
 * GET /api/meta
 *
 * Returns server capabilities including:
 * - Protocol version for API compatibility
 * - Authentication methods available
 * - Server edition (CE or HOSTED)
 *
 * This endpoint is accessible without authentication so clients
 * can detect backend capabilities before attempting auth.
 */

import { PROTOCOL_VERSION } from '@workout-agent-ce/server-core';
import {
  attachRequestId,
  createLogger,
  getOrCreateRequestId,
} from '@workout-agent-ce/server-core';
import {
  createStubMetaResponse,
  createBetterAuthMetaResponse,
  metaResponseSchema,
} from '@workout-agent/shared';
import { getAuthContext } from '@/lib/auth-context';

export async function GET(request: Request): Promise<Response> {
  const requestId = getOrCreateRequestId(request);
  const startedAt = Date.now();
  const log = createLogger({ route: 'api.meta', requestId });
  const ctx = getAuthContext();

  // Determine edition from environment
  const rawEdition = process.env.EDITION?.toUpperCase();
  const edition: 'CE' | 'HOSTED' =
    rawEdition === 'HOSTED' ? 'HOSTED' : 'CE';

  // Build response based on auth mode
  const response =
    ctx.mode === 'better-auth'
      ? createBetterAuthMetaResponse(PROTOCOL_VERSION, edition)
      : createStubMetaResponse(PROTOCOL_VERSION);

  // Validate response (ensures type safety)
  const validated = metaResponseSchema.parse(response);

  const res = Response.json(validated);
  attachRequestId(res, requestId);
  log.info('request completed', {
    method: request.method,
    path: '/api/meta',
    status: 200,
    durationMs: Date.now() - startedAt,
    authMode: ctx.mode,
    edition,
  });
  return res;
}
