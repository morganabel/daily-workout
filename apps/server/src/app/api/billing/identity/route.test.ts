jest.mock('@/lib/auth-context', () => ({
  getAuthContext: jest.fn(),
}));
jest.mock('@/lib/billing-services', () => ({
  getRevenueCatBillingServices: jest.fn(),
}));
jest.mock('@/lib/deployment', () => ({
  getBillingProvider: jest.fn(),
}));

import { getAuthContext } from '@/lib/auth-context';
import { getRevenueCatBillingServices } from '@/lib/billing-services';
import { getBillingProvider } from '@/lib/deployment';
import { POST } from './route';

const mockedGetAuthContext = getAuthContext as jest.Mock;
const mockedGetBillingServices = getRevenueCatBillingServices as jest.Mock;
const mockedGetBillingProvider = getBillingProvider as jest.Mock;
const getOrCreateCanonicalCustomerIdentity = jest.fn();

describe('POST /api/billing/identity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetBillingProvider.mockReturnValue('revenuecat');
    mockedGetAuthContext.mockResolvedValue({
      provider: {
        authenticate: jest.fn().mockResolvedValue({ userId: 'user-123' }),
      },
    });
    mockedGetBillingServices.mockResolvedValue({
      repository: { getOrCreateCanonicalCustomerIdentity },
    });
    getOrCreateCanonicalCustomerIdentity.mockResolvedValue({
      accountId: 'user-123',
      externalCustomerId: 'wa_1234567890ab7def8abc1234567890ab',
    });
  });

  it('returns the server-owned identity without accepting a client identity', async () => {
    const response = await POST(
      new Request('http://localhost/api/billing/identity', {
        method: 'POST',
        headers: {
          'x-revenuecat-app-user-id': '$RCAnonymousID:attacker-chosen',
        },
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      appUserId: 'wa_1234567890ab7def8abc1234567890ab',
    });
    expect(getOrCreateCanonicalCustomerIdentity).toHaveBeenCalledWith(
      'user-123'
    );
    expect(getOrCreateCanonicalCustomerIdentity).toHaveBeenCalledTimes(1);
  });

  it('requires authentication', async () => {
    mockedGetAuthContext.mockResolvedValue({
      provider: { authenticate: jest.fn().mockResolvedValue(null) },
    });

    const response = await POST(
      new Request('http://localhost/api/billing/identity', { method: 'POST' })
    );

    expect(response.status).toBe(401);
    expect(getOrCreateCanonicalCustomerIdentity).not.toHaveBeenCalled();
  });

  it('is unavailable when RevenueCat billing is disabled', async () => {
    mockedGetBillingProvider.mockReturnValue('none');

    const response = await POST(
      new Request('http://localhost/api/billing/identity', { method: 'POST' })
    );

    expect(response.status).toBe(404);
    expect(mockedGetAuthContext).not.toHaveBeenCalled();
  });
});
