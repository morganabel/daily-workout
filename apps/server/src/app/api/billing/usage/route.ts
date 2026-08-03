import { usdToNanoUsd } from '@workout-agent-ce/metering';
import { getAiUsageSummary } from '@workout-agent-ce/server-db';
import {
  billingAiUsageResponseSchema,
  type BillingEntitlementsResponse,
} from '@workout-agent/shared';
import {
  attachRequestId,
  createRequestContext,
} from '@workout-agent-ce/server-core';

import { getAuthContext } from '@/lib/auth-context';
import { isBillingEnabled } from '@/lib/deployment';
import { createErrorResponse } from '@/lib/errors';
import { usagePolicy } from '@/lib/wiring';

function resolveShadowBudgetNanoUsd(planId: string | null): string | undefined {
  const raw =
    planId === 'pro'
      ? process.env.HOSTED_PRO_AI_COST_BUDGET_USD
      : process.env.HOSTED_FREE_AI_COST_BUDGET_USD;
  if (!raw) {
    return undefined;
  }
  return usdToNanoUsd(Number(raw));
}

export async function GET(request: Request): Promise<Response> {
  const { requestId, startedAt, log } = createRequestContext(
    request,
    'api.billing.usage'
  );

  if (!isBillingEnabled()) {
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

  if (!context.db || !usagePolicy.getEntitlements) {
    const response = createErrorResponse(
      'SERVICE_UNAVAILABLE',
      'AI usage accounting is unavailable',
      503
    );
    attachRequestId(response, requestId);
    return response;
  }

  const entitlements = (await usagePolicy.getEntitlements(
    auth.userId
  )) as BillingEntitlementsResponse;
  const summary = await getAiUsageSummary(context.db, {
    userId: auth.userId,
    startsAt: new Date(entitlements.quotaWindow.startsAt),
    endsAt: new Date(entitlements.quotaWindow.endsAt),
    shadowBudgetNanoUsd: resolveShadowBudgetNanoUsd(entitlements.planId),
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
