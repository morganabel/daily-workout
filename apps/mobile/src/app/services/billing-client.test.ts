import {
  createBillingClient,
  customerInfoHasActiveEntitlement,
} from './billing-client';

describe('billing client adapter', () => {
  it('selects NoOpBillingClient when billing is disabled', async () => {
    const client = createBillingClient({
      enabled: false,
      showUpgradeUi: false,
      purchaseMethod: 'none',
      allowByok: true,
    });

    expect(client.type).toBe('noop');
    expect(await client.presentPaywall('OpenLift Pro')).toBe('not_presented');
  });

  it('selects RevenueCatBillingClient for iap billing capabilities', () => {
    const client = createBillingClient({
      enabled: true,
      showUpgradeUi: true,
      purchaseMethod: 'iap',
      allowByok: true,
    });

    expect(client.type).toBe('revenuecat');
  });

  it('detects active RevenueCat entitlements in customer info', () => {
    expect(
      customerInfoHasActiveEntitlement(
        {
          entitlements: {
            active: {
              'OpenLift Pro': {},
            },
          },
        } as never,
        'OpenLift Pro'
      )
    ).toBe(true);

    expect(
      customerInfoHasActiveEntitlement(
        {
          entitlements: { active: {} },
        } as never,
        'OpenLift Pro'
      )
    ).toBe(false);
  });
});
