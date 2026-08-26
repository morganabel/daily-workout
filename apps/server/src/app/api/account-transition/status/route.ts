import { getCompletedAccountTransitionForTarget } from '@workout-agent-ce/server-db';
import {
  attachRequestId,
  createRequestContext,
} from '@workout-agent-ce/server-core';

import { getAuthContext } from '@/lib/auth-context';
import { createErrorResponse } from '@/lib/errors';

export async function GET(request: Request): Promise<Response> {
  const { requestId } = createRequestContext(
    request,
    'api.account-transition.status'
  );
  const context = await getAuthContext();
  const authenticated = await context.provider.authenticate(request);
  if (!authenticated) {
    const response = createErrorResponse(
      'UNAUTHORIZED',
      'Invalid or missing session',
      401
    );
    attachRequestId(response, requestId);
    return response;
  }
  if (!context.db) {
    const response = createErrorResponse(
      'NOT_FOUND',
      'Account transition requires Better Auth',
      404
    );
    attachRequestId(response, requestId);
    return response;
  }

  const sourceUserId = new URL(request.url).searchParams.get('sourceUserId');
  if (!sourceUserId || sourceUserId.length > 255) {
    const response = createErrorResponse(
      'VALIDATION_ERROR',
      'A valid sourceUserId is required',
      400
    );
    attachRequestId(response, requestId);
    return response;
  }

  const transition = await getCompletedAccountTransitionForTarget(
    context.db,
    sourceUserId,
    authenticated.userId
  );
  if (!transition) {
    const response = createErrorResponse(
      'NOT_FOUND',
      'Completed account transition was not found',
      404
    );
    attachRequestId(response, requestId);
    return response;
  }

  const response = Response.json({
    sourceUserId: transition.sourceUserId,
    targetUserId: transition.targetUserId,
    method: transition.method,
    state: transition.state,
  });
  attachRequestId(response, requestId);
  return response;
}
