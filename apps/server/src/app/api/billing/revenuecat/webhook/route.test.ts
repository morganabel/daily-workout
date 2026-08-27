jest.mock('@/lib/billing-config', () => ({
  getBillingConfig: jest.fn(() => ({
    provider: 'revenuecat',
    webhookSecret: 'top-secret',
    domainConfig: {
      allowedAppIds: new Set(['app.test']),
      allowedEnvironments: new Set(['SANDBOX', 'PRODUCTION']),
      allowedEntitlementIds: new Set(['Leveza Pro']),
      allowedProductIds: new Set(['monthly']),
    },
  })),
}));

jest.mock('@/lib/billing-services', () => ({
  getRevenueCatBillingServices: jest.fn(),
}));

import { POST } from './route';

const { getRevenueCatBillingServices } = jest.requireMock(
  '@/lib/billing-services'
) as {
  getRevenueCatBillingServices: jest.Mock;
};
const processWebhook = jest.fn();

function event(overrides: Record<string, unknown> = {}) {
  return {
    id: 'event-1',
    type: 'INITIAL_PURCHASE',
    event_timestamp_ms: Date.parse('2026-08-02T12:00:00.000Z'),
    app_id: 'app.test',
    environment: 'SANDBOX',
    app_user_id: 'rc-user-123',
    product_id: 'monthly',
    entitlement_ids: ['Leveza Pro'],
    expiration_at_ms: Date.parse('2026-09-02T12:00:00.000Z'),
    ...overrides,
  };
}

function request(
  headers: Record<string, string> = {},
  body: unknown = { event: event() }
) {
  return new Request('http://localhost/api/billing/revenuecat/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

describe('POST /api/billing/revenuecat/webhook', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.DEPLOYMENT_MODE = 'hosted';
    process.env.BILLING_PROVIDER = 'revenuecat';
    getRevenueCatBillingServices.mockResolvedValue({
      repository: { process: processWebhook },
    });
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('rejects the route before parsing when RevenueCat is disabled', async () => {
    process.env.BILLING_PROVIDER = 'none';
    const response = await POST(request());
    expect(response.status).toBe(404);
    expect(processWebhook).not.toHaveBeenCalled();
  });

  it('rejects invalid webhook credentials', async () => {
    const response = await POST(request());
    expect(response.status).toBe(401);
    expect(processWebhook).not.toHaveBeenCalled();
  });

  it('rejects the removed custom signature header', async () => {
    const response = await POST(
      request({ 'x-revenuecat-signature': 'top-secret' })
    );
    expect(response.status).toBe(401);
    expect(processWebhook).not.toHaveBeenCalled();
  });

  it('rejects missing identity and timestamp fields before domain processing', async () => {
    const response = await POST(
      request(
        { Authorization: 'Bearer top-secret' },
        { event: { type: 'INITIAL_PURCHASE' } }
      )
    );
    expect(response.status).toBe(400);
    expect(processWebhook).not.toHaveBeenCalled();
  });

  it('rejects events outside configured billing scope', async () => {
    const response = await POST(
      request(
        { Authorization: 'Bearer top-secret' },
        { event: event({ app_id: 'other-app' }) }
      )
    );
    expect(response.status).toBe(400);
    expect(processWebhook).not.toHaveBeenCalled();
  });

  it('normalizes and applies a valid event', async () => {
    processWebhook.mockResolvedValue({
      outcome: 'applied',
      accountId: 'user-123',
    });
    const response = await POST(
      request({ Authorization: 'Bearer top-secret' })
    );
    const data = (await response.json()) as {
      ok: boolean;
      applied: boolean;
      outcome: string;
    };

    expect(response.status).toBe(200);
    expect(data).toMatchObject({ ok: true, applied: true, outcome: 'applied' });
    expect(processWebhook).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: 'event-1',
        kind: 'grant',
        appId: 'app.test',
        customerIds: ['rc-user-123'],
      })
    );
  });

  it('acknowledges an unmapped valid event without granting access', async () => {
    processWebhook.mockResolvedValue({
      outcome: 'unmapped',
    });
    const response = await POST(
      request({ Authorization: 'Bearer top-secret' })
    );
    const data = (await response.json()) as { outcome: string };

    expect(response.status).toBe(202);
    expect(data.outcome).toBe('unmapped');
  });

  it('rejects a conflicting duplicate', async () => {
    processWebhook.mockResolvedValue({ outcome: 'conflict' });
    const response = await POST(
      request({ Authorization: 'Bearer top-secret' })
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      ok: false,
      outcome: 'conflict',
    });
  });

  it('returns 503 when the durable repository is unavailable', async () => {
    processWebhook.mockRejectedValue(new Error('connection failed'));
    const response = await POST(
      request({ Authorization: 'Bearer top-secret' })
    );
    expect(response.status).toBe(503);
  });
});
