import {
  attachRequestId,
  createRequestContext,
} from '@leveza/server-core';
import type { EntitlementProcessorOutcome } from '@leveza/quotas';
import { getBillingConfig } from '@/lib/billing-config';
import { getRevenueCatBillingServices } from '@/lib/billing-services';
import { getBillingProvider } from '@/lib/deployment';
import { createErrorResponse } from '@/lib/errors';
import {
  normalizeRevenueCatEvent,
  RevenueCatNormalizationError,
  revenueCatWebhookSchema,
} from '@/lib/revenuecat';

const hasValidWebhookSecret = (
  request: Request,
  configuredSecret: string
): boolean => {
  const authorization = request.headers.get('authorization');
  return authorization === `Bearer ${configuredSecret}`;
};

export async function POST(request: Request): Promise<Response> {
  const { requestId, startedAt, log } = createRequestContext(
    request,
    'api.billing.revenuecat.webhook'
  );

  if (getBillingProvider() !== 'revenuecat') {
    const response = createErrorResponse(
      'NOT_FOUND',
      'RevenueCat billing is not enabled for this deployment',
      404
    );
    attachRequestId(response, requestId);
    return response;
  }

  const billingConfig = getBillingConfig();
  if (billingConfig.provider !== 'revenuecat') {
    throw new Error('billing_provider_disabled');
  }

  if (!hasValidWebhookSecret(request, billingConfig.webhookSecret)) {
    const response = createErrorResponse(
      'UNAUTHORIZED',
      'Invalid webhook credentials',
      401
    );
    attachRequestId(response, requestId);
    return response;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    const response = createErrorResponse(
      'VALIDATION_ERROR',
      'Invalid JSON payload',
      400
    );
    attachRequestId(response, requestId);
    return response;
  }

  const parsed = revenueCatWebhookSchema.safeParse(body);
  if (!parsed.success) {
    const response = createErrorResponse(
      'VALIDATION_ERROR',
      'Invalid RevenueCat webhook payload',
      400
    );
    attachRequestId(response, requestId);
    return response;
  }

  let normalized: ReturnType<typeof normalizeRevenueCatEvent>;
  try {
    normalized = normalizeRevenueCatEvent(
      parsed.data.event,
      billingConfig.domainConfig
    );
  } catch (error) {
    const response = createErrorResponse(
      'VALIDATION_ERROR',
      error instanceof RevenueCatNormalizationError
        ? 'RevenueCat event is incomplete or outside configured billing scope'
        : 'Invalid RevenueCat webhook payload',
      400
    );
    attachRequestId(response, requestId);
    return response;
  }

  let result: { outcome: EntitlementProcessorOutcome; accountId?: string };
  try {
    const services = await getRevenueCatBillingServices();
    result = await services.repository.process(normalized);
  } catch {
    const response = createErrorResponse(
      'SERVICE_UNAVAILABLE',
      'Billing repository is temporarily unavailable',
      503
    );
    attachRequestId(response, requestId);
    return response;
  }
  const status =
    result.outcome === 'applied'
      ? 200
      : result.outcome === 'conflict'
      ? 409
      : 202;

  const response = Response.json(
    {
      ok: result.outcome !== 'conflict',
      applied: result.outcome === 'applied',
      outcome: result.outcome,
      eventType: parsed.data.event.type,
    },
    { status }
  );

  attachRequestId(response, requestId);
  log.info('request completed', {
    method: request.method,
    path: '/api/billing/revenuecat/webhook',
    status,
    durationMs: Date.now() - startedAt,
    eventType: parsed.data.event.type,
    outcome: result.outcome,
  });
  return response;
}
