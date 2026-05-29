jest.mock('@/lib/hosted-billing', () => ({
  hostedBillingRuntime: {
    applyRevenueCatWebhook: jest.fn(),
  },
}));

import { POST } from './route';

const { hostedBillingRuntime } = jest.requireMock('@/lib/hosted-billing') as {
  hostedBillingRuntime: {
    applyRevenueCatWebhook: jest.Mock;
  };
};

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
    const response = await POST(
      new Request('http://localhost/api/billing/revenuecat/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: { type: 'INITIAL_PURCHASE' } }),
      })
    );
    const payload = (await response.json()) as { code?: string };

    expect(response.status).toBe(503);
    expect(payload.code).toBe('SERVICE_UNAVAILABLE');
    expect(hostedBillingRuntime.applyRevenueCatWebhook).not.toHaveBeenCalled();
  });

  it('rejects invalid webhook credentials when secret is configured', async () => {
    process.env.REVENUECAT_WEBHOOK_SECRET = 'top-secret';

    const response = await POST(
      new Request('http://localhost/api/billing/revenuecat/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: { type: 'INITIAL_PURCHASE' } }),
      })
    );

    expect(response.status).toBe(401);
    expect(hostedBillingRuntime.applyRevenueCatWebhook).not.toHaveBeenCalled();
  });

  it('allows unsigned webhook requests when explicit override is enabled', async () => {
    process.env.REVENUECAT_ALLOW_UNSIGNED_WEBHOOKS = 'true';
    hostedBillingRuntime.applyRevenueCatWebhook.mockReturnValue({
      applied: true,
      userId: 'user-123',
    });

    const response = await POST(
      new Request('http://localhost/api/billing/revenuecat/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: {
            type: 'INITIAL_PURCHASE',
            app_user_id: 'user-123',
            product_id: 'monthly',
          },
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(hostedBillingRuntime.applyRevenueCatWebhook).toHaveBeenCalledTimes(
      1
    );
  });

  it('applies valid webhook events and returns success', async () => {
    process.env.REVENUECAT_WEBHOOK_SECRET = 'top-secret';
    hostedBillingRuntime.applyRevenueCatWebhook.mockReturnValue({
      applied: true,
      userId: 'user-123',
    });

    const response = await POST(
      new Request('http://localhost/api/billing/revenuecat/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer top-secret',
        },
        body: JSON.stringify({
          event: {
            type: 'INITIAL_PURCHASE',
            app_user_id: 'user-123',
            product_id: 'monthly',
          },
        }),
      })
    );

    const data = (await response.json()) as {
      ok: boolean;
      applied: boolean;
      userId?: string;
    };

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.applied).toBe(true);
    expect(data.userId).toBe('user-123');
    expect(hostedBillingRuntime.applyRevenueCatWebhook).toHaveBeenCalledTimes(
      1
    );
  });
});
