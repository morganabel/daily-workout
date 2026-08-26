import {
  createBetterAuthMetaResponse,
  createStubMetaResponse,
  metaResponseSchema,
} from './meta';
import {
  createBillingCapabilities,
  resolveBillingCapabilities,
} from './billing';

describe('meta contract billing compatibility', () => {
  it('parses legacy responses without billing and resolves billing-disabled defaults', () => {
    const parsed = metaResponseSchema.parse({
      protocolVersion: '1.0.0',
      auth: {
        enabled: true,
        methods: ['anonymous', 'email'],
        anonymousAvailable: true,
        emailAvailable: true,
      },
      edition: 'CE',
    });

    const billing = resolveBillingCapabilities(parsed.billing);
    expect(billing.enabled).toBe(false);
    expect(billing.showUpgradeUi).toBe(false);
    expect(billing.purchaseMethod).toBe('none');
    expect(billing.allowByok).toBe(true);
  });

  it('includes explicit billing-disabled defaults in CE factory responses', () => {
    const response = createStubMetaResponse('1.0.0');

    expect(response.billing).toEqual({
      enabled: false,
      showUpgradeUi: false,
      purchaseMethod: 'none',
      allowByok: true,
    });
  });

  it('supports explicit hosted billing capability wiring', () => {
    const response = createBetterAuthMetaResponse(
      '1.0.0',
      'HOSTED',
      createBillingCapabilities({
        enabled: true,
        showUpgradeUi: true,
        purchaseMethod: 'iap',
      })
    );

    const parsed = metaResponseSchema.parse(response);
    expect(parsed.billing?.enabled).toBe(true);
    expect(parsed.billing?.showUpgradeUi).toBe(true);
    expect(parsed.billing?.purchaseMethod).toBe('iap');
  });

  it('defaults Google capability to unavailable for legacy responses', () => {
    const response = createBetterAuthMetaResponse('1.0.0');

    expect(response.auth.googleAvailable).toBe(false);
    expect(
      metaResponseSchema.parse({
        ...response,
        auth: {
          ...response.auth,
          googleAvailable: undefined,
        },
      }).auth.googleAvailable
    ).toBe(false);
  });
});
