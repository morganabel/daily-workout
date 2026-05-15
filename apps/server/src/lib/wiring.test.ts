const openExerciseLibrary = jest.fn();
const createGenerateHandler = jest.fn();

jest.mock('@workout-agent-ce/server-exercise-library', () => ({
  openExerciseLibrary,
}));

jest.mock('@workout-agent-ce/server-core', () => ({
  InMemoryGenerationStore: jest.fn(() => ({ name: 'store' })),
  NoOpUsagePolicy: jest.fn(() => ({ name: 'policy' })),
  NoOpMeteringSink: jest.fn(() => ({ name: 'metering' })),
  createGenerateHandler,
  createLogWorkoutHandler: jest.fn(() => jest.fn()),
}));

jest.mock('@workout-agent-ce/server-ai', () => ({
  DefaultModelRouter: jest.fn(() => ({ name: 'router' })),
  DefaultStageOnePlanner: jest.fn(() => ({ name: 'planner' })),
}));

jest.mock('./auth-context', () => ({
  getAuthContext: jest.fn(() => ({ provider: { name: 'auth' } })),
}));

describe('wiring lazy exercise library loading', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

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
});
