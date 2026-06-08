import {
  attachRequestId,
  createRequestContext,
} from '@workout-agent-ce/server-core';
import {
  billingEntitlementsResponseSchema,
  type BillingEntitlementsResponse,
} from '@workout-agent/shared';
import { getAuthContext } from '@/lib/auth-context';
import { createErrorResponse } from '@/lib/errors';
import { usagePolicy } from '@/lib/wiring';

const billingRouteDisabled = (): boolean =>
  process.env.EDITION?.toUpperCase() !== 'HOSTED' ||
  process.env.HOSTED_BILLING_ENABLED !== 'true';

export async function GET(request: Request): Promise<Response> {
  const { requestId, startedAt, log } = createRequestContext(
    request,
    'api.billing.entitlements'
  );

  if (billingRouteDisabled()) {
    const response = createErrorResponse(
      'NOT_FOUND',
      'Billing entitlements are not enabled for this deployment',
      404
    );
    attachRequestId(response, requestId);
    return response;
  }

  const auth = await getAuthContext().provider.authenticate(request);
  if (!auth) {
    const response = createErrorResponse(
      'UNAUTHORIZED',
      'Invalid or missing session',
      401
    );
    attachRequestId(response, requestId);
    return response;
  }

  if (!usagePolicy.getEntitlements) {
    const response = createErrorResponse(
      'NOT_FOUND',
      'Billing entitlements are unavailable',
      404
    );
    attachRequestId(response, requestId);
    return response;
  }

  const entitlements = (await usagePolicy.getEntitlements(
    auth.userId
  )) as BillingEntitlementsResponse;
  const validated = billingEntitlementsResponseSchema.parse(entitlements);

  const response = Response.json(validated);
  attachRequestId(response, requestId);
  log.info('request completed', {
    method: request.method,
    path: '/api/billing/entitlements',
    status: 200,
    durationMs: Date.now() - startedAt,
  });
  return response;
}
