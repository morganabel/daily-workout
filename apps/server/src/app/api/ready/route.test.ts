jest.mock('@/lib/auth-context', () => ({
  getAuthContext: jest.fn(),
}));

jest.mock('@workout-agent-ce/server-db', () => ({
  ping: jest.fn(),
}));

jest.mock('@/lib/billing-services', () => ({
  getRevenueCatBillingServices: jest.fn(),
}));

import { GET } from './route';

const { getAuthContext } = jest.requireMock('@/lib/auth-context') as {
  getAuthContext: jest.Mock;
};
const { ping } = jest.requireMock('@workout-agent-ce/server-db') as {
  ping: jest.Mock;
};
const { getRevenueCatBillingServices } = jest.requireMock(
  '@/lib/billing-services'
) as {
  getRevenueCatBillingServices: jest.Mock;
};
const checkHealth = jest.fn();

describe('GET /api/ready', () => {
  const originalEnv = process.env;
  let consoleErrorSpy: jest.SpiedFunction<typeof console.error>;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    process.env = { ...originalEnv };
    delete process.env.DEPLOYMENT_MODE;
    delete process.env.BILLING_PROVIDER;
    getRevenueCatBillingServices.mockResolvedValue({
      repository: { checkHealth },
    });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('returns ready and pings the database when one is configured', async () => {
    getAuthContext.mockResolvedValue({ mode: 'better-auth', db: { name: 'db' } });
    ping.mockResolvedValue(undefined);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe('ready');
    expect(data.database).toBe('connected');
    expect(ping).toHaveBeenCalledTimes(1);
  });

  it('returns ready without pinging when there is no database (stub mode)', async () => {
    getAuthContext.mockResolvedValue({ mode: 'stub', db: null });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.database).toBe('not-configured');
    expect(ping).not.toHaveBeenCalled();
  });

  it('returns 503 when the database is unreachable', async () => {
    getAuthContext.mockResolvedValue({ mode: 'better-auth', db: { name: 'db' } });
    ping.mockRejectedValue(new Error('connection refused'));

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.status).toBe('not-ready');
    expect(data.error).toContain('connection refused');
  });

  it('redacts readiness errors in production responses', async () => {
    process.env.NODE_ENV = 'production';
    getAuthContext.mockResolvedValue({ mode: 'better-auth', db: { name: 'db' } });
    ping.mockRejectedValue(new Error('connection refused'));

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.status).toBe('not-ready');
    expect(data.error).toBe('Readiness check failed');
  });

  it('returns 503 when the auth context fails to initialize', async () => {
    getAuthContext.mockRejectedValue(new Error('DATABASE_URL is required'));

    const response = await GET();

    expect(response.status).toBe(503);
  });

  it('checks billing schema health when RevenueCat is enabled', async () => {
    process.env.DEPLOYMENT_MODE = 'hosted';
    process.env.BILLING_PROVIDER = 'revenuecat';
    getAuthContext.mockResolvedValue({ mode: 'better-auth', db: { name: 'db' } });
    ping.mockResolvedValue(undefined);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.billing).toBe('connected');
    expect(checkHealth).toHaveBeenCalledTimes(1);
  });

  it('returns 503 when billing schema health fails', async () => {
    process.env.DEPLOYMENT_MODE = 'hosted';
    process.env.BILLING_PROVIDER = 'revenuecat';
    getAuthContext.mockResolvedValue({ mode: 'better-auth', db: { name: 'db' } });
    ping.mockResolvedValue(undefined);
    checkHealth.mockRejectedValue(new Error('billing schema unavailable'));

    const response = await GET();
    expect(response.status).toBe(503);
  });
});
