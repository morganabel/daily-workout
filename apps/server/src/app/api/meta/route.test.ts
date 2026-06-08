jest.mock('@/lib/auth-context', () => ({
  getAuthContext: jest.fn(),
}));

import { GET } from './route';

const { getAuthContext } = jest.requireMock('@/lib/auth-context') as {
  getAuthContext: jest.Mock;
};

const mockGetAuthContext = getAuthContext;

describe('GET /api/meta', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.EDITION;
    delete process.env.HOSTED_BILLING_ENABLED;
    delete process.env.HOSTED_SHOW_UPGRADE_UI;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('returns billing-disabled defaults in CE mode', async () => {
    mockGetAuthContext.mockReturnValue({
      mode: 'stub',
      provider: { authenticate: jest.fn() },
      auth: null,
      db: null,
    });

    const request = new Request('http://localhost:3000/api/meta');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.edition).toBe('CE');
    expect(data.billing.enabled).toBe(false);
    expect(data.billing.showUpgradeUi).toBe(false);
    expect(data.billing.purchaseMethod).toBe('none');
  });

  it('returns hosted billing capabilities when enabled in env', async () => {
    process.env.EDITION = 'HOSTED';
    process.env.HOSTED_BILLING_ENABLED = 'true';

    mockGetAuthContext.mockReturnValue({
      mode: 'better-auth',
      provider: { authenticate: jest.fn() },
      auth: null,
      db: null,
    });

    const request = new Request('http://localhost:3000/api/meta');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.edition).toBe('HOSTED');
    expect(data.billing.enabled).toBe(true);
    expect(data.billing.showUpgradeUi).toBe(true);
    expect(data.billing.purchaseMethod).toBe('iap');
    expect(data.billing.allowByok).toBe(true);
  });
});
