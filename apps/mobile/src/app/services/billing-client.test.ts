import { createBillingClient } from './billing-client';

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
});
