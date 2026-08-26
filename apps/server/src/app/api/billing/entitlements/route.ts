import {
  attachRequestId,
  createRequestContext,
} from '@workout-agent-ce/server-core';
import {
  billingEntitlementsResponseSchema,
  type BillingEntitlementsResponse,
} from '@workout-agent/shared';
import { getAuthContext } from '@/lib/auth-context';
import { getRevenueCatBillingServices } from '@/lib/billing-services';
import { createErrorResponse } from '@/lib/errors';
import { getBillingProvider } from '@/lib/deployment';

const billingRouteDisabled = (): boolean =>
  getBillingProvider() !== 'revenuecat';

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

  const ctx = await getAuthContext();
  const auth = await ctx.provider.authenticate(request);
  if (!auth) {
    const response = createErrorResponse(
      'UNAUTHORIZED',
      'Invalid or missing session',
      401
    );
    attachRequestId(response, requestId);
    return response;
  }

  let entitlements: BillingEntitlementsResponse;
  try {
    const services = await getRevenueCatBillingServices();
    entitlements = await services.getEntitlements(auth.userId);
  } catch (error) {
    const conflict =
      error instanceof Error && error.message === 'billing_customer_conflict';
    const response = createErrorResponse(
      conflict ? 'CONFLICT' : 'SERVICE_UNAVAILABLE',
      conflict
        ? 'Billing customer identity belongs to another account'
        : 'Billing entitlements are temporarily unavailable',
      conflict ? 409 : 503
    );
    attachRequestId(response, requestId);
    return response;
  }
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
