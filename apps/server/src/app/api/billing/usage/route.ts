import { getAiUsageSummary } from '@workout-agent-ce/server-db';
import { billingAiUsageResponseSchema } from '@workout-agent/shared';
import {
  attachRequestId,
  createRequestContext,
} from '@workout-agent-ce/server-core';

import { getAuthContext } from '@/lib/auth-context';
import { getRevenueCatBillingServices } from '@/lib/billing-services';
import { getBillingProvider } from '@/lib/deployment';
import { createErrorResponse } from '@/lib/errors';

export async function GET(request: Request): Promise<Response> {
  const { requestId, startedAt, log } = createRequestContext(
    request,
    'api.billing.usage'
  );

  if (getBillingProvider() !== 'revenuecat') {
    const response = createErrorResponse(
      'NOT_FOUND',
      'AI usage accounting is not enabled for this deployment',
      404
    );
    attachRequestId(response, requestId);
    return response;
  }

  const context = await getAuthContext();
  const auth = await context.provider.authenticate(request);
  if (!auth) {
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
      'SERVICE_UNAVAILABLE',
      'AI usage accounting is unavailable',
      503
    );
    attachRequestId(response, requestId);
    return response;
  }

  let entitlements;
  try {
    const billing = await getRevenueCatBillingServices();
    await billing.repository.bootstrapAuthenticatedCustomer({
      accountId: auth.userId,
      externalCustomerId: auth.userId,
    });
    entitlements = await billing.getEntitlements(auth.userId);
  } catch {
    const response = createErrorResponse(
      'SERVICE_UNAVAILABLE',
      'AI usage accounting is unavailable',
      503
    );
    attachRequestId(response, requestId);
    return response;
  }
  const summary = await getAiUsageSummary(context.db, {
    userId: auth.userId,
    startsAt: new Date(entitlements.quotaWindow.startsAt),
    endsAt: new Date(entitlements.quotaWindow.endsAt),
  });
  const validated = billingAiUsageResponseSchema.parse(summary);
  const response = Response.json(validated);
  attachRequestId(response, requestId);
  log.info('request completed', {
    method: request.method,
    path: '/api/billing/usage',
    status: 200,
    durationMs: Date.now() - startedAt,
    requestCount: validated.totals.requestCount,
  });
  return response;
}
