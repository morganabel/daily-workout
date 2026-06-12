import type {
  ExerciseLibrary,
  ExerciseRecord,
} from '@workout-agent-ce/server-exercise-library';
import { openExerciseLibrary } from '@workout-agent-ce/server-exercise-library';
import type { GenerationContext } from '@workout-agent/shared';
import type { PlanningBrief } from '../types/planning';
import {
  buildExerciseCandidatePool,
  rerankExerciseCandidatePool,
  type ExerciseCandidatePoolSummary,
} from './exercise-library';

const createContext = (
  overrides: Partial<GenerationContext> = {}
): GenerationContext => ({
  userProfile: {
    experienceLevel: 'intermediate',
    preferredStyle: 'strength',
    ...overrides.userProfile,
  },
  preferences: {
    avoid: [],
    injuries: [],
    focusBias: [],
    ...overrides.preferences,
  },
  environment: {
    equipment: ['Bodyweight'],
    timeAvailableMinutes: 45,
    ...overrides.environment,
  },
  recentSessions: overrides.recentSessions ?? [],
  notes: overrides.notes,
});

const createPlanningBrief = (
  overrides: Partial<PlanningBrief> = {}
): PlanningBrief => ({
  provider: 'openai',
  focusMode: 'explicit',
  resolvedFocus: 'Upper Body',
  durationMinutes: 45,
  availableEquipment: ['Bodyweight'],
  energy: 'moderate',
  loadCeiling: 'moderate',
  styleBias: 'strength',
  userConstraints: {
    injuries: [],
    avoid: [],
  },
  unknowns: [],
  disallowedStressors: [],
  recentStressorsToAvoid: [],
  blockIntents: [
    {
      key: 'main',
      title: 'Main Block',
      focus: 'Upper Body',
      durationMinutes: 45,
      objective: 'Emphasize upper-body work.',
      candidateFocusTags: ['upper_body'],
    },
  ],
  variationMode: 'none',
  fallbackMode: 'strict-library',
  fallbackReasons: [],
  regeneration: {
    isRegeneration: false,
    mode: 'initial',
    feedback: [],
    baselineExerciseCount: 0,
  },
  stagedPlanning: {
    mode: 'disabled',
    shouldRun: false,
    reasons: [],
  },
  ...overrides,
});

const createExercise = (
  id: string,
  overrides: Partial<ExerciseRecord> = {}
): ExerciseRecord => ({
  id,
  slug: id,
  name: id,
  aliases: [],
  description: 'desc',
  instructionSteps: ['step'],
  requiredEquipment: ['bodyweight'],
  optionalEquipment: [],
  focusTags: ['upper_body'],
  movementTags: ['compound'],
  styleTags: ['strength'],
  stressorTags: [],
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
  sortKey: 1,
  sourceRefs: [],
  ...overrides,
});

function createExerciseLibrary(exercises: ExerciseRecord[]): ExerciseLibrary {
  return {
    getExerciseById: jest.fn(() => null),
    getExerciseByAlias: jest.fn(() => null),
    countEligibleExercises: jest.fn(() => exercises.length),
    listEligibleExercises: jest.fn(() => ({
      libraryVersion: 'test-library',
      totalEligibleCount: exercises.length,
      exercises,
    })),
    listVariationCandidates: jest.fn(() => ({
      libraryVersion: 'test-library',
      totalEligibleCount: exercises.length,
      exercises,
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
      sourceVersion: 'test',
      builtAt: '2026-04-15T00:00:00.000Z',
      exerciseCount: exercises.length,
      plannerReadyCount: exercises.length,
    })),
    close: jest.fn(),
  };
}

describe('buildExerciseCandidatePool', () => {
  it('creates soft upper-body buckets against the 64-candidate prompt budget', () => {
    const pushExercises = Array.from({ length: 80 }, (_, index) =>
      createExercise(`push-${index}`, {
        name: `Push ${index}`,
        movementTags: ['compound', 'push', 'press'],
        stressorTags: ['upper_body_push_fatigue'],
      })
    );
    const rowExercises = Array.from({ length: 2 }, (_, index) =>
      createExercise(`row-${index}`, {
        name: `Row ${index}`,
        focusTags: ['upper_body', 'lats', 'middle_back'],
        movementTags: ['compound', 'pull', 'row'],
        stressorTags: ['upper_body_pull_fatigue'],
      })
    );
    const accessoryExercises = Array.from({ length: 40 }, (_, index) =>
      createExercise(`accessory-${index}`, {
        name: `Accessory ${index}`,
        movementTags: ['isolation'],
      })
    );
    const library = createExerciseLibrary([
      ...pushExercises,
      ...rowExercises,
      ...accessoryExercises,
    ]);

    const pool = buildExerciseCandidatePool({
      exerciseLibrary: library,
      request: { focus: 'Upper Body' },
      context: createContext(),
      planningBrief: createPlanningBrief(),
    });

    expect(pool.candidateExercises).toHaveLength(64);
    expect(pool.candidateBuckets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'main:upper_push',
          quota: 26,
          selectedCount: expect.any(Number),
          shortfall: 0,
        }),
        expect.objectContaining({
          key: 'main:upper_back_pull',
          quota: 25,
          availableCount: 2,
          selectedCount: 2,
          shortfall: 23,
        }),
        expect.objectContaining({
          key: 'main:upper_accessory_or_other',
          quota: 13,
        }),
      ])
    );
    expect(pool.diagnostics?.buckets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'main:upper_back_pull',
          shortfall: 23,
        }),
      ])
    );
  });

  it('selects higher-scoring candidates within each bucket before applying quotas', () => {
    const pushExercises = Array.from({ length: 26 }, (_, index) =>
      createExercise(`push-${index}`, {
        name: `Push ${index}`,
        movementTags: ['compound', 'push', 'press'],
        stressorTags: ['upper_body_push_fatigue'],
      })
    );
    const weakPullExercises = Array.from({ length: 25 }, (_, index) =>
      createExercise(`weak-pull-${index}`, {
        name: `Weak Pull ${index}`,
        focusTags: ['upper_body', 'lats'],
        movementTags: ['isolation'],
      })
    );
    const strongPullExercise = createExercise('strong-row', {
      name: 'Strong Row',
      focusTags: ['upper_body', 'lats', 'middle_back'],
      movementTags: ['compound', 'pull', 'row'],
      stressorTags: ['upper_body_pull_fatigue'],
    });
    const accessoryExercises = Array.from({ length: 13 }, (_, index) =>
      createExercise(`accessory-${index}`, {
        name: `Accessory ${index}`,
        movementTags: ['isolation'],
      })
    );
    const library = createExerciseLibrary([
      ...pushExercises,
      ...weakPullExercises,
      strongPullExercise,
      ...accessoryExercises,
    ]);

    const pool = buildExerciseCandidatePool({
      exerciseLibrary: library,
      request: { focus: 'Upper Body' },
      context: createContext(),
      planningBrief: createPlanningBrief(),
    });
    const pullBucket = pool.candidateBuckets?.find(
      (bucket) => bucket.key === 'main:upper_back_pull'
    );

    expect(pullBucket?.availableCount).toBe(26);
    expect(pullBucket?.candidateExercises).toHaveLength(25);
    expect(
      pullBucket?.candidateExercises.map((candidate) => candidate.id)
    ).toContain('strong-row');
    expect(
      pullBucket?.candidateExercises.map((candidate) => candidate.id)
    ).not.toContain('weak-pull-24');
  });

  it('uses all planning block intents for retrieval and candidate grouping', () => {
    const library = createExerciseLibrary([
      createExercise('push', {
        movementTags: ['compound', 'push'],
      }),
      createExercise('cardio', {
        focusTags: ['conditioning'],
        movementTags: ['conditioning'],
        styleTags: ['cardio'],
      }),
    ]);
    const planningBrief = createPlanningBrief({
      blockIntents: [
        {
          key: 'primary',
          title: 'Primary',
          focus: 'Upper Body',
          durationMinutes: 30,
          objective: 'Lift.',
          candidateFocusTags: ['upper_body'],
        },
        {
          key: 'addon',
          title: 'Add-on',
          focus: 'Conditioning',
          durationMinutes: 15,
          objective: 'Condition.',
          candidateFocusTags: ['conditioning'],
        },
      ],
    });

    const pool = buildExerciseCandidatePool({
      exerciseLibrary: library,
      request: { focus: 'Upper Body + Conditioning' },
      context: createContext(),
      planningBrief,
    });

    expect(library.listEligibleExercises).toHaveBeenCalledWith(
      expect.objectContaining({
        focusTags: expect.arrayContaining(['upper_body', 'conditioning']),
        blockRole: undefined,
      })
    );
    expect(pool.candidateBuckets?.map((bucket) => bucket.key)).toEqual(
      expect.arrayContaining(['addon'])
    );
  });

  it('reports upper-back-pull shortfall for bodyweight-only upper body in the real library', () => {
    const library = openExerciseLibrary();

    try {
      const pool = buildExerciseCandidatePool({
        exerciseLibrary: library,
        request: { focus: 'Upper Body', equipment: ['Bodyweight'] },
        context: createContext(),
        planningBrief: createPlanningBrief(),
      });
      const backPullBucket = pool.candidateBuckets?.find(
        (bucket) => bucket.key === 'main:upper_back_pull'
      );

      expect(backPullBucket).toBeDefined();
      expect(backPullBucket?.availableCount).toBeLessThan(
        backPullBucket?.quota ?? 0
      );
      expect(backPullBucket?.shortfall).toBeGreaterThan(0);
    } finally {
      library.close();
    }
  });
});

describe('rerankExerciseCandidatePool', () => {
  it('reranks within buckets without globally undoing stratification', () => {
    const pool: ExerciseCandidatePoolSummary = {
      libraryVersion: 'test-library',
      totalEligibleCount: 3,
      baselineExerciseIds: [],
      candidateExercises: [
        {
          id: 'push',
          name: 'Push',
          focusTags: ['upper_body'],
          movementTags: ['push'],
          styleTags: ['strength'],
        },
        {
          id: 'squat',
          name: 'Squat',
          focusTags: ['lower_body'],
          movementTags: ['squat'],
          styleTags: ['strength'],
        },
        {
          id: 'row',
          name: 'Row',
          focusTags: ['upper_body', 'middle_back'],
          movementTags: ['pull', 'row'],
          styleTags: ['strength'],
        },
      ],
      candidateBuckets: [
        {
          key: 'main:upper_push',
          title: 'Upper Push',
          quota: 1,
          availableCount: 1,
          selectedCount: 1,
          shortfall: 0,
          candidateExercises: [
            {
              id: 'push',
              name: 'Push',
              focusTags: ['upper_body'],
              movementTags: ['push'],
              styleTags: ['strength'],
            },
          ],
        },
        {
          key: 'main:upper_back_pull',
          title: 'Upper Back Pull',
          quota: 2,
          availableCount: 2,
          selectedCount: 2,
          shortfall: 0,
          candidateExercises: [
            {
              id: 'squat',
              name: 'Squat',
              focusTags: ['lower_body'],
              movementTags: ['squat'],
              styleTags: ['strength'],
            },
            {
              id: 'row',
              name: 'Row',
              focusTags: ['upper_body', 'middle_back'],
              movementTags: ['pull', 'row'],
              styleTags: ['strength'],
            },
          ],
        },
      ],
      query: {},
    };

    const reranked = rerankExerciseCandidatePool(pool, {
      mode: 'llm-assisted',
      confidence: 'high',
      planningIntent: 'Prefer rows and pulling work.',
      resolvedFocus: 'Upper Body Pull',
      protectStressors: [],
      avoidStressors: [],
      styleBiases: ['strength'],
      noveltyTarget: 'medium',
      selectionIntent: 'pull_biased',
      rerankHints: ['row pull middle back'],
      candidateInstructions: ['use a row'],
    });

    expect(
      reranked.candidateExercises.map((candidate) => candidate.id)
    ).toEqual(['push', 'row', 'squat']);
    expect(
      reranked.candidateBuckets?.[1]?.candidateExercises.map(
        (candidate) => candidate.id
      )
    ).toEqual(['row', 'squat']);
  });
});
