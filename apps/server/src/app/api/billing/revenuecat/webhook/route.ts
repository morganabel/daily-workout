import {
  attachRequestId,
  createRequestContext,
} from '@workout-agent-ce/server-core';
import { createErrorResponse } from '@/lib/errors';
import { hostedBillingRuntime } from '@/lib/hosted-billing';
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
  const signature = request.headers.get('x-revenuecat-signature');

  return (
    authorization === `Bearer ${configuredSecret}` ||
    signature === configuredSecret
  );
};

export async function POST(request: Request): Promise<Response> {
  const { requestId, startedAt, log } = createRequestContext(
    request,
    'api.billing.revenuecat.webhook'
  );

  const configuredSecret = process.env.REVENUECAT_WEBHOOK_SECRET?.trim();
  const allowUnsignedWebhooks =
    process.env.REVENUECAT_ALLOW_UNSIGNED_WEBHOOKS === 'true';

  if (!configuredSecret && !allowUnsignedWebhooks) {
    const response = createErrorResponse(
      'SERVICE_UNAVAILABLE',
      'RevenueCat webhook secret is not configured',
      503
    );
    attachRequestId(response, requestId);
    return response;
  }

  if (!configuredSecret && allowUnsignedWebhooks) {
    log.warn('allowing unsigned RevenueCat webhook due to env override', {
      path: '/api/billing/revenuecat/webhook',
    });
  }

  if (configuredSecret && !hasValidWebhookSecret(request, configuredSecret)) {
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
      hostedBillingRuntime.domainConfig
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

  const result = await hostedBillingRuntime.applyRevenueCatWebhook(normalized);
  const status = result.outcome === 'applied' ? 200 : 202;

  const response = Response.json(
    {
      ok: true,
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
