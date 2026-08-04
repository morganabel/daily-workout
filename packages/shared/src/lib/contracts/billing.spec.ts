import {
  billingEntitlementsResponseSchema,
  createBillingCapabilities,
  resolveBillingCapabilities,
} from './billing';
import { apiErrorSchema } from './api-errors';

describe('billing contracts', () => {
  it('creates safe billing defaults', () => {
    expect(createBillingCapabilities()).toEqual({
      enabled: false,
      showUpgradeUi: false,
      purchaseMethod: 'none',
      allowByok: true,
    });
  });

  it('resolves null/undefined billing capabilities as billing-disabled', () => {
    expect(resolveBillingCapabilities(undefined).enabled).toBe(false);
    expect(resolveBillingCapabilities(null).purchaseMethod).toBe('none');
  });

  it('parses hosted entitlement payload shape', () => {
    const parsed = billingEntitlementsResponseSchema.parse({
      planId: 'pro',
      entitlementId: 'OpenLift Pro',
      status: 'active',
      willRenew: true,
      paidThrough: '2026-09-01T00:00:00.000Z',
      graceThrough: null,
      quotaWindow: {
        startsAt: '2026-01-01T00:00:00.000Z',
        endsAt: '2026-02-01T00:00:00.000Z',
        limit: 100,
        used: 20,
        remaining: 80,
      },
      refreshedAt: '2026-01-10T00:00:00.000Z',
    });

    expect(parsed.status).toBe('active');
    expect(parsed.quotaWindow.remaining).toBe(80);
  });

  it('parses quota errors with optional upgrade metadata', () => {
    const parsed = apiErrorSchema.parse({
      code: 'QUOTA_EXCEEDED',
      message: 'Quota exceeded for this billing window',
      upgrade: {
        showUpgradeUi: true,
        purchaseMethod: 'iap',
        entitlementId: 'OpenLift Pro',
        productIds: ['weekly', 'monthly', 'yearly'],
      },
    });

    expect(parsed.upgrade?.purchaseMethod).toBe('iap');
    expect(parsed.upgrade?.productIds).toEqual(['weekly', 'monthly', 'yearly']);
  });

  it('parses service unavailable errors', () => {
    const parsed = apiErrorSchema.parse({
      code: 'SERVICE_UNAVAILABLE',
      message: 'Billing backend unavailable',
    });

    expect(parsed.code).toBe('SERVICE_UNAVAILABLE');
  });
});
