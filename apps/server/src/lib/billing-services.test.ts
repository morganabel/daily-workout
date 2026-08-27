jest.mock('./auth-context', () => ({
  getAuthContext: jest.fn(),
}));

import type { EntitlementProjection } from '@leveza/quotas';

import {
  configuredPricingAvailable,
  includedGenerationLimitFor,
  quotaUpgradeMetadata,
} from './billing-services';

const config = {
  freeGenerationLimit: 25,
  proGenerationLimit: 1_000,
};

const entitlement = (
  status: EntitlementProjection['status']
): EntitlementProjection => ({
  accountId: 'account-1',
  planId: 'pro',
  entitlementId: 'Leveza Pro',
  productId: 'monthly',
  status,
  willRenew: status !== 'inactive',
  paidThrough: '2026-09-03T00:00:00.000Z',
  graceThrough: null,
  lastEventTimestamp: '2026-08-03T00:00:00.000Z',
  lastEventId: 'event-1',
});

describe('included generation limits', () => {
  it('uses the paid limit only while the Pro entitlement is effective', () => {
    expect(includedGenerationLimitFor(config, entitlement('active'))).toBe(
      1_000
    );
    expect(
      includedGenerationLimitFor(config, entitlement('grace_period'))
    ).toBe(1_000);
    expect(includedGenerationLimitFor(config, entitlement('past_due'))).toBe(
      1_000
    );
    expect(includedGenerationLimitFor(config, entitlement('inactive'))).toBe(
      25
    );
    expect(includedGenerationLimitFor(config, null)).toBe(25);
  });

  it('accepts catalog-priced Vertex models and provider-priced OpenRouter', () => {
    expect(configuredPricingAvailable('gemini', 'vertex')).toBe(true);
    expect(configuredPricingAvailable('openrouter', 'managed')).toBe(true);
  });

  it('fails closed when a configured catalog model has no price', () => {
    const previous = process.env.GEMINI_MODEL;
    process.env.GEMINI_MODEL = 'unpriced-model';
    try {
      expect(configuredPricingAvailable('gemini', 'managed')).toBe(false);
    } finally {
      if (previous === undefined) delete process.env.GEMINI_MODEL;
      else process.env.GEMINI_MODEL = previous;
    }
  });

  it('suppresses purchase metadata when upgrade UI is disabled', () => {
    expect(
      quotaUpgradeMetadata({
        showUpgradeUi: false,
        upgradeEntitlementId: 'pro',
        domainConfig: {
          allowedAppIds: new Set(['app.test']),
          allowedEnvironments: new Set(['SANDBOX']),
          allowedEntitlementIds: new Set(['pro']),
          allowedProductIds: new Set(['monthly']),
        },
      })
    ).toStrictEqual({ showUpgradeUi: false, purchaseMethod: 'none' });
  });

  it('uses the explicitly configured entitlement in upgrade metadata', () => {
    expect(
      quotaUpgradeMetadata({
        showUpgradeUi: true,
        upgradeEntitlementId: 'pro',
        domainConfig: {
          allowedAppIds: new Set(['app.test']),
          allowedEnvironments: new Set(['SANDBOX']),
          allowedEntitlementIds: new Set(['legacy', 'pro']),
          allowedProductIds: new Set(['monthly']),
        },
      })
    ).toStrictEqual({
      showUpgradeUi: true,
      purchaseMethod: 'iap',
      entitlementId: 'pro',
      productIds: ['monthly'],
    });
  });

  it('includes a configured offering in upgrade metadata', () => {
    expect(
      quotaUpgradeMetadata({
        showUpgradeUi: true,
        upgradeEntitlementId: 'pro',
        defaultOfferingId: 'default',
        domainConfig: {
          allowedAppIds: new Set(['app.test']),
          allowedEnvironments: new Set(['SANDBOX']),
          allowedEntitlementIds: new Set(['pro']),
          allowedProductIds: new Set(['monthly']),
        },
      })
    ).toStrictEqual({
      showUpgradeUi: true,
      purchaseMethod: 'iap',
      entitlementId: 'pro',
      offeringId: 'default',
      productIds: ['monthly'],
    });
  });
});
