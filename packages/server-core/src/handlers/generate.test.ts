import {
  createTodayPlanMock,
  type GenerationContext,
  type GenerationRequest,
  type TodayPlan,
} from '@workout-agent/shared';
import type { ExerciseLibrary } from '@workout-agent-ce/server-exercise-library';
import { createGenerateHandler } from './generate';
import type {
  AuthProvider,
  AuthResult,
  GenerationStore,
  GenerationState,
  ModelRouter,
} from '../types';

const createAuth = (): AuthProvider => ({
  authenticate: jest.fn(
    async () =>
      ({
        userId: 'user-1',
        principalId: 'device-1',
      }) satisfies AuthResult,
  ),
});

const createStore = (plan: TodayPlan | null = null): GenerationStore => ({
  getState: jest.fn(
    async () =>
      ({
        plan,
        generationStatus: { state: 'idle', submittedAt: null },
      }) satisfies GenerationState,
  ),
  markPending: jest.fn(async () => undefined),
  persistPlan: jest.fn(async () => undefined),
  setError: jest.fn(async () => undefined),
  clearPlan: jest.fn(async () => undefined),
});

const createRouter = (plan = createTodayPlanMock()): ModelRouter => ({
  generate: jest.fn(async () => ({
    plan,
    responseId: 'resp-1',
    schemaVersion: 'v1-current',
  })),
  isSupportedProvider: jest.fn(() => true),
  getDefaultProvider: jest.fn(() => 'openai'),
});

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

const createExerciseLibrary = (): ExerciseLibrary => ({
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
});

const createRequest = (
  body: Partial<GenerationRequest & { context: GenerationContext }> = {},
) =>
  new Request('http://localhost/api/workouts/generate', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: 'Bearer test-token',
      'x-openai-key': 'test-key',
    },
    body: JSON.stringify({
      timeMinutes: 30,
      focus: 'Upper Body',
      context: baseContext,
      ...body,
    }),
  });

describe('createGenerateHandler exercise library integration', () => {
  it('builds a candidate pool on normal generation without changing the public response', async () => {
    const auth = createAuth();
    const store = createStore();
    const router = createRouter();
    const exerciseLibrary = createExerciseLibrary();
    const handler = createGenerateHandler({
      auth,
      store,
      router,
      exerciseLibrary,
      config: { edition: 'CE', defaultProvider: 'openai' },
    });

    const response = await handler(createRequest());
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
          candidateExercises: [{ id: 'fedb:pushups', name: 'Pushups' }],
          searchText: expect.any(String),
        }),
      }),
    );
    expect(payload.focus).toBeDefined();
    expect(payload.candidateExercises).toBeUndefined();
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
    const auth = createAuth();
    const store = createStore(previousPlan);
    const router = createRouter();
    const exerciseLibrary = createExerciseLibrary();
    const handler = createGenerateHandler({
      auth,
      store,
      router,
      exerciseLibrary,
      config: { edition: 'CE', defaultProvider: 'openai' },
    });

    const response = await handler(
      createRequest({ previousResponseId: 'previous-response-id' }),
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
});
