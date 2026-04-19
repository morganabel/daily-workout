import {
  createGenerationContextMock,
  createTodayPlanMock,
  type GenerationContext,
  type GenerationRequest,
  type GenerationRequestPayload,
  type TodayPlan,
} from '@workout-agent/shared';
import type { ExerciseLibrary } from '@workout-agent-ce/server-exercise-library';

import { createGenerateHandler } from './generate';
import type {
  AuthProvider,
  AuthResult,
  GenerationStore,
  GenerationState,
  MeteringSink,
  ModelRouter,
  StageOnePlanner,
  UsagePolicy,
} from '../types';

function createRequest(
  body: unknown,
  headers: Record<string, string> = {},
): Request {
  return new Request('http://localhost/api/workouts/generate', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: 'Bearer test-token',
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

function createInvalidJsonRequest(): Request {
  return new Request('http://localhost/api/workouts/generate', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: 'Bearer test-token',
    },
    body: '{',
  });
}

function createAuthResult(): AuthResult {
  return {
    userId: 'user-123',
    principalId: 'device-123',
  };
}

function createStoreMock(
  plan: TodayPlan | null = null,
): jest.Mocked<GenerationStore> {
  return {
    getState: jest.fn().mockResolvedValue({
      plan,
      generationStatus: { state: 'idle', submittedAt: null },
    } satisfies GenerationState),
    markPending: jest.fn().mockResolvedValue(undefined),
    persistPlan: jest.fn().mockResolvedValue(undefined),
    setError: jest.fn().mockResolvedValue(undefined),
    clearPlan: jest.fn().mockResolvedValue(undefined),
  };
}

function createRouterMock(
  plan = createTodayPlanMock(),
): jest.Mocked<ModelRouter> {
  return {
    generate: jest.fn().mockResolvedValue({
      plan,
      responseId: 'resp-123',
      schemaVersion: 'v2-flat',
    }),
    isSupportedProvider: jest
      .fn()
      .mockImplementation((provider: string) =>
        ['openai', 'gemini'].includes(provider),
      ),
    getDefaultProvider: jest.fn().mockReturnValue('openai'),
  };
}

function createAuthMock(
  authResult: AuthResult | null = createAuthResult(),
): jest.Mocked<AuthProvider> {
  return {
    authenticate: jest.fn().mockResolvedValue(authResult),
  };
}

function createStageOnePlannerMock(): jest.Mocked<StageOnePlanner> {
  return {
    plan: jest.fn().mockResolvedValue({
      mode: 'llm-assisted',
      confidence: 'high',
      planningIntent: 'Bias toward upper-body work while protecting recovery.',
      resolvedFocus: 'Upper Body',
      protectStressors: ['lower_body_overload'],
      avoidStressors: ['lower_body_fatigue'],
      styleBiases: ['athletic'],
      loadBias: 'moderate',
      noveltyTarget: 'medium',
      rerankHints: ['prefer pulling and core accessories'],
      candidateInstructions: ['keep lower-body fatigue minimal'],
    }),
  };
}

function createPolicyMock(allowed = true): jest.Mocked<UsagePolicy> {
  return {
    canGenerate: jest
      .fn()
      .mockResolvedValue(
        allowed
          ? { allowed: true }
          : { allowed: false, reason: 'Limit reached', statusCode: 429 },
      ),
  };
}

function createMeteringMock(): jest.Mocked<MeteringSink> {
  return {
    recordUsage: jest.fn().mockResolvedValue(undefined),
  };
}

function createHandler(
  overrides: {
    auth?: jest.Mocked<AuthProvider>;
    store?: jest.Mocked<GenerationStore>;
    router?: jest.Mocked<ModelRouter>;
    planner?: jest.Mocked<StageOnePlanner>;
    policy?: jest.Mocked<UsagePolicy>;
    metering?: jest.Mocked<MeteringSink>;
    exerciseLibrary?: ExerciseLibrary;
    loadExerciseLibrary?: jest.Mock<Promise<ExerciseLibrary | undefined>>;
    config?: Parameters<typeof createGenerateHandler>[0]['config'];
  } = {},
) {
  const auth = overrides.auth ?? createAuthMock();
  const store = overrides.store ?? createStoreMock();
  const router = overrides.router ?? createRouterMock();
  const planner = overrides.planner;
  const policy = overrides.policy;
  const metering = overrides.metering;

  const handler = createGenerateHandler({
    auth,
    store,
    router,
    planner,
    policy,
    metering,
    exerciseLibrary: overrides.exerciseLibrary,
    loadExerciseLibrary: overrides.loadExerciseLibrary,
    config: {
      edition: 'CE',
      defaultProvider: 'openai',
      ...overrides.config,
    },
  });

  return {
    handler,
    auth,
    store,
    router,
    planner,
    policy,
    metering,
  };
}

const baseContext: GenerationContext = {
  userProfile: {
    experienceLevel: 'beginner',
    preferredStyle: 'strength',
  },
  preferences: {
    focusBias: ['Upper Body'],
    injuries: [],
    avoid: [],
  },
  environment: {
    equipment: ['Bodyweight'],
    location: 'home',
    timeAvailableMinutes: 30,
  },
  recentSessions: [],
};

function createPlanningRequest(
  body: Partial<GenerationRequestPayload> = {},
  headers: Record<string, string> = {},
): Request {
  return createRequest(
    {
      timeMinutes: 30,
      focus: 'Upper Body',
      context: baseContext,
      ...body,
    },
    {
      'x-openai-key': 'test-key',
      ...headers,
    },
  );
}

function createExerciseLibrary(): ExerciseLibrary {
  return {
    getExerciseById: jest.fn(() => null),
    getExerciseByAlias: jest.fn((nameOrAlias: string) => {
      const normalized = nameOrAlias.toLowerCase();
      if (normalized === 'pushups' || normalized === 'push-up') {
        return {
          id: 'fedb:pushups',
          slug: 'pushups',
          name: 'Pushups',
          aliases: ['push-up'],
          description: 'desc',
          instructionSteps: ['step'],
          requiredEquipment: ['bodyweight'],
          optionalEquipment: [],
          focusTags: ['upper_body'],
          movementTags: ['push'],
          styleTags: ['strength'],
          stressorTags: [],
          contraindicationTags: [],
          avoidTags: [],
          impactLevel: 'low',
          noiseLevel: 'quiet',
          spaceFootprint: 'small',
          travelFriendly: true,
          floorRequired: true,
          experienceLevelMin: 'beginner',
          loadLevel: 'moderate',
          allowedRoles: ['main'],
          metadataCompleteness: 'planner-ready',
          sortKey: 10,
          sourceRefs: [],
        };
      }

      return null;
    }),
    countEligibleExercises: jest.fn(() => 1),
    listEligibleExercises: jest.fn(() => ({
      libraryVersion: 'test-library',
      totalEligibleCount: 1,
      exercises: [
        {
          id: 'fedb:pushups',
          slug: 'pushups',
          name: 'Pushups',
          aliases: ['push-up'],
          description: 'desc',
          instructionSteps: ['step'],
          requiredEquipment: ['bodyweight'],
          optionalEquipment: [],
          focusTags: ['upper_body'],
          movementTags: ['push'],
          styleTags: ['strength'],
          stressorTags: [],
          contraindicationTags: [],
          avoidTags: [],
          impactLevel: 'low',
          noiseLevel: 'quiet',
          spaceFootprint: 'small',
          travelFriendly: true,
          floorRequired: true,
          experienceLevelMin: 'beginner',
          loadLevel: 'moderate',
          allowedRoles: ['main'],
          metadataCompleteness: 'planner-ready',
          sortKey: 10,
          sourceRefs: [],
        },
      ],
    })),
    listVariationCandidates: jest.fn(() => ({
      libraryVersion: 'test-library',
      totalEligibleCount: 1,
      exercises: [
        {
          id: 'fedb:chin-up',
          slug: 'chin-up',
          name: 'Chin-Up',
          aliases: [],
          description: 'desc',
          instructionSteps: ['step'],
          requiredEquipment: ['bodyweight', 'pull_up_bar'],
          optionalEquipment: [],
          focusTags: ['upper_body'],
          movementTags: ['pull'],
          styleTags: ['strength'],
          stressorTags: [],
          contraindicationTags: [],
          avoidTags: [],
          impactLevel: 'low',
          noiseLevel: 'quiet',
          spaceFootprint: 'small',
          travelFriendly: false,
          floorRequired: false,
          experienceLevelMin: 'beginner',
          loadLevel: 'moderate',
          allowedRoles: ['main'],
          metadataCompleteness: 'planner-ready',
          sortKey: 20,
          sourceRefs: [],
        },
      ],
    })),
    getLibraryMetadata: jest.fn(() => ({
      libraryVersion: 'test-library',
      sourceVersion: 'test-source',
      builtAt: 'now',
      exerciseCount: 1,
      plannerReadyCount: 1,
    })),
    close: jest.fn(),
  };
}

describe('createGenerateHandler', () => {
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    logSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('rejects unauthorized requests', async () => {
    const { handler, store, router } = createHandler({
      auth: createAuthMock(null),
    });

    const response = await handler(createRequest({ timeMinutes: 30 }));
    const json = (await response.json()) as { code: string };

    expect(response.status).toBe(401);
    expect(json.code).toBe('UNAUTHORIZED');
    expect(store.markPending).not.toHaveBeenCalled();
    expect(router.generate).not.toHaveBeenCalled();
  });

  it('rejects malformed JSON bodies', async () => {
    const { handler, store, router } = createHandler();

    const response = await handler(createInvalidJsonRequest());
    const json = (await response.json()) as { code: string };

    expect(response.status).toBe(400);
    expect(json.code).toBe('VALIDATION_ERROR');
    expect(store.markPending).not.toHaveBeenCalled();
    expect(router.generate).not.toHaveBeenCalled();
  });

  it('merges client context with request-level overrides before generation', async () => {
    const router = createRouterMock(createTodayPlanMock({ id: 'merged-plan' }));
    const { handler } = createHandler({
      router,
      config: {
        edition: 'CE',
        defaultProvider: 'openai',
        defaultApiKeys: { openai: 'server-openai-key' },
      },
    });

    const context = createGenerationContextMock({
      userProfile: {
        experienceLevel: 'intermediate',
        primaryGoal: 'Build muscle',
        energyToday: 'easy',
        preferredStyle: 'Circuits',
      },
      preferences: {
        focusBias: ['Pull'],
        avoid: ['burpees'],
        injuries: ['left shoulder'],
      },
      environment: {
        equipment: ['Bodyweight'],
        location: 'garage',
        timeAvailableMinutes: 15,
        timeOfDay: 'morning',
      },
      recentSessions: [],
      notes: 'Prefer short rest.',
    });

    const requestBody = {
      timeMinutes: 45,
      focus: 'Lower Body',
      equipment: ['Dumbbells', 'Bench'],
      energy: 'intense',
      context,
    } satisfies GenerationRequest & { context: GenerationContext };

    const response = await handler(createRequest(requestBody));

    expect(response.status).toBe(200);
    expect(router.generate).toHaveBeenCalledTimes(1);

    const [, mergedContext, options] = router.generate.mock.calls[0];
    expect(mergedContext.userProfile.energyToday).toBe('intense');
    expect(mergedContext.environment.equipment).toEqual(['Dumbbells', 'Bench']);
    expect(mergedContext.environment.timeAvailableMinutes).toBe(45);
    expect(mergedContext.preferences.focusBias).toEqual(['Lower Body', 'Pull']);
    expect(options).toMatchObject({
      provider: 'openai',
      apiKey: 'server-openai-key',
    });
  });

  it('uses legacy x-openai-key inference and records metering without leaking api keys', async () => {
    const metering = createMeteringMock();
    const router = createRouterMock(
      createTodayPlanMock({ id: 'legacy-openai-plan' }),
    );
    const { handler, store } = createHandler({ router, metering });

    const response = await handler(
      createRequest(
        {
          timeMinutes: 30,
          focus: 'Upper Body',
          equipment: ['Dumbbells'],
          energy: 'moderate',
          previousResponseId: 'resp-old',
          feedback: ['just-try-again'],
        },
        { 'x-openai-key': 'sk-test-123456789' },
      ),
    );

    expect(response.status).toBe(200);
    expect(router.generate).toHaveBeenCalledWith(
      expect.objectContaining({ previousResponseId: undefined }),
      expect.any(Object),
      expect.objectContaining({
        provider: 'openai',
        apiKey: 'sk-test-123456789',
      }),
    );
    expect(store.markPending).toHaveBeenCalledWith('device-123', 18);
    expect(metering.recordUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'regenerate',
        provider: 'openai',
        byok: true,
        metadata: {
          responseId: 'resp-123',
          schemaVersion: 'v2-flat',
        },
      }),
    );

    const meteringPayload = metering.recordUsage.mock.calls[0][0];
    expect(JSON.stringify(meteringPayload)).not.toContain('sk-test-123456789');
  });

  it('uses a persisted mock fallback in CE when no key is available', async () => {
    const { handler, router, store } = createHandler({
      config: { edition: 'CE', defaultProvider: 'openai' },
    });

    const response = await handler(
      createRequest({
        timeMinutes: 20,
        focus: 'Smart',
        energy: 'easy',
      }),
    );
    const json = (await response.json()) as TodayPlan;

    expect(response.status).toBe(200);
    expect(router.generate).not.toHaveBeenCalled();
    expect(json.durationMinutes).toBe(20);
    expect(json.focus).toBe('Full Body');
    expect(json.energy).toBe('easy');
    expect(store.persistPlan).toHaveBeenCalledWith(
      'device-123',
      expect.objectContaining({ durationMinutes: 20, focus: 'Full Body' }),
      { schemaVersion: undefined },
    );
  });

  it('blocks hosted requests without a key', async () => {
    const { handler, router, store } = createHandler({
      config: { edition: 'HOSTED', defaultProvider: 'openai' },
    });

    const response = await handler(createRequest({ timeMinutes: 30 }));
    const json = (await response.json()) as { code: string };

    expect(response.status).toBe(402);
    expect(json.code).toBe('BYOK_REQUIRED');
    expect(store.markPending).not.toHaveBeenCalled();
    expect(router.generate).not.toHaveBeenCalled();
  });

  it('respects policy denial before generation begins', async () => {
    const policy = createPolicyMock(false);
    const { handler, router, store } = createHandler({ policy });

    const response = await handler(createRequest({ timeMinutes: 30 }));
    const json = (await response.json()) as { code: string };

    expect(response.status).toBe(429);
    expect(json.code).toBe('QUOTA_EXCEEDED');
    expect(policy.canGenerate).toHaveBeenCalledTimes(1);
    expect(store.markPending).not.toHaveBeenCalled();
    expect(router.generate).not.toHaveBeenCalled();
  });

  it('falls back to a mock plan on provider failure and sanitizes logged errors', async () => {
    const router = createRouterMock();
    router.generate.mockRejectedValueOnce(
      new Error('provider exploded with key sk-live-should-not-appear'),
    );

    const { handler, store } = createHandler({
      router,
      config: {
        edition: 'CE',
        defaultProvider: 'openai',
        defaultApiKeys: { openai: 'server-openai-key' },
      },
    });

    const response = await handler(
      createRequest({
        timeMinutes: 25,
        focus: 'Upper Body',
        equipment: ['Dumbbells'],
      }),
    );
    const json = (await response.json()) as TodayPlan;

    expect(response.status).toBe(200);
    expect(json.durationMinutes).toBe(25);
    expect(json.focus).toBe('Upper Body');
    expect(store.setError).toHaveBeenCalledWith(
      'device-123',
      'We could not generate a workout plan. Showing a fallback plan.',
    );
    expect(store.persistPlan).not.toHaveBeenCalled();

    const loggedWarnings = warnSpy.mock.calls.map((call) => String(call[0]));
    expect(loggedWarnings.join(' ')).not.toContain('sk-live-should-not-appear');
    expect(loggedWarnings.join(' ')).toContain('[REDACTED]');
  });

  it('builds a candidate pool on normal generation without changing the public response', async () => {
    const router = createRouterMock(
      createTodayPlanMock({ id: 'candidate-plan' }),
    );
    const exerciseLibrary = createExerciseLibrary();
    const { handler } = createHandler({ router, exerciseLibrary });

    const response = await handler(createPlanningRequest());
    const payload = (await response.json()) as TodayPlan & {
      candidateExercises?: unknown;
    };

    expect(response.status).toBe(200);
    expect(exerciseLibrary.listEligibleExercises).toHaveBeenCalledTimes(1);
    expect(exerciseLibrary.listVariationCandidates).not.toHaveBeenCalled();
    expect(router.generate).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({
        candidatePool: expect.objectContaining({
          candidateExercises: [
            expect.objectContaining({ id: 'fedb:pushups', name: 'Pushups' }),
          ],
          searchText: expect.any(String),
        }),
      }),
    );
    expect(payload.focus).toBeDefined();
    expect(payload.candidateExercises).toBeUndefined();
  });

  it('loads the exercise library lazily for AI generation when a loader is provided', async () => {
    const router = createRouterMock(
      createTodayPlanMock({ id: 'lazy-candidate-plan' }),
    );
    const exerciseLibrary = createExerciseLibrary();
    const loadExerciseLibrary = jest
      .fn<Promise<ExerciseLibrary | undefined>, []>()
      .mockResolvedValue(exerciseLibrary);
    const { handler } = createHandler({ router, loadExerciseLibrary });

    const response = await handler(createPlanningRequest());

    expect(response.status).toBe(200);
    expect(loadExerciseLibrary).toHaveBeenCalledTimes(1);
    expect(exerciseLibrary.listEligibleExercises).toHaveBeenCalledTimes(1);
    expect(router.generate).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({
        candidatePool: expect.objectContaining({
          candidateExercises: [
            expect.objectContaining({ id: 'fedb:pushups', name: 'Pushups' }),
          ],
        }),
      }),
    );
  });

  it('continues generation when lazy exercise-library loading fails', async () => {
    const router = createRouterMock(
      createTodayPlanMock({ id: 'lazy-loader-fallback-plan' }),
    );
    const loadExerciseLibrary = jest
      .fn<Promise<ExerciseLibrary | undefined>, []>()
      .mockRejectedValue(new Error('sqlite bindings unavailable'));
    const { handler } = createHandler({ router, loadExerciseLibrary });

    const response = await handler(createPlanningRequest());

    expect(response.status).toBe(200);
    expect(loadExerciseLibrary).toHaveBeenCalledTimes(1);
    expect(router.generate).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ candidatePool: undefined }),
    );

    const loggedWarnings = warnSpy.mock.calls.map((call) => String(call[0]));
    expect(loggedWarnings.join(' ')).toContain(
      'exercise candidate pool unavailable',
    );
    expect(loggedWarnings.join(' ')).toContain('sqlite bindings unavailable');
  });

  it('does not lazy-load the exercise library for CE mock fallback requests', async () => {
    const loadExerciseLibrary = jest
      .fn<Promise<ExerciseLibrary | undefined>, []>()
      .mockResolvedValue(createExerciseLibrary());
    const { handler, router } = createHandler({ loadExerciseLibrary });

    const response = await handler(
      createRequest({
        timeMinutes: 20,
        focus: 'Smart',
        energy: 'easy',
      }),
    );

    expect(response.status).toBe(200);
    expect(router.generate).not.toHaveBeenCalled();
    expect(loadExerciseLibrary).not.toHaveBeenCalled();
  });

  it('records fallback reasons internally when planner-safe candidates are unavailable', async () => {
    const router = createRouterMock();
    const exerciseLibrary = createExerciseLibrary();
    exerciseLibrary.listEligibleExercises = jest.fn(() => ({
      libraryVersion: 'test-library',
      totalEligibleCount: 0,
      exercises: [],
      diagnostics: {
        blockerCodes: ['unsupported_equipment'],
        counts: {},
      },
    }));
    const { handler } = createHandler({ router, exerciseLibrary });

    const response = await handler(createPlanningRequest());

    expect(response.status).toBe(200);
    expect(router.generate).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({
        planningBrief: expect.objectContaining({
          fallbackMode: 'strict-library',
          fallbackReasons: ['unsupported_equipment'],
        }),
      }),
    );
  });

  it('reuses the variation query path for regeneration without exposing candidate metadata', async () => {
    const previousPlan = createTodayPlanMock({
      blocks: [
        {
          id: 'block-1',
          title: 'Main',
          durationMinutes: 10,
          focus: 'Upper Body',
          exercises: [
            {
              id: 'exercise-1',
              name: 'Pushups',
              prescription: '3 x 10',
              detail: null,
            },
          ],
        },
      ],
    });
    const store = createStoreMock(previousPlan);
    const router = createRouterMock();
    const exerciseLibrary = createExerciseLibrary();
    const { handler } = createHandler({ store, router, exerciseLibrary });

    const response = await handler(
      createPlanningRequest({ previousResponseId: 'previous-response-id' }),
    );
    const payload = (await response.json()) as TodayPlan & {
      baselineExerciseIds?: unknown;
    };

    expect(response.status).toBe(200);
    expect(exerciseLibrary.listVariationCandidates).toHaveBeenCalledTimes(1);
    expect(exerciseLibrary.listVariationCandidates).toHaveBeenCalledWith(
      expect.objectContaining({ baselineExerciseIds: ['fedb:pushups'] }),
    );
    expect(payload.baselineExerciseIds).toBeUndefined();
  });

  it('accepts planning-date and baseline workout inputs and records provider provenance', async () => {
    const router = createRouterMock();
    const baselineWorkout = createTodayPlanMock({
      responseId: 'resp-baseline',
      generationProvenance: {
        provider: 'openai',
        responseId: 'resp-baseline',
      },
    });
    const { handler, store } = createHandler({ router });

    const response = await handler(
      createPlanningRequest({
        planningDateLocal: '2026-04-15',
        previousResponseId: 'resp-baseline',
        baselineWorkout,
      }),
    );
    const payload = (await response.json()) as TodayPlan;

    expect(response.status).toBe(200);
    expect(router.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        planningDateLocal: '2026-04-15',
        previousResponseId: 'resp-baseline',
        baselineWorkout,
      }),
      expect.anything(),
      expect.objectContaining({
        provider: 'openai',
        planningBrief: expect.objectContaining({
          planningDateLocal: '2026-04-15',
          resolvedFocus: expect.any(String),
          regeneration: expect.objectContaining({
            baselineWorkoutId: 'plan-mock',
          }),
        }),
      }),
    );
    expect(payload.generationProvenance).toEqual({
      provider: 'openai',
      responseId: 'resp-123',
    });
    expect(store.persistPlan).toHaveBeenCalledWith(
      'device-123',
      expect.objectContaining({
        generationProvenance: {
          provider: 'openai',
          responseId: 'resp-123',
        },
      }),
      expect.anything(),
    );
  });

  it('passes staged-planning activation metadata for ambiguous smart requests', async () => {
    const router = createRouterMock();
    const { handler } = createHandler({ router });

    const response = await handler(
      createPlanningRequest({
        focus: 'Smart',
        planningDateLocal: '2026-04-15',
        notes:
          'Keep it athletic, avoid grindy overhead work, and make the session fit around a hard climbing session tomorrow morning.',
        upcomingEvents: [
          {
            kind: 'sport',
            title: 'Climbing Session',
            localDate: '2026-04-16',
            intensity: 'high',
          },
        ],
      }),
    );

    expect(response.status).toBe(200);
    expect(router.generate).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({
        planningBrief: expect.objectContaining({
          stagedPlanning: expect.objectContaining({
            mode: 'llm-assisted',
            shouldRun: true,
            reasons: expect.arrayContaining(['smart-focus', 'dense-notes']),
          }),
        }),
      }),
    );
  });

  it('runs the stage-one planner when enabled for ambiguous requests and passes the artifact to generation', async () => {
    const router = createRouterMock();
    const planner = createStageOnePlannerMock();
    const { handler } = createHandler({
      router,
      planner,
      config: {
        edition: 'CE',
        defaultProvider: 'openai',
        enableStageOnePlanner: true,
      },
    });

    const response = await handler(
      createPlanningRequest({
        focus: 'Smart',
        notes:
          'Keep it shoulder-friendly and make it fit around a lower-body race effort tomorrow.',
        upcomingEvents: [
          {
            kind: 'run',
            title: 'Tune-Up Race',
            localDate: '2026-04-16',
            intensity: 'high',
          },
        ],
      }),
    );

    expect(response.status).toBe(200);
    expect(planner.plan).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({
        provider: 'openai',
        planningBrief: expect.objectContaining({
          stagedPlanning: expect.objectContaining({ shouldRun: true }),
        }),
      }),
    );
    expect(router.generate).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({
        stageOneArtifact: expect.objectContaining({
          mode: 'llm-assisted',
          resolvedFocus: 'Upper Body',
        }),
      }),
    );
  });

  it('falls back to single-pass generation when the stage-one planner feature flag is disabled', async () => {
    const router = createRouterMock();
    const planner = createStageOnePlannerMock();
    const { handler } = createHandler({
      router,
      planner,
      config: {
        edition: 'CE',
        defaultProvider: 'openai',
        enableStageOnePlanner: false,
      },
    });

    const response = await handler(
      createPlanningRequest({
        focus: 'Smart',
        notes:
          'Keep it athletic, avoid heavy leg fatigue, and make it fit around a hard climbing session tomorrow morning.',
        upcomingEvents: [
          {
            kind: 'sport',
            title: 'Climbing Session',
            localDate: '2026-04-16',
            intensity: 'high',
          },
        ],
      }),
    );

    expect(response.status).toBe(200);
    expect(planner.plan).not.toHaveBeenCalled();
    expect(router.generate).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({
        stageOneArtifact: undefined,
        planningBrief: expect.objectContaining({
          stagedPlanning: expect.objectContaining({
            shouldRun: true,
            reasons: expect.arrayContaining(['smart-focus', 'dense-notes']),
          }),
        }),
      }),
    );
  });

  it('passes the stage-one artifact through stateful OpenAI regeneration when provenance matches', async () => {
    const router = createRouterMock();
    const planner = createStageOnePlannerMock();
    const baselineWorkout = createTodayPlanMock({
      responseId: 'resp-openai',
      generationProvenance: {
        provider: 'openai',
        responseId: 'resp-openai',
      },
    });
    const { handler } = createHandler({
      router,
      planner,
      config: {
        edition: 'CE',
        defaultProvider: 'openai',
        enableStageOnePlanner: true,
      },
    });

    const response = await handler(
      createPlanningRequest({
        previousResponseId: 'resp-openai',
        baselineWorkout,
        feedback: ['different-exercises'],
      }),
    );

    expect(response.status).toBe(200);
    expect(planner.plan).toHaveBeenCalledWith(
      expect.objectContaining({
        previousResponseId: 'resp-openai',
        baselineWorkout,
      }),
      expect.anything(),
      expect.objectContaining({
        provider: 'openai',
        planningBrief: expect.objectContaining({
          regeneration: expect.objectContaining({ mode: 'stateful' }),
        }),
      }),
    );
    expect(router.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        previousResponseId: 'resp-openai',
        baselineWorkout,
      }),
      expect.anything(),
      expect.objectContaining({
        provider: 'openai',
        stageOneArtifact: expect.objectContaining({
          mode: 'llm-assisted',
          noveltyTarget: 'medium',
        }),
        planningBrief: expect.objectContaining({
          regeneration: expect.objectContaining({ mode: 'stateful' }),
        }),
      }),
    );
  });

  it('passes the stage-one artifact through stateless Gemini regeneration when provider continuity is unavailable', async () => {
    const router = createRouterMock();
    const planner = createStageOnePlannerMock();
    const baselineWorkout = createTodayPlanMock({
      responseId: 'resp-openai',
      generationProvenance: {
        provider: 'openai',
        responseId: 'resp-openai',
      },
    });
    const { handler } = createHandler({
      router,
      planner,
      config: {
        edition: 'CE',
        defaultProvider: 'gemini',
        enableStageOnePlanner: true,
      },
    });

    const response = await handler(
      createPlanningRequest(
        {
          previousResponseId: 'resp-openai',
          baselineWorkout,
          feedback: ['different-exercises'],
        },
        {
          'x-ai-provider': 'gemini',
          'x-gemini-key': 'gemini-key',
          'x-openai-key': '',
        },
      ),
    );

    expect(response.status).toBe(200);
    expect(planner.plan).toHaveBeenCalledWith(
      expect.objectContaining({
        previousResponseId: undefined,
        baselineWorkout,
      }),
      expect.anything(),
      expect.objectContaining({
        provider: 'gemini',
        planningBrief: expect.objectContaining({
          regeneration: expect.objectContaining({ mode: 'stateless' }),
        }),
      }),
    );
    expect(router.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        previousResponseId: undefined,
        baselineWorkout,
      }),
      expect.anything(),
      expect.objectContaining({
        provider: 'gemini',
        stageOneArtifact: expect.objectContaining({
          mode: 'llm-assisted',
          noveltyTarget: 'medium',
        }),
        planningBrief: expect.objectContaining({
          regeneration: expect.objectContaining({ mode: 'stateless' }),
        }),
      }),
    );
  });

  it('reranks the candidate pool using the stage-one planner artifact before final generation', async () => {
    const router = createRouterMock();
    const planner = createStageOnePlannerMock();
    const exerciseLibrary = createExerciseLibrary();
    exerciseLibrary.listEligibleExercises = jest.fn(() => ({
      libraryVersion: 'test-library',
      totalEligibleCount: 2,
      exercises: [
        {
          id: 'fedb:squat',
          slug: 'bodyweight-squat',
          name: 'Bodyweight Squat',
          aliases: ['squat'],
          description: 'desc',
          instructionSteps: ['step'],
          requiredEquipment: ['bodyweight'],
          optionalEquipment: [],
          focusTags: ['lower_body'],
          movementTags: ['squat'],
          styleTags: ['strength'],
          stressorTags: ['lower_body_fatigue'],
          contraindicationTags: [],
          avoidTags: [],
          impactLevel: 'low',
          noiseLevel: 'quiet',
          spaceFootprint: 'small',
          travelFriendly: true,
          floorRequired: false,
          experienceLevelMin: 'beginner',
          loadLevel: 'moderate',
          allowedRoles: ['main'],
          metadataCompleteness: 'planner-ready',
          sortKey: 10,
          sourceRefs: [],
        },
        {
          id: 'fedb:pushups',
          slug: 'pushups',
          name: 'Pushups',
          aliases: ['push-up'],
          description: 'desc',
          instructionSteps: ['step'],
          requiredEquipment: ['bodyweight'],
          optionalEquipment: [],
          focusTags: ['upper_body'],
          movementTags: ['push'],
          styleTags: ['strength'],
          stressorTags: [],
          contraindicationTags: [],
          avoidTags: [],
          impactLevel: 'low',
          noiseLevel: 'quiet',
          spaceFootprint: 'small',
          travelFriendly: true,
          floorRequired: true,
          experienceLevelMin: 'beginner',
          loadLevel: 'moderate',
          allowedRoles: ['main'],
          metadataCompleteness: 'planner-ready',
          sortKey: 11,
          sourceRefs: [],
        },
      ],
    }));
    const { handler } = createHandler({
      router,
      planner,
      exerciseLibrary,
      config: {
        edition: 'CE',
        defaultProvider: 'openai',
        enableStageOnePlanner: true,
      },
    });

    const response = await handler(
      createPlanningRequest({
        focus: 'Smart',
        notes: 'Keep it upper-body focused and athletic.',
      }),
    );

    expect(response.status).toBe(200);
    expect(router.generate).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({
        candidatePool: expect.objectContaining({
          candidateExercises: [
            expect.objectContaining({ id: 'fedb:pushups' }),
            expect.objectContaining({ id: 'fedb:squat' }),
          ],
        }),
      }),
    );
  });

  it('uses stateless regeneration when provider continuity does not match the active provider', async () => {
    const router = createRouterMock();
    const baselineWorkout = createTodayPlanMock({
      responseId: 'resp-openai',
      generationProvenance: {
        provider: 'openai',
        responseId: 'resp-openai',
      },
    });
    const { handler } = createHandler({
      router,
      config: { edition: 'CE', defaultProvider: 'gemini' },
    });

    await handler(
      createPlanningRequest(
        {
          previousResponseId: 'resp-openai',
          baselineWorkout,
          feedback: ['different-exercises'],
        },
        {
          'x-ai-provider': 'gemini',
          'x-gemini-key': 'gemini-key',
          'x-openai-key': '',
        },
      ),
    );

    expect(router.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        previousResponseId: undefined,
        baselineWorkout,
      }),
      expect.anything(),
      expect.objectContaining({
        provider: 'gemini',
        planningBrief: expect.objectContaining({
          regeneration: expect.objectContaining({ mode: 'stateless' }),
        }),
      }),
    );
  });

  it('uses stateless regeneration when prior response provenance does not match the requested response id', async () => {
    const router = createRouterMock();
    const baselineWorkout = createTodayPlanMock({
      responseId: 'resp-openai',
      generationProvenance: {
        provider: 'openai',
        responseId: 'resp-openai',
      },
    });
    const { handler } = createHandler({
      router,
      config: { edition: 'CE', defaultProvider: 'openai' },
    });

    await handler(
      createPlanningRequest(
        {
          previousResponseId: 'resp-different',
          baselineWorkout,
          feedback: ['different-exercises'],
        },
        {
          'x-ai-provider': 'openai',
          'x-openai-key': 'openai-key',
        },
      ),
    );

    expect(router.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        previousResponseId: undefined,
        baselineWorkout,
      }),
      expect.anything(),
      expect.objectContaining({
        provider: 'openai',
        planningBrief: expect.objectContaining({
          regeneration: expect.objectContaining({ mode: 'stateless' }),
        }),
      }),
    );
  });
});
