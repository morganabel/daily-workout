import {
  type GenerationContext,
  type GenerationRequest,
  type GenerationRequestPayload,
  type TodayPlan,
} from '@workout-agent/shared';
import {
  createGenerationContextFixture,
  createTodayPlanFixture,
} from '@workout-agent/shared/testing';
import type {
  ExerciseLibrary,
  WorkoutCatalogMatch,
} from '@workout-agent-ce/server-exercise-library';

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
  headers: Record<string, string> = {}
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
  plan: TodayPlan | null = null
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
  plan = createTodayPlanFixture()
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
        ['openai', 'gemini', 'openrouter'].includes(provider)
      ),
    getDefaultProvider: jest.fn().mockReturnValue('openai'),
  };
}

function createAuthMock(
  authResult: AuthResult | null = createAuthResult()
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
      selectionIntent: 'balanced_upper',
      rerankHints: ['prefer pulling and core accessories'],
      candidateInstructions: ['keep lower-body fatigue minimal'],
    }),
  };
}

function createPolicyMock(allowed = true): jest.Mocked<UsagePolicy> {
  const reserveGenerate: jest.MockedFunction<UsagePolicy['reserveGenerate']> =
    jest.fn();
  reserveGenerate.mockImplementation(async (request) =>
    allowed
      ? {
          allowed: true,
          reservation: {
            kind: 'included_generation',
            reservationId: `reservation-${request.operationId}`,
            accountId: request.accountId,
            operationId: request.operationId,
            expiresAt: '2030-01-01T00:00:00.000Z',
          },
        }
      : {
          allowed: false,
          code: 'quota_exceeded',
          reason: 'Limit reached',
          statusCode: 429,
        }
  );
  return {
    reserveGenerate,
    commitGenerateReservation: jest.fn().mockResolvedValue(undefined),
    rollbackGenerateReservation: jest.fn().mockResolvedValue(undefined),
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
  } = {}
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
      defaultApiKeys: { openai: 'server-openai-key' },
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
  headers: Record<string, string> = {}
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
    }
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
    matchWorkoutCatalog: jest.fn(() => ({
      decision: 'none',
      diagnostics: {
        blockerCodes: ['constraint_conflict'],
        candidateCount: 0,
        reasons: [],
      },
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

type CatalogMatchOverrides = Omit<
  Partial<WorkoutCatalogMatch>,
  'diagnostics' | 'plan'
> & {
  diagnostics?: Partial<WorkoutCatalogMatch['diagnostics']>;
  plan?: WorkoutCatalogMatch['plan'];
};

function createCatalogMatch(
  decision: WorkoutCatalogMatch['decision'] = 'direct',
  overrides: CatalogMatchOverrides = {}
): WorkoutCatalogMatch {
  const plan = createTodayPlanFixture({
    id: 'library:bodyweight-foundation-30',
    source: 'library',
    focus: 'Full Body Strength',
    equipment: ['bodyweight'],
    generationProvenance: undefined,
    responseId: undefined,
    catalogProvenance: undefined,
  });

  return {
    decision,
    recipe: {
      id: 'catalog:bodyweight-foundation-30',
      slug: 'bodyweight-foundation-30',
      ownership: 'system',
      version: 1,
      status: 'active',
      title: 'Bodyweight Foundation',
      summary: plan.summary,
      focus: plan.focus,
      targetDurationMinutes: plan.durationMinutes,
      durationRange: { min: 25, max: 35 },
      minExperienceLevel: 'beginner',
      qualityScore: 92,
      catalogVersion: 'test-catalog',
      source: 'system',
      equipment: ['bodyweight'],
      focusTags: ['full_body'],
      styleTags: ['strength'],
      environmentTags: ['home'],
      energyLevels: ['moderate'],
      constraints: {},
      blocks: [],
      ...overrides.recipe,
    },
    plan: overrides.plan ?? { ...plan, source: 'library' },
    score: overrides.score ?? (decision === 'direct' ? 94 : 72),
    diagnostics: {
      blockerCodes: [],
      candidateCount: 1,
      bestScore: decision === 'direct' ? 94 : 72,
      selectedRecipeId: 'catalog:bodyweight-foundation-30',
      reasons: ['test'],
      ...overrides.diagnostics,
    },
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
    const router = createRouterMock(
      createTodayPlanFixture({ id: 'merged-plan' })
    );
    const { handler } = createHandler({
      router,
      config: {
        edition: 'CE',
        defaultProvider: 'openai',
        defaultApiKeys: { openai: 'server-openai-key' },
      },
    });

    const context = createGenerationContextFixture({
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
      createTodayPlanFixture({ id: 'legacy-openai-plan' })
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
        { 'x-openai-key': 'sk-test-123456789' }
      )
    );

    expect(response.status).toBe(200);
    expect(router.generate).toHaveBeenCalledWith(
      expect.objectContaining({ previousResponseId: undefined }),
      expect.any(Object),
      expect.objectContaining({
        provider: 'openai',
        apiKey: 'sk-test-123456789',
      })
    );
    expect(store.markPending).toHaveBeenCalledWith('device-123', 18);
    expect(metering.recordUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'generate',
        provider: 'openai',
        byok: true,
        responseId: 'resp-123',
        schemaVersion: 'v2-flat',
      })
    );

    const meteringPayload = metering.recordUsage.mock.calls[0][0];
    expect(JSON.stringify(meteringPayload)).not.toContain('sk-test-123456789');
  });

  it('ignores a mismatched Gemini key when selecting managed OpenAI', async () => {
    const policy = createPolicyMock();
    const metering = createMeteringMock();
    const { handler, router } = createHandler({ policy, metering });

    const response = await handler(
      createRequest(
        { timeMinutes: 30, focus: 'Upper Body' },
        {
          'x-ai-provider': 'openai',
          'x-gemini-key': 'stale-gemini-secret',
        }
      )
    );

    expect(response.status).toBe(200);
    expect(policy.reserveGenerate).toHaveBeenCalledTimes(1);
    expect(router.generate).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({
        provider: 'openai',
        apiKey: 'server-openai-key',
        useVertexAi: false,
      })
    );
    expect(metering.recordUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'openai',
        credentialSource: 'managed',
        byok: false,
      })
    );
    expect(JSON.stringify(metering.recordUsage.mock.calls[0][0])).not.toContain(
      'stale-gemini-secret'
    );
  });

  it('ignores a mismatched OpenAI key when selecting managed Gemini', async () => {
    const policy = createPolicyMock();
    const metering = createMeteringMock();
    const { handler, router } = createHandler({
      policy,
      metering,
      config: {
        edition: 'HOSTED',
        defaultProvider: 'gemini',
        defaultApiKeys: { gemini: 'managed-gemini-key' },
      },
    });

    const response = await handler(
      createRequest(
        { timeMinutes: 30, focus: 'Full Body' },
        {
          'x-ai-provider': 'gemini',
          'x-openai-key': 'stale-openai-secret',
        }
      )
    );

    expect(response.status).toBe(200);
    expect(policy.reserveGenerate).toHaveBeenCalledTimes(1);
    expect(router.generate).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({
        provider: 'gemini',
        apiKey: 'managed-gemini-key',
        useVertexAi: false,
      })
    );
    expect(metering.recordUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'gemini',
        credentialSource: 'managed',
        byok: false,
      })
    );
  });

  it('uses matching Gemini BYOK instead of configured Vertex', async () => {
    const policy = createPolicyMock();
    const metering = createMeteringMock();
    const { handler, router } = createHandler({
      policy,
      metering,
      config: {
        edition: 'HOSTED',
        defaultProvider: 'gemini',
        defaultApiKeys: {},
        useVertexAi: true,
        googleCloudProject: 'project',
        googleCloudLocation: 'location',
      },
    });

    const response = await handler(
      createRequest(
        { timeMinutes: 30, focus: 'Full Body' },
        {
          'x-ai-provider': 'gemini',
          'x-gemini-key': 'gemini-byok-secret',
        }
      )
    );

    expect(response.status).toBe(200);
    expect(policy.reserveGenerate).not.toHaveBeenCalled();
    expect(router.generate).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({
        provider: 'gemini',
        apiKey: 'gemini-byok-secret',
        useVertexAi: false,
      })
    );
    expect(metering.recordUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'gemini',
        credentialSource: 'byok',
        byok: true,
      })
    );
    expect(JSON.stringify(metering.recordUsage.mock.calls[0][0])).not.toContain(
      'gemini-byok-secret'
    );
  });

  it('treats configured Vertex as managed execution', async () => {
    const policy = createPolicyMock();
    const metering = createMeteringMock();
    const { handler, router } = createHandler({
      policy,
      metering,
      config: {
        edition: 'HOSTED',
        defaultProvider: 'gemini',
        defaultApiKeys: {},
        useVertexAi: true,
        googleCloudProject: 'project',
        googleCloudLocation: 'location',
      },
    });

    const response = await handler(
      createRequest(
        { timeMinutes: 30, focus: 'Full Body' },
        { 'x-ai-provider': 'gemini' }
      )
    );

    expect(response.status).toBe(200);
    expect(policy.reserveGenerate).toHaveBeenCalledTimes(1);
    expect(router.generate).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({
        provider: 'gemini',
        apiKey: undefined,
        useVertexAi: true,
      })
    );
    expect(metering.recordUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'gemini',
        credentialSource: 'vertex',
        byok: false,
      })
    );
  });

  it('routes OpenRouter BYOK requests through the generic key header', async () => {
    const metering = createMeteringMock();
    const router = createRouterMock(
      createTodayPlanFixture({ id: 'openrouter-byok-plan' })
    );
    const { handler } = createHandler({ router, metering });

    const response = await handler(
      createRequest(
        { timeMinutes: 30, focus: 'Full Body' },
        {
          'x-ai-provider': 'openrouter',
          'x-ai-key': 'sk-or-v1-test-key',
        }
      )
    );

    expect(response.status).toBe(200);
    expect(router.generate).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({
        provider: 'openrouter',
        apiKey: 'sk-or-v1-test-key',
      })
    );
    expect(metering.recordUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'openrouter',
        byok: true,
      })
    );
  });

  it('uses a server-managed OpenRouter key when it is the default provider', async () => {
    const policy = createPolicyMock();
    const router = createRouterMock(
      createTodayPlanFixture({ id: 'openrouter-managed-plan' })
    );
    const { handler } = createHandler({
      router,
      policy,
      config: {
        edition: 'CE',
        defaultProvider: 'openrouter',
        defaultApiKeys: { openrouter: 'managed-openrouter-key' },
      },
    });

    const response = await handler(
      createRequest({ timeMinutes: 30, focus: 'Full Body' })
    );

    expect(response.status).toBe(200);
    expect(policy.reserveGenerate).toHaveBeenCalledTimes(1);
    expect(router.generate).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({
        provider: 'openrouter',
        apiKey: 'managed-openrouter-key',
      })
    );
  });

  it('returns a provider configuration error in CE when no key is available', async () => {
    const policy = createPolicyMock();
    const { handler, router, store } = createHandler({
      policy,
      config: { edition: 'CE', defaultProvider: 'openai', defaultApiKeys: {} },
    });

    const response = await handler(
      createRequest({
        timeMinutes: 20,
        focus: 'Smart',
        energy: 'easy',
      })
    );
    const json = (await response.json()) as { code: string; message: string };

    expect(response.status).toBe(503);
    expect(json.code).toBe('AI_PROVIDER_NOT_CONFIGURED');
    expect(policy.reserveGenerate).not.toHaveBeenCalled();
    expect(router.generate).not.toHaveBeenCalled();
    expect(store.markPending).not.toHaveBeenCalled();
    expect(store.persistPlan).not.toHaveBeenCalled();
  });

  it('blocks hosted requests without a key', async () => {
    const { handler, router, store } = createHandler({
      config: {
        edition: 'HOSTED',
        defaultProvider: 'openai',
        defaultApiKeys: {},
      },
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
    expect(policy.reserveGenerate).toHaveBeenCalledTimes(1);
    expect(store.markPending).not.toHaveBeenCalled();
    expect(router.generate).not.toHaveBeenCalled();
  });

  it('commits the exact server-owned reservation and meters that operation', async () => {
    const policy = createPolicyMock();
    const metering = createMeteringMock();
    const { handler } = createHandler({ policy, metering });

    const response = await handler(
      createRequest(
        { timeMinutes: 30, focus: 'Upper Body' },
        { 'x-request-id': 'caller-correlation-id' }
      )
    );

    expect(response.status).toBe(200);
    const reserveRequest = policy.reserveGenerate.mock.calls[0][0];
    expect(reserveRequest).toMatchObject({
      accountId: 'user-123',
      operation: 'generate',
    });
    expect(reserveRequest.operationId).not.toBe('caller-correlation-id');
    expect(policy.commitGenerateReservation).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: 'user-123',
        operationId: reserveRequest.operationId,
      })
    );
    expect(metering.recordUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        operationId: reserveRequest.operationId,
        eventId: 'generation-success',
      })
    );
  });

  it('creates independent operations when a correlation ID is reused', async () => {
    const policy = createPolicyMock();
    const metering = createMeteringMock();
    const { handler } = createHandler({ policy, metering });
    const headers = { 'x-request-id': 'reused-correlation-id' };

    await handler(createRequest({ timeMinutes: 20, focus: 'Push' }, headers));
    await handler(createRequest({ timeMinutes: 40, focus: 'Pull' }, headers));

    const operationIds = policy.reserveGenerate.mock.calls.map(
      ([request]) => request.operationId
    );
    expect(new Set(operationIds).size).toBe(2);
    expect(
      metering.recordUsage.mock.calls.map(([event]) => event.operationId)
    ).toEqual(operationIds);
  });

  it('returns library mode catalog workouts without provider configuration, quota, or metering', async () => {
    const policy = createPolicyMock(false);
    const metering = createMeteringMock();
    const exerciseLibrary = createExerciseLibrary();
    (exerciseLibrary.matchWorkoutCatalog as jest.Mock).mockReturnValue(
      createCatalogMatch('direct')
    );
    const { handler, router, store } = createHandler({
      exerciseLibrary,
      policy,
      metering,
      config: {
        edition: 'HOSTED',
        defaultProvider: 'openai',
        defaultApiKeys: {},
      },
    });

    const response = await handler(
      createRequest({
        creationMode: 'library',
        timeMinutes: 30,
        focus: 'Full Body',
        context: baseContext,
      })
    );
    const payload = (await response.json()) as TodayPlan;

    expect(response.status).toBe(200);
    expect(payload.source).toBe('library');
    expect(exerciseLibrary.matchWorkoutCatalog).toHaveBeenCalledTimes(1);
    expect(policy.reserveGenerate).not.toHaveBeenCalled();
    expect(router.generate).not.toHaveBeenCalled();
    expect(metering.recordUsage).not.toHaveBeenCalled();
    expect(store.persistPlan).toHaveBeenCalledWith(
      'device-123',
      expect.objectContaining({ source: 'library' }),
      expect.objectContaining({ schemaVersion: 'catalog:test-catalog' })
    );
  });

  it('returns no-match for library mode when the catalog cannot satisfy the request', async () => {
    const policy = createPolicyMock();
    const exerciseLibrary = createExerciseLibrary();
    const { handler, router } = createHandler({
      exerciseLibrary,
      policy,
      config: {
        edition: 'HOSTED',
        defaultProvider: 'openai',
        defaultApiKeys: {},
      },
    });

    const response = await handler(
      createRequest({
        creationMode: 'library',
        timeMinutes: 30,
        focus: 'Parachute intervals',
        context: baseContext,
      })
    );
    const payload = (await response.json()) as { code: string };

    expect(response.status).toBe(404);
    expect(payload.code).toBe('WORKOUT_CATALOG_NO_MATCH');
    expect(policy.reserveGenerate).not.toHaveBeenCalled();
    expect(router.generate).not.toHaveBeenCalled();
  });

  it('returns service unavailable for library mode when the catalog errors', async () => {
    const policy = createPolicyMock();
    const exerciseLibrary = createExerciseLibrary();
    (exerciseLibrary.matchWorkoutCatalog as jest.Mock).mockImplementation(
      () => {
        throw new Error('sqlite locked');
      }
    );
    const { handler, router } = createHandler({
      exerciseLibrary,
      policy,
      config: {
        edition: 'HOSTED',
        defaultProvider: 'openai',
        defaultApiKeys: {},
      },
    });

    const response = await handler(
      createRequest({
        creationMode: 'library',
        timeMinutes: 30,
        focus: 'Full Body',
        context: baseContext,
      })
    );
    const payload = (await response.json()) as { code: string };

    expect(response.status).toBe(503);
    expect(payload.code).toBe('WORKOUT_CATALOG_UNAVAILABLE');
    expect(policy.reserveGenerate).not.toHaveBeenCalled();
    expect(router.generate).not.toHaveBeenCalled();
  });

  it('returns auto-mode direct catalog matches before invoking AI', async () => {
    const exerciseLibrary = createExerciseLibrary();
    (exerciseLibrary.matchWorkoutCatalog as jest.Mock).mockReturnValue(
      createCatalogMatch('direct')
    );
    const { handler, router } = createHandler({ exerciseLibrary });

    const response = await handler(
      createRequest({
        creationMode: 'auto',
        timeMinutes: 30,
        focus: 'Full Body',
        context: baseContext,
      })
    );
    const payload = (await response.json()) as TodayPlan;

    expect(response.status).toBe(200);
    expect(payload.source).toBe('library');
    expect(payload.catalogProvenance).toEqual({
      recipeId: 'catalog:bodyweight-foundation-30',
      recipeSlug: 'bodyweight-foundation-30',
      ownership: 'system',
      catalogVersion: 'test-catalog',
      matchDecision: 'direct',
      returnedDirect: true,
    });
    expect(router.generate).not.toHaveBeenCalled();
  });

  it('routes cooled-down auto-mode direct catalog matches to AI with a bounded catalog seed', async () => {
    const exerciseLibrary = createExerciseLibrary();
    (exerciseLibrary.matchWorkoutCatalog as jest.Mock).mockReturnValue(
      createCatalogMatch('direct', {
        diagnostics: {
          blockerCodes: ['catalog_recipe_cooldown'],
          reasons: ['recipeCooldownPenalty=20'],
        },
      })
    );
    const router = createRouterMock(
      createTodayPlanFixture({ id: 'cooled-down-ai-plan', source: 'ai' })
    );
    const { handler } = createHandler({ exerciseLibrary, router });

    const response = await handler(
      createPlanningRequest({
        creationMode: 'auto',
        focus: 'Full Body',
      })
    );
    const payload = (await response.json()) as TodayPlan;

    expect(response.status).toBe(200);
    expect(payload.source).toBe('ai');
    expect(payload.catalogProvenance).toEqual({
      recipeId: 'catalog:bodyweight-foundation-30',
      recipeSlug: 'bodyweight-foundation-30',
      ownership: 'system',
      catalogVersion: 'test-catalog',
      matchDecision: 'direct',
      returnedDirect: false,
    });
    expect(router.generate).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({
        catalogMatch: expect.objectContaining({ decision: 'direct' }),
        catalogSeed: expect.objectContaining({
          focus: 'Full Body Strength',
          source: 'library',
          instructions: expect.stringContaining('training intent'),
        }),
        planningBrief: expect.objectContaining({
          fallbackReasons: expect.arrayContaining(['catalog_recipe_cooldown']),
        }),
      })
    );

    const catalogSeed = router.generate.mock.calls[0][2].catalogSeed;
    expect(JSON.stringify(catalogSeed)).not.toContain(
      'catalog:bodyweight-foundation-30'
    );
    expect(JSON.stringify(catalogSeed)).not.toContain('test-catalog');
    expect(JSON.stringify(catalogSeed)).not.toContain('recentSessions');
  });

  it('returns cooled-down auto-mode catalog matches directly when no provider can run', async () => {
    const exerciseLibrary = createExerciseLibrary();
    (exerciseLibrary.matchWorkoutCatalog as jest.Mock).mockReturnValue(
      createCatalogMatch('direct', {
        diagnostics: {
          blockerCodes: ['catalog_recipe_cooldown'],
          reasons: ['recipeCooldownPenalty=20'],
        },
      })
    );
    const { handler, router } = createHandler({
      exerciseLibrary,
      config: {
        edition: 'CE',
        defaultProvider: 'openai',
        defaultApiKeys: {},
      },
    });

    const response = await handler(
      createRequest({
        creationMode: 'auto',
        timeMinutes: 30,
        focus: 'Full Body',
        context: baseContext,
      })
    );
    const payload = (await response.json()) as TodayPlan;

    expect(response.status).toBe(200);
    expect(payload.source).toBe('library');
    expect(payload.catalogProvenance?.returnedDirect).toBe(true);
    expect(router.generate).not.toHaveBeenCalled();
  });

  it('keeps library mode on catalog even when the recipe is cooled down', async () => {
    const exerciseLibrary = createExerciseLibrary();
    (exerciseLibrary.matchWorkoutCatalog as jest.Mock).mockReturnValue(
      createCatalogMatch('adapt', {
        diagnostics: {
          blockerCodes: ['catalog_recipe_cooldown'],
          reasons: ['recipeCooldownPenalty=20'],
        },
      })
    );
    const { handler, router } = createHandler({
      exerciseLibrary,
      config: {
        edition: 'HOSTED',
        defaultProvider: 'openai',
        defaultApiKeys: {},
      },
    });

    const response = await handler(
      createRequest({
        creationMode: 'library',
        timeMinutes: 30,
        focus: 'Full Body',
        context: baseContext,
      })
    );
    const payload = (await response.json()) as TodayPlan;

    expect(response.status).toBe(200);
    expect(payload.source).toBe('library');
    expect(payload.catalogProvenance?.matchDecision).toBe('adapt');
    expect(payload.catalogProvenance?.returnedDirect).toBe(true);
    expect(router.generate).not.toHaveBeenCalled();
  });

  it('passes recent catalog recipe ids from previous plan and recent sessions to catalog matching', async () => {
    const exerciseLibrary = createExerciseLibrary();
    (exerciseLibrary.matchWorkoutCatalog as jest.Mock).mockReturnValue(
      createCatalogMatch('direct')
    );
    const previousPlan = createTodayPlanFixture({
      id: 'library:previous-bodyweight-30',
      source: 'library',
      catalogProvenance: {
        recipeId: 'catalog:previous-bodyweight-30',
        recipeSlug: 'previous-bodyweight-30',
        ownership: 'system',
        catalogVersion: 'test-catalog',
        matchDecision: 'direct',
        returnedDirect: true,
      },
    });
    const store = createStoreMock(previousPlan);
    const context: GenerationContext = {
      ...baseContext,
      recentSessions: [
        {
          id: 'session-1',
          name: 'Bodyweight Foundation',
          focus: 'Full Body Strength',
          durationMinutes: 30,
          completedAt: '2026-06-08T12:00:00.000Z',
          source: 'library',
          catalogProvenance: {
            recipeId: 'catalog:bodyweight-foundation-30',
            recipeSlug: 'bodyweight-foundation-30',
            ownership: 'system',
            catalogVersion: 'test-catalog',
            matchDecision: 'direct',
            returnedDirect: true,
          },
        },
      ],
    };
    const { handler } = createHandler({ exerciseLibrary, store });

    const response = await handler(
      createPlanningRequest({
        creationMode: 'auto',
        planningDateLocal: '2026-06-10',
        context,
      })
    );

    expect(response.status).toBe(200);
    expect(exerciseLibrary.matchWorkoutCatalog).toHaveBeenCalledWith(
      expect.objectContaining({
        recentCatalogRecipeIds: expect.arrayContaining([
          'catalog:previous-bodyweight-30',
          'catalog:bodyweight-foundation-30',
        ]),
      })
    );
  });

  it('passes auto-mode adapt catalog matches into the AI path', async () => {
    const exerciseLibrary = createExerciseLibrary();
    (exerciseLibrary.matchWorkoutCatalog as jest.Mock).mockReturnValue(
      createCatalogMatch('adapt')
    );
    const { handler, router } = createHandler({ exerciseLibrary });

    const response = await handler(
      createPlanningRequest({
        creationMode: 'auto',
        focus: 'Mobility reset',
      })
    );

    expect(response.status).toBe(200);
    expect(router.generate).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({
        catalogMatch: expect.objectContaining({
          decision: 'adapt',
          recipe: expect.objectContaining({
            id: 'catalog:bodyweight-foundation-30',
          }),
        }),
        planningBrief: expect.objectContaining({
          fallbackReasons: expect.arrayContaining(['catalog_adapt_match']),
        }),
        catalogSeed: expect.objectContaining({
          focus: 'Full Body Strength',
          source: 'library',
          instructions: expect.stringContaining('training intent'),
        }),
      })
    );
    const catalogSeed = router.generate.mock.calls[0][2].catalogSeed;
    expect(JSON.stringify(catalogSeed)).not.toContain(
      'catalog:bodyweight-foundation-30'
    );
    expect(JSON.stringify(catalogSeed)).not.toContain('test-catalog');
    expect(JSON.stringify(catalogSeed)).not.toContain('recentSessions');
  });

  it('does not attach catalog provenance when the catalog decision is none', async () => {
    const exerciseLibrary = createExerciseLibrary();
    (exerciseLibrary.matchWorkoutCatalog as jest.Mock).mockReturnValue({
      ...createCatalogMatch('none', { score: 40 }),
      diagnostics: {
        blockerCodes: ['weak_match'],
        candidateCount: 1,
        bestScore: 40,
        selectedRecipeId: 'catalog:bodyweight-foundation-30',
        reasons: ['best catalog score below threshold'],
      },
    });
    const router = createRouterMock(
      createTodayPlanFixture({ id: 'ai-plan', source: 'ai' })
    );
    const { handler } = createHandler({ exerciseLibrary, router });

    const response = await handler(
      createPlanningRequest({
        creationMode: 'auto',
        focus: 'Unusual unsupported focus',
      })
    );
    const payload = (await response.json()) as TodayPlan;

    expect(response.status).toBe(200);
    expect(payload.source).toBe('ai');
    expect(payload.catalogProvenance).toBeUndefined();
    expect(router.generate).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({
        catalogMatch: undefined,
      })
    );
  });

  it('skips catalog matching for explicit AI mode', async () => {
    const exerciseLibrary = createExerciseLibrary();
    const { handler, router } = createHandler({ exerciseLibrary });

    const response = await handler(
      createPlanningRequest({
        creationMode: 'ai',
      })
    );

    expect(response.status).toBe(200);
    expect(exerciseLibrary.matchWorkoutCatalog).not.toHaveBeenCalled();
    expect(router.generate).toHaveBeenCalledTimes(1);
  });

  it('returns an error response on provider failure and sanitizes logged errors', async () => {
    const credentialSecret = 'sk-live-should-not-appear';
    const router = createRouterMock();
    router.generate.mockRejectedValueOnce(
      new Error(`provider exploded with key ${credentialSecret}`)
    );
    const metering = createMeteringMock();
    const policy = createPolicyMock();

    const { handler, store } = createHandler({
      router,
      metering,
      policy,
      config: {
        edition: 'CE',
        defaultProvider: 'openai',
        defaultApiKeys: { openai: credentialSecret },
      },
    });

    const response = await handler(
      createRequest({
        timeMinutes: 25,
        focus: 'Upper Body',
        equipment: ['Dumbbells'],
      })
    );
    const json = (await response.json()) as { code: string; message: string };

    expect(response.status).toBe(502);
    expect(json.code).toBe('AI_GENERATION_ERROR');
    expect(json.message).not.toContain(credentialSecret);
    expect(store.setError).toHaveBeenCalledWith(
      'device-123',
      'We could not generate a workout plan. Please try again.'
    );
    expect(store.persistPlan).not.toHaveBeenCalled();

    const loggedWarnings = warnSpy.mock.calls.map((call) => String(call[0]));
    expect(loggedWarnings.join(' ')).not.toContain(credentialSecret);
    expect(loggedWarnings.join(' ')).toContain('[REDACTED]');
    expect(JSON.stringify(metering.recordUsage.mock.calls[0][0])).not.toContain(
      credentialSecret
    );
    const reservation = policy.reserveGenerate.mock.results[0].value;
    await expect(reservation).resolves.toMatchObject({ allowed: true });
    expect(policy.rollbackGenerateReservation).toHaveBeenCalledWith(
      expect.objectContaining({
        operationId: policy.reserveGenerate.mock.calls[0][0].operationId,
      })
    );
    expect(policy.commitGenerateReservation).not.toHaveBeenCalled();
  });

  it('builds a candidate pool on normal generation without changing the public response', async () => {
    const router = createRouterMock(
      createTodayPlanFixture({ id: 'candidate-plan' })
    );
    const exerciseLibrary = createExerciseLibrary();
    const { handler } = createHandler({ router, exerciseLibrary });

    const response = await handler(
      createPlanningRequest({ equipment: ['Dumbbells', 'Resistance Bands'] })
    );
    const payload = (await response.json()) as TodayPlan & {
      candidateExercises?: unknown;
    };

    expect(response.status).toBe(200);
    expect(exerciseLibrary.listEligibleExercises).toHaveBeenCalledTimes(1);
    expect(exerciseLibrary.listEligibleExercises).toHaveBeenCalledWith(
      expect.objectContaining({
        availableEquipment: ['Dumbbells', 'Resistance Bands'],
        searchText: expect.not.stringContaining('Dumbbells'),
      })
    );
    expect(exerciseLibrary.listEligibleExercises).toHaveBeenCalledWith(
      expect.objectContaining({
        searchText: expect.not.stringContaining('Resistance Bands'),
      })
    );
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
      })
    );
    expect(payload.focus).toBeDefined();
    expect(payload.candidateExercises).toBeUndefined();
  });

  it('normalizes returned equipment to the effective request equipment', async () => {
    const router = createRouterMock(
      createTodayPlanFixture({
        id: 'gym-plan',
        equipment: [
          'Dumbbells',
          'Barbell',
          'Resistance Bands',
          'Cable Machine',
        ],
      })
    );
    const { handler, store } = createHandler({ router });

    const response = await handler(
      createPlanningRequest({ equipment: ['Gym', 'Dumbbells'] })
    );
    const payload = (await response.json()) as TodayPlan;

    expect(response.status).toBe(200);
    expect(payload.equipment).toEqual(['Gym']);
    expect(store.persistPlan).toHaveBeenCalledWith(
      'device-123',
      expect.objectContaining({ equipment: ['Gym'] }),
      expect.anything()
    );
  });

  it('loads the exercise library lazily for AI generation when a loader is provided', async () => {
    const router = createRouterMock(
      createTodayPlanFixture({ id: 'lazy-candidate-plan' })
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
      })
    );
  });

  it('continues generation when lazy exercise-library loading fails', async () => {
    const router = createRouterMock(
      createTodayPlanFixture({ id: 'lazy-loader-fallback-plan' })
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
      expect.objectContaining({ candidatePool: undefined })
    );

    const loggedWarnings = warnSpy.mock.calls.map((call) => String(call[0]));
    expect(loggedWarnings.join(' ')).toContain('workout catalog unavailable');
    expect(loggedWarnings.join(' ')).toContain('sqlite bindings unavailable');
  });

  it('tries the catalog before returning a provider configuration error', async () => {
    const exerciseLibrary = createExerciseLibrary();
    const loadExerciseLibrary = jest
      .fn<Promise<ExerciseLibrary | undefined>, []>()
      .mockResolvedValue(exerciseLibrary);
    const { handler, router } = createHandler({
      loadExerciseLibrary,
      config: { defaultApiKeys: {} },
    });

    const response = await handler(
      createRequest({
        timeMinutes: 20,
        focus: 'Smart',
        energy: 'easy',
      })
    );

    expect(response.status).toBe(503);
    expect(router.generate).not.toHaveBeenCalled();
    expect(loadExerciseLibrary).toHaveBeenCalledTimes(1);
    expect(exerciseLibrary.matchWorkoutCatalog).toHaveBeenCalledTimes(1);
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
      })
    );
  });

  it('reuses the variation query path for regeneration without exposing candidate metadata', async () => {
    const previousPlan = createTodayPlanFixture({
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
      createPlanningRequest({ previousResponseId: 'previous-response-id' })
    );
    const payload = (await response.json()) as TodayPlan & {
      baselineExerciseIds?: unknown;
    };

    expect(response.status).toBe(200);
    expect(exerciseLibrary.listVariationCandidates).toHaveBeenCalledTimes(1);
    expect(exerciseLibrary.listVariationCandidates).toHaveBeenCalledWith(
      expect.objectContaining({ baselineExerciseIds: ['fedb:pushups'] })
    );
    expect(payload.baselineExerciseIds).toBeUndefined();
  });

  it('accepts planning-date and baseline workout inputs and records provider provenance', async () => {
    const router = createRouterMock();
    const baselineWorkout = createTodayPlanFixture({
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
      })
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
            baselineWorkoutId: 'plan-fixture',
          }),
        }),
      })
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
      expect.anything()
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
      })
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
            reasons: expect.arrayContaining(['smart-focus']),
          }),
        }),
      })
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
      })
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
      })
    );
    expect(router.generate).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({
        stageOneArtifact: expect.objectContaining({
          mode: 'llm-assisted',
          resolvedFocus: 'Upper Body',
        }),
      })
    );
  });

  it('runs the stage-one planner for explicit broad requests when the candidate pool overflows the prompt budget', async () => {
    const router = createRouterMock();
    const planner = createStageOnePlannerMock();
    const exerciseLibrary = createExerciseLibrary();
    exerciseLibrary.listEligibleExercises = jest.fn(() => ({
      libraryVersion: 'test-library',
      totalEligibleCount: 96,
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

    const response = await handler(createPlanningRequest());

    expect(response.status).toBe(200);
    expect(planner.plan).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({
        planningBrief: expect.objectContaining({
          stagedPlanning: expect.objectContaining({
            mode: 'llm-assisted',
            shouldRun: true,
            reasons: ['candidate-overflow'],
          }),
        }),
      })
    );
    expect(router.generate).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({
        stageOneArtifact: expect.objectContaining({
          selectionIntent: 'balanced_upper',
        }),
      })
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
      })
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
            reasons: expect.arrayContaining(['smart-focus']),
          }),
        }),
      })
    );
  });

  it('passes the stage-one artifact through stateful OpenAI regeneration when provenance matches', async () => {
    const router = createRouterMock();
    const planner = createStageOnePlannerMock();
    const baselineWorkout = createTodayPlanFixture({
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
      })
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
      })
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
      })
    );
  });

  it('passes the stage-one artifact through stateless Gemini regeneration when provider continuity is unavailable', async () => {
    const router = createRouterMock();
    const planner = createStageOnePlannerMock();
    const baselineWorkout = createTodayPlanFixture({
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
        }
      )
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
      })
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
      })
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
          id: 'fedb:row',
          slug: 'bodyweight-row',
          name: 'Bodyweight Row',
          aliases: ['row'],
          description: 'desc',
          instructionSteps: ['step'],
          requiredEquipment: ['bodyweight'],
          optionalEquipment: [],
          focusTags: ['upper_body', 'middle_back'],
          movementTags: ['pull', 'row'],
          styleTags: ['strength'],
          stressorTags: ['upper_body_pull_fatigue'],
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
      })
    );

    expect(response.status).toBe(200);
    expect(router.generate).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({
        candidatePool: expect.objectContaining({
          candidateExercises: [
            expect.objectContaining({ id: 'fedb:pushups' }),
            expect.objectContaining({ id: 'fedb:row' }),
          ],
        }),
      })
    );
  });

  it('uses stateless regeneration when provider continuity does not match the active provider', async () => {
    const router = createRouterMock();
    const baselineWorkout = createTodayPlanFixture({
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
        }
      )
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
      })
    );
  });

  it('uses stateless regeneration when prior response provenance does not match the requested response id', async () => {
    const router = createRouterMock();
    const baselineWorkout = createTodayPlanFixture({
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
        }
      )
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
      })
    );
  });
});
