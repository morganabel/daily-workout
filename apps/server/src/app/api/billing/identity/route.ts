import {
  attachRequestId,
  createRequestContext,
} from '@leveza/server-core';
import {
  billingIdentityResponseSchema,
  type BillingIdentityResponse,
} from '@leveza/shared';
import { getAuthContext } from '@/lib/auth-context';
import { getRevenueCatBillingServices } from '@/lib/billing-services';
import { getBillingProvider } from '@/lib/deployment';
import { createErrorResponse } from '@/lib/errors';

export async function POST(request: Request): Promise<Response> {
  const { requestId, startedAt, log } = createRequestContext(
    request,
    'api.billing.identity'
  );

  if (getBillingProvider() !== 'revenuecat') {
    const response = createErrorResponse(
      'NOT_FOUND',
      'Billing identity is not enabled for this deployment',
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

  let identity: BillingIdentityResponse;
  try {
    const services = await getRevenueCatBillingServices();
    const canonical =
      await services.repository.getOrCreateCanonicalCustomerIdentity(
        auth.userId
      );
    identity = billingIdentityResponseSchema.parse({
      appUserId: canonical.externalCustomerId,
    });
  } catch (error) {
    const conflict =
      error instanceof Error && error.message === 'billing_customer_conflict';
    const response = createErrorResponse(
      conflict ? 'CONFLICT' : 'SERVICE_UNAVAILABLE',
      conflict
        ? 'Billing identity conflicts with another account'
        : 'Billing identity is temporarily unavailable',
      conflict ? 409 : 503
    );
    attachRequestId(response, requestId);
    return response;
  }

  const response = Response.json(identity);
  attachRequestId(response, requestId);
  log.info('request completed', {
    method: request.method,
    path: '/api/billing/identity',
    status: 200,
    durationMs: Date.now() - startedAt,
  });
  return response;
}
