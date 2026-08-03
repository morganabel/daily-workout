const openExerciseLibrary = jest.fn();
const createGenerateHandler = jest.fn();
const getRevenueCatBillingServices = jest.fn();

jest.mock('@workout-agent-ce/server-exercise-library', () => ({
  openExerciseLibrary,
}));

jest.mock('@workout-agent-ce/server-core', () => ({
  InMemoryGenerationStore: jest.fn(() => ({ name: 'store' })),
  NoOpUsagePolicy: jest.fn(() => ({ name: 'policy' })),
  NoOpMeteringSink: jest.fn(() => ({ name: 'metering' })),
  createGenerateHandler,
}));

jest.mock('@workout-agent-ce/server-ai', () => ({
  DefaultModelRouter: jest.fn(() => ({ name: 'router' })),
  DefaultStageOnePlanner: jest.fn(() => ({ name: 'planner' })),
}));

jest.mock('./auth-context', () => ({
  getAuthContext: jest.fn(() => ({ provider: { name: 'auth' } })),
}));

jest.mock('./billing-services', () => ({
  getRevenueCatBillingServices,
}));

describe('wiring lazy exercise library loading', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    delete process.env.DEPLOYMENT_MODE;
    delete process.env.BILLING_PROVIDER;

    createGenerateHandler.mockImplementation((deps) => {
      return async () => {
        const library = await deps.loadExerciseLibrary?.();
        return Response.json({ hasLibrary: Boolean(library) });
      };
    });
  });

  it('loads and caches the exercise library on demand', async () => {
    const library = { close: jest.fn() };
    openExerciseLibrary.mockReturnValue(library);

    const { generateHandler } = await import('./wiring');

    const firstResponse = await generateHandler(
      new Request('http://localhost/api/workouts/generate', { method: 'POST' }),
    );
    const secondResponse = await generateHandler(
      new Request('http://localhost/api/workouts/generate', { method: 'POST' }),
    );

    expect(await firstResponse.json()).toEqual({ hasLibrary: true });
    expect(await secondResponse.json()).toEqual({ hasLibrary: true });
    expect(openExerciseLibrary).toHaveBeenCalledTimes(1);
  });

  it('returns undefined after a lazy-load failure without throwing', async () => {
    const warnSpy = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    openExerciseLibrary.mockImplementation(() => {
      throw new Error('native binding unavailable');
    });

    const { generateHandler } = await import('./wiring');

    const firstResponse = await generateHandler(
      new Request('http://localhost/api/workouts/generate', { method: 'POST' }),
    );
    const secondResponse = await generateHandler(
      new Request('http://localhost/api/workouts/generate', { method: 'POST' }),
    );

    expect(await firstResponse.json()).toEqual({ hasLibrary: false });
    expect(await secondResponse.json()).toEqual({ hasLibrary: false });
    expect(openExerciseLibrary).toHaveBeenCalledTimes(1);
    expect(
      warnSpy.mock.calls.map((call) => String(call[0])).join(' '),
    ).toContain('native binding unavailable');

    warnSpy.mockRestore();
  });

  it('delegates hosted billing controls to durable services', async () => {
    process.env.DEPLOYMENT_MODE = 'hosted';
    process.env.BILLING_PROVIDER = 'revenuecat';
    const services = {
      usagePolicy: {
        reserveGenerate: jest.fn().mockResolvedValue({ allowed: true }),
        commitGenerateReservation: jest.fn(),
        rollbackGenerateReservation: jest.fn(),
      },
      admissionPolicy: {
        acquireProviderAdmission: jest.fn().mockResolvedValue({
          allowed: false,
          code: 'account_rate_limited',
        }),
        releaseProviderAdmission: jest.fn(),
      },
      spendCeilingPolicy: {
        checkSpendCeiling: jest.fn().mockResolvedValue({ allowed: true }),
      },
      meteringSink: { recordUsage: jest.fn() },
      getEntitlements: jest.fn(),
    };
    getRevenueCatBillingServices.mockResolvedValue(services);
    createGenerateHandler.mockImplementation((deps) => async () => {
      await deps.policy.reserveGenerate({
        accountId: 'user-1',
        operationId: 'operation-1',
        operation: 'generate',
      });
      await deps.admission.acquireProviderAdmission({
        accountId: 'user-1',
        operationId: 'operation-1',
      });
      await deps.spendCeiling.checkSpendCeiling({
        accountId: 'user-1',
        provider: 'openai',
        credentialSource: 'managed',
      });
      await deps.metering.recordUsage({ eventId: 'event-1' });
      return Response.json({ ok: true });
    });

    const { generateHandler } = await import('./wiring');
    const response = await generateHandler(
      new Request('http://localhost/api/workouts/generate', { method: 'POST' })
    );

    expect(response.status).toBe(200);
    expect(services.usagePolicy.reserveGenerate).toHaveBeenCalledTimes(1);
    expect(
      services.admissionPolicy.acquireProviderAdmission
    ).toHaveBeenCalledTimes(1);
    expect(
      services.spendCeilingPolicy.checkSpendCeiling
    ).toHaveBeenCalledTimes(1);
    expect(services.meteringSink.recordUsage).toHaveBeenCalledTimes(1);
  });
});
