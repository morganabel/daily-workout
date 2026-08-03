jest.mock('@/lib/hosted-billing', () => ({
  hostedBillingRuntime: {
    domainConfig: {
      allowedAppIds: new Set(['app.test']),
      allowedEnvironments: new Set(['SANDBOX', 'PRODUCTION']),
      allowedEntitlementIds: new Set(['OpenLift Pro']),
      allowedProductIds: new Set(['monthly']),
    },
    applyRevenueCatWebhook: jest.fn(),
  },
}));

import { POST } from './route';

const { hostedBillingRuntime } = jest.requireMock('@/lib/hosted-billing') as {
  hostedBillingRuntime: {
    domainConfig: {
      allowedAppIds: Set<string>;
      allowedEnvironments: Set<string>;
      allowedEntitlementIds: Set<string>;
      allowedProductIds: Set<string>;
    };
    applyRevenueCatWebhook: jest.Mock;
  };
};

function event(overrides: Record<string, unknown> = {}) {
  return {
    id: 'event-1',
    type: 'INITIAL_PURCHASE',
    event_timestamp_ms: Date.parse('2026-08-02T12:00:00.000Z'),
    app_id: 'app.test',
    environment: 'SANDBOX',
    app_user_id: 'rc-user-123',
    product_id: 'monthly',
    entitlement_ids: ['OpenLift Pro'],
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
    delete process.env.REVENUECAT_WEBHOOK_SECRET;
    delete process.env.REVENUECAT_ALLOW_UNSIGNED_WEBHOOKS;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('returns 503 when webhook secret is not configured', async () => {
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(hostedBillingRuntime.applyRevenueCatWebhook).not.toHaveBeenCalled();
  });

  it('rejects invalid webhook credentials', async () => {
    process.env.REVENUECAT_WEBHOOK_SECRET = 'top-secret';
    const response = await POST(request());
    expect(response.status).toBe(401);
    expect(hostedBillingRuntime.applyRevenueCatWebhook).not.toHaveBeenCalled();
  });

  it('rejects missing identity and timestamp fields before domain processing', async () => {
    process.env.REVENUECAT_WEBHOOK_SECRET = 'top-secret';
    const response = await POST(
      request(
        { Authorization: 'Bearer top-secret' },
        { event: { type: 'INITIAL_PURCHASE' } }
      )
    );
    expect(response.status).toBe(400);
    expect(hostedBillingRuntime.applyRevenueCatWebhook).not.toHaveBeenCalled();
  });

  it('rejects events outside configured billing scope', async () => {
    process.env.REVENUECAT_WEBHOOK_SECRET = 'top-secret';
    const response = await POST(
      request(
        { Authorization: 'Bearer top-secret' },
        { event: event({ app_id: 'other-app' }) }
      )
    );
    expect(response.status).toBe(400);
    expect(hostedBillingRuntime.applyRevenueCatWebhook).not.toHaveBeenCalled();
  });

  it('normalizes and applies a valid event', async () => {
    process.env.REVENUECAT_WEBHOOK_SECRET = 'top-secret';
    hostedBillingRuntime.applyRevenueCatWebhook.mockResolvedValue({
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
    expect(hostedBillingRuntime.applyRevenueCatWebhook).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: 'event-1',
        kind: 'grant',
        appId: 'app.test',
        customerIds: ['rc-user-123'],
      })
    );
  });

  it('acknowledges an unmapped valid event without granting access', async () => {
    process.env.REVENUECAT_WEBHOOK_SECRET = 'top-secret';
    hostedBillingRuntime.applyRevenueCatWebhook.mockResolvedValue({
      outcome: 'unmapped',
    });
    const response = await POST(
      request({ Authorization: 'Bearer top-secret' })
    );
    const data = (await response.json()) as { outcome: string };

    expect(response.status).toBe(202);
    expect(data.outcome).toBe('unmapped');
  });
});
