import {
  ADAPTIVE_PPL_CONDITIONING_BLOCKS,
  adaptivePlanIntentSchema,
  adaptiveTrainingPlanSchema,
  buildGenerationRequestFromQuickActions,
  createAdaptiveTrainingPlanFromTemplate,
  createTrainingBlueprintFromOnboarding,
  createTodayPlanMock,
  normalizeQuickActionValue,
  plannedSlotMetadataSchema,
  selectTrainingTemplateId,
  supportsAdaptiveTrainingPlan,
  TRAINING_TEMPLATE_DEFINITIONS,
  workoutSetLogSchema,
  workoutExerciseLogSchema,
  workoutSessionDetailSchema,
  workoutLogPayloadSchema,
  generationRequestSchema,
  generationRequestPayloadSchema,
  MAX_UPCOMING_EVENTS,
  createSessionDetailMock,
  createWorkoutExerciseLogMock,
  createWorkoutSetLogMock,
  EQUIPMENT_OPTIONS,
  GYM_EQUIPMENT,
  isAutoFocus,
  normalizeEquipmentSelection,
  todayPlanSchema,
  userPreferencesSchema,
  type GenerationRequest,
  type QuickActionPreset,
} from './workouts';

const createPreset = (
  overrides: Partial<QuickActionPreset>
): QuickActionPreset =>
  ({
    key: 'time',
    label: 'Time',
    value: '30',
    description: '30 minutes',
    stagedValue: null,
    ...overrides,
  } as QuickActionPreset);

describe('quick action helpers', () => {
  it('normalizes individual quick action values', () => {
    const timeResult = normalizeQuickActionValue(
      createPreset({ key: 'time', stagedValue: '95' })
    );
    expect(timeResult).toEqual({ timeMinutes: 95 });

    const focusResult = normalizeQuickActionValue(
      createPreset({
        key: 'focus',
        stagedValue: '  Lower Body  ',
      })
    );
    expect(focusResult).toEqual({ focus: 'Lower Body' });

    const equipmentResult = normalizeQuickActionValue(
      createPreset({
        key: 'equipment',
        stagedValue: 'Dumbbells, Bands,  Bench ',
      })
    );
    expect(equipmentResult).toEqual({
      equipment: ['Dumbbells', 'Bands', 'Bench'],
    });

    const energyResult = normalizeQuickActionValue(
      createPreset({ key: 'energy', stagedValue: 'Intense' })
    );
    expect(energyResult).toEqual({ energy: 'intense' });

    const backfillResult = normalizeQuickActionValue(
      createPreset({ key: 'backfill', stagedValue: 'YES' })
    );
    expect(backfillResult).toEqual({ backfill: true });

    const smartFocusResult = normalizeQuickActionValue(
      createPreset({
        key: 'focus',
        stagedValue: 'Smart',
      })
    );
    expect(smartFocusResult).toEqual({ focus: 'Smart' });
  });

  it('builds a generation request from quick actions and base defaults', () => {
    const quickActions: QuickActionPreset[] = [
      createPreset({ key: 'time', stagedValue: '45' }),
      createPreset({ key: 'focus', stagedValue: 'Upper Body' }),
      createPreset({
        key: 'equipment',
        stagedValue: 'Bodyweight, Rings',
      }),
      createPreset({ key: 'energy', stagedValue: 'easy' }),
    ];

    const base: Partial<GenerationRequest> = { notes: 'Morning session' };
    const request = buildGenerationRequestFromQuickActions(quickActions, base);

    expect(request).toEqual({
      timeMinutes: 45,
      focus: 'Upper Body',
      equipment: ['Bodyweight', 'Rings'],
      energy: 'easy',
      notes: 'Morning session',
    });
  });

  it('ignores invalid quick action values', () => {
    const quickActions: QuickActionPreset[] = [
      createPreset({ key: 'time', stagedValue: 'abc' }),
      createPreset({ key: 'energy', stagedValue: 'supercharged' }),
      createPreset({ key: 'equipment', stagedValue: '' }),
    ];

    const request = buildGenerationRequestFromQuickActions(quickActions);
    expect(request).toEqual({});
  });

  it('equipment only uses stagedValue, not default value (to allow profile fallback)', () => {
    // Equipment with a display value but no staged value should NOT be included
    // This allows the API layer to fall back to user profile equipment
    const equipmentWithDefaultOnly = normalizeQuickActionValue(
      createPreset({
        key: 'equipment',
        value: 'Dumbbells', // display value
        stagedValue: null, // user didn't explicitly select
      })
    );
    expect(equipmentWithDefaultOnly).toEqual({});

    // Other quick actions still use value as fallback
    const timeWithDefaultOnly = normalizeQuickActionValue(
      createPreset({
        key: 'time',
        value: '30',
        stagedValue: null,
      })
    );
    expect(timeWithDefaultOnly).toEqual({ timeMinutes: 30 });
  });

  it('exposes Gym as a compact equipment preset', () => {
    expect(EQUIPMENT_OPTIONS).toContain('Gym');

    const equipmentResult = normalizeQuickActionValue(
      createPreset({
        key: 'equipment',
        stagedValue: 'Gym',
      })
    );

    expect(equipmentResult).toEqual({ equipment: ['Gym'] });
  });

  it('normalizes Gym as mutually exclusive equipment', () => {
    expect(
      normalizeEquipmentSelection(['Gym', 'Dumbbells', 'Resistance Bands'])
    ).toEqual([GYM_EQUIPMENT]);
    expect(normalizeEquipmentSelection(['  Dumbbells ', 'Bench'])).toEqual([
      'Dumbbells',
      'Bench',
    ]);
  });
});

describe('workout logging contracts', () => {
  it('parses a session detail mock without errors', () => {
    const session = createSessionDetailMock();
    const parsed = workoutSessionDetailSchema.parse(session);
    expect(parsed.exercises).toHaveLength(1);
  });

  it('requires weightUnit when weight is provided', () => {
    const setLog = createWorkoutSetLogMock({ weightUnit: undefined });
    expect(() => workoutSetLogSchema.parse(setLog)).toThrow();
  });

  it('allows weightUnit to be omitted when weight is absent', () => {
    const setLog = createWorkoutSetLogMock({
      weight: undefined,
      weightUnit: undefined,
    });
    const parsed = workoutSetLogSchema.parse(setLog);
    expect(parsed.weightUnit).toBeUndefined();
  });

  it('accepts a log payload with exercises', () => {
    const payload = workoutLogPayloadSchema.parse({
      durationSeconds: 1200,
      exercises: [createWorkoutExerciseLogMock()],
    });
    expect(payload.exercises).toHaveLength(1);
  });

  it('accepts a completion-only log payload', () => {
    const payload = workoutLogPayloadSchema.parse({});
    expect(payload.exercises).toBeUndefined();
  });

  it('parses exercise logs with set arrays', () => {
    const exercise = createWorkoutExerciseLogMock({
      sets: [createWorkoutSetLogMock({ reps: 8 })],
    });
    const parsed = workoutExerciseLogSchema.parse(exercise);
    expect(parsed.sets[0].reps).toBe(8);
  });
});

describe('isAutoFocus', () => {
  it('returns true for "smart" (case-insensitive)', () => {
    expect(isAutoFocus('smart')).toBe(true);
    expect(isAutoFocus('Smart')).toBe(true);
    expect(isAutoFocus('SMART')).toBe(true);
  });

  it('returns true for "auto" (case-insensitive)', () => {
    expect(isAutoFocus('auto')).toBe(true);
    expect(isAutoFocus('Auto')).toBe(true);
    expect(isAutoFocus('AUTO')).toBe(true);
  });

  it('handles whitespace around the value', () => {
    expect(isAutoFocus('  smart  ')).toBe(true);
    expect(isAutoFocus(' auto ')).toBe(true);
  });

  it('returns false for specific focus values', () => {
    expect(isAutoFocus('Push')).toBe(false);
    expect(isAutoFocus('Pull')).toBe(false);
    expect(isAutoFocus('Legs')).toBe(false);
    expect(isAutoFocus('Core')).toBe(false);
    expect(isAutoFocus('Cardio')).toBe(false);
  });

  it('returns false for undefined or empty values', () => {
    expect(isAutoFocus(undefined)).toBe(false);
    expect(isAutoFocus('')).toBe(false);
    expect(isAutoFocus('   ')).toBe(false);
  });
});

describe('generation request upcoming events', () => {
  it('accepts up to the maximum upcoming events', () => {
    const upcomingEvents = Array.from(
      { length: MAX_UPCOMING_EVENTS },
      (_, index) => ({
        kind: 'hike',
        title: `Trail ${index + 1}`,
        localDate: '2025-06-0' + ((index % 9) + 1),
      })
    );

    const result = generationRequestSchema.safeParse({
      timeMinutes: 30,
      upcomingEvents,
    });

    expect(result.success).toBe(true);
  });

  it('rejects requests with too many upcoming events', () => {
    const upcomingEvents = Array.from(
      { length: MAX_UPCOMING_EVENTS + 1 },
      (_, index) => ({
        kind: 'run',
        title: `Run ${index + 1}`,
        localDate: '2025-06-15',
      })
    );

    const result = generationRequestSchema.safeParse({ upcomingEvents });
    expect(result.success).toBe(false);
  });

  it('accepts planning-date and baseline-workout regeneration fields', () => {
    const baselineWorkout = createTodayPlanMock({
      responseId: 'resp-baseline',
      generationProvenance: {
        provider: 'openai',
        responseId: 'resp-baseline',
      },
    });

    const result = generationRequestSchema.safeParse({
      planningDateLocal: '2026-04-15',
      previousResponseId: 'resp-baseline',
      baselineWorkout,
      feedback: ['different-exercises'],
    });

    expect(result.success).toBe(true);
  });

  it('accepts context payloads for regeneration requests', () => {
    const result = generationRequestPayloadSchema.safeParse({
      previousResponseId: 'resp-baseline',
      planningDateLocal: '2026-04-15',
      context: {
        userProfile: {
          experienceLevel: 'beginner',
        },
        preferences: {
          injuries: ['knee'],
        },
        environment: {
          equipment: ['Bodyweight'],
          timeAvailableMinutes: 30,
        },
        recentSessions: [],
      },
    });

    expect(result.success).toBe(true);
  });

  it('rejects planned-slot intent because generation uses adaptive intent only', () => {
    const result = generationRequestSchema.safeParse({
      planningDateLocal: '2026-04-15',
      plannedSlotIntent: {
        role: 'pull',
        label: 'Pull',
        targetDurationMinutes: 45,
        plannedDate: '2026-04-15',
        templateId: 'ppl-conditioning',
        slotId: 'day-2-pull',
        equipmentLocationAssumptions: {
          environment: 'gym',
          equipment: [GYM_EQUIPMENT],
        },
      },
    });

    expect(result.success).toBe(false);
  });

  it('accepts adaptive plan intent with combined blocks', () => {
    const result = generationRequestSchema.safeParse({
      planningDateLocal: '2026-04-15',
      adaptivePlanIntent: {
        planId: 'plan-ppl',
        recommendationId: 'rec-1',
        sourceTemplateId: 'ppl-conditioning',
        primaryBlock: {
          blockId: 'pull',
          label: 'Pull',
          category: 'strength',
          role: 'pull',
          targetDurationMinutes: 45,
          stressTags: ['upper-body', 'pull'],
        },
        addOnBlocks: [
          {
            blockId: 'easy-cardio',
            label: 'Easy Cardio',
            category: 'cardio',
            role: 'easy-cardio',
            targetDurationMinutes: 20,
            stressTags: ['low-impact', 'aerobic'],
          },
        ],
        targetRangeContext: [
          {
            targetId: 'cardio',
            label: 'Cardio',
            count: 1,
            minCount: 2,
            maxCount: 3,
            windowDays: 7,
          },
        ],
        rationale: [
          {
            code: 'target-gap',
            message: 'Cardio is below the target range.',
          },
        ],
        projectionStatus: 'projected',
      },
    });

    expect(result.success).toBe(true);
  });
});

describe('training blueprint contracts', () => {
  it('selects deterministic templates from onboarding answers', () => {
    expect(
      selectTrainingTemplateId({
        goal: 'general-fitness',
        experienceLevel: 'intermediate',
        environment: 'home',
        equipment: ['Dumbbells'],
      })
    ).toBe('balanced-foundation');

    expect(
      selectTrainingTemplateId({
        goal: 'build-muscle',
        experienceLevel: 'beginner',
        environment: 'gym',
        equipment: [GYM_EQUIPMENT],
      })
    ).toBe('hypertrophy-foundation');

    expect(
      selectTrainingTemplateId({
        goal: 'build-muscle',
        experienceLevel: 'intermediate',
        environment: 'gym',
        equipment: [GYM_EQUIPMENT],
      })
    ).toBe('ppl-conditioning');

    expect(
      selectTrainingTemplateId({
        goal: 'run-cardio',
        experienceLevel: 'beginner',
        environment: 'home',
        equipment: ['Bodyweight'],
      })
    ).toBe('endurance-support');

    expect(
      selectTrainingTemplateId({
        goal: 'lose-fat',
        experienceLevel: 'intermediate',
        environment: 'home',
        equipment: ['Bodyweight'],
      })
    ).toBe('fat-loss-conditioning');

    expect(
      selectTrainingTemplateId({
        goal: 'mobility',
        experienceLevel: 'beginner',
        environment: 'home',
        equipment: ['Bodyweight'],
      })
    ).toBe('mobility-foundation');

    expect(
      selectTrainingTemplateId({
        goal: 'mobility',
        experienceLevel: 'beginner',
        environment: 'travel',
        equipment: ['Bodyweight'],
      })
    ).toBe('mobility-foundation');

    expect(
      selectTrainingTemplateId({
        goal: 'run-cardio',
        experienceLevel: 'intermediate',
        environment: 'travel',
        equipment: ['Bodyweight'],
      })
    ).toBe('busy-travel');

    expect(
      selectTrainingTemplateId({
        goal: 'build-muscle',
        experienceLevel: 'beginner',
        environment: 'home',
        equipment: ['Bodyweight'],
      })
    ).toBe('busy-travel');

    expect(
      selectTrainingTemplateId({
        goal: 'general-fitness',
        experienceLevel: 'advanced',
        environment: 'travel',
        equipment: ['Bodyweight'],
      })
    ).toBe('busy-travel');
  });

  it('creates a valid blueprint from onboarding answers', () => {
    const blueprint = createTrainingBlueprintFromOnboarding(
      {
        goal: 'build-strength',
        experienceLevel: 'beginner',
        environment: 'home',
        equipment: ['Dumbbells'],
      },
      { updatedAt: '2026-04-15T12:00:00.000Z' }
    );

    expect(blueprint).toMatchObject({
      templateId: 'strength-foundation',
      setupStatus: 'completed',
      editStatus: 'accepted',
      horizonDays: 7,
      equipmentLocationAssumptions: {
        environment: 'home',
        equipment: ['Dumbbells'],
      },
    });
    expect(blueprint.slotSequence).toEqual(
      TRAINING_TEMPLATE_DEFINITIONS['strength-foundation'].slotSequence
    );
  });

  it('parses existing preferences without blueprint fields', () => {
    const result = userPreferencesSchema.safeParse({
      equipment: ['Dumbbells'],
      experienceLevel: 'beginner',
      primaryGoal: 'Build strength',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.trainingBlueprint).toBeUndefined();
      expect(result.data.adaptiveTrainingPlan).toBeUndefined();
      expect(result.data.injuries).toEqual([]);
      expect(result.data.avoid).toEqual([]);
    }
  });

  it('creates a valid adaptive PPL conditioning plan from template data', () => {
    const plan = createAdaptiveTrainingPlanFromTemplate('ppl-conditioning', {
      id: 'plan-ppl',
      activeFrom: '2026-04-15',
      updatedAt: '2026-04-15T12:00:00.000Z',
    });

    expect(plan).toBeDefined();
    if (!plan) {
      throw new Error('Expected adaptive plan');
    }
    const result = adaptiveTrainingPlanSchema.safeParse(plan);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.blocks.map((block) => block.label)).toEqual(
        expect.arrayContaining([
          'Push',
          'Pull',
          'Legs',
          'Easy Cardio',
          'Sprint',
          'Abs / Accessory',
          'Mobility',
          'Rest',
        ])
      );
      expect(result.data.targetRanges).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ label: 'Lift', minCount: 3, maxCount: 5 }),
          expect.objectContaining({
            label: 'Cardio',
            minCount: 2,
            maxCount: 3,
          }),
          expect.objectContaining({
            label: 'Sprint',
            minCount: 1,
            maxCount: 1,
          }),
        ])
      );
      expect(
        result.data.recommendationSettings.preferredRotationBlockIds
      ).toEqual(['push', 'pull', 'legs']);
    }
  });

  it('creates a distinct adaptive plan for every onboarding template', () => {
    const expectedTemplateSummaries = {
      'balanced-foundation': {
        blocks: ['full-body-strength', 'conditioning', 'flexible-movement'],
        primaryTargets: ['strength'],
      },
      'strength-foundation': {
        blocks: ['strength-heavy', 'strength-volume', 'lower-strength'],
        primaryTargets: ['strength'],
      },
      'hypertrophy-foundation': {
        blocks: ['upper-hypertrophy', 'lower-hypertrophy', 'full-body-pump'],
        primaryTargets: ['hypertrophy'],
      },
      'ppl-conditioning': {
        blocks: ['push', 'pull', 'legs', 'sprint'],
        primaryTargets: ['lift'],
      },
      'fat-loss-conditioning': {
        blocks: ['strength-circuit', 'zone2-cardio', 'intervals'],
        primaryTargets: ['conditioning'],
      },
      'endurance-support': {
        blocks: ['easy-cardio', 'intervals', 'strength-support'],
        primaryTargets: ['cardio'],
      },
      'mobility-foundation': {
        blocks: ['mobility-flow', 'stability-strength', 'easy-cardio'],
        primaryTargets: ['mobility'],
      },
      'busy-travel': {
        blocks: ['quick-strength', 'quick-conditioning', 'flexible-movement'],
        primaryTargets: ['strength'],
      },
    } satisfies Record<
      keyof typeof TRAINING_TEMPLATE_DEFINITIONS,
      { blocks: string[]; primaryTargets: string[] }
    >;

    Object.keys(expectedTemplateSummaries).forEach((templateId) => {
      const typedTemplateId =
        templateId as keyof typeof TRAINING_TEMPLATE_DEFINITIONS;
      const plan = createAdaptiveTrainingPlanFromTemplate(typedTemplateId, {
        id: `${templateId}-plan`,
        activeFrom: '2026-04-15',
        updatedAt: '2026-04-15T12:00:00.000Z',
      });

      expect(supportsAdaptiveTrainingPlan(typedTemplateId)).toBe(true);
      expect(plan).toBeDefined();
      expect(adaptiveTrainingPlanSchema.safeParse(plan).success).toBe(true);
      expect(plan.blocks.map((block) => block.id)).toEqual(
        expect.arrayContaining(
          expectedTemplateSummaries[typedTemplateId].blocks
        )
      );
      expect(
        plan.targetRanges
          .filter((target) => target.priority === 'primary')
          .map((target) => target.id)
      ).toEqual(
        expect.arrayContaining(
          expectedTemplateSummaries[typedTemplateId].primaryTargets
        )
      );
    });
  });

  it('rejects invalid adaptive target ranges', () => {
    const plan = createAdaptiveTrainingPlanFromTemplate('ppl-conditioning', {
      id: 'plan-ppl',
      activeFrom: '2026-04-15',
      updatedAt: '2026-04-15T12:00:00.000Z',
    });
    if (!plan) {
      throw new Error('Expected adaptive plan');
    }

    const result = adaptiveTrainingPlanSchema.safeParse({
      ...plan,
      targetRanges: [
        {
          id: 'lift',
          label: 'Lift',
          appliesTo: {
            blockIds: ['push'],
            categories: ['strength'],
            stressTags: [],
          },
          windowDays: 7,
          minCount: 5,
          maxCount: 3,
          priority: 'primary',
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it('rejects adaptive block compatibility references to unknown blocks', () => {
    const plan = createAdaptiveTrainingPlanFromTemplate('ppl-conditioning', {
      id: 'plan-ppl',
      activeFrom: '2026-04-15',
      updatedAt: '2026-04-15T12:00:00.000Z',
    });
    if (!plan) {
      throw new Error('Expected adaptive plan');
    }

    const result = adaptiveTrainingPlanSchema.safeParse({
      ...plan,
      blocks: [
        {
          ...ADAPTIVE_PPL_CONDITIONING_BLOCKS[0],
          compatibleAddOnBlockIds: ['unknown-block'],
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it('rejects adaptive block target contributions to unknown targets', () => {
    const plan = createAdaptiveTrainingPlanFromTemplate('ppl-conditioning', {
      id: 'plan-ppl',
      activeFrom: '2026-04-15',
      updatedAt: '2026-04-15T12:00:00.000Z',
    });
    if (!plan) {
      throw new Error('Expected adaptive plan');
    }

    const result = adaptiveTrainingPlanSchema.safeParse({
      ...plan,
      blocks: plan.blocks.map((block) =>
        block.id === 'push'
          ? {
              ...block,
              targetContributions: [{ targetId: 'unknown-target', count: 1 }],
            }
          : block
      ),
    });

    expect(result.success).toBe(false);
  });

  it('validates standalone adaptive plan intent', () => {
    const result = adaptivePlanIntentSchema.safeParse({
      planId: 'plan-ppl',
      primaryBlock: {
        blockId: 'push',
        label: 'Push',
        category: 'strength',
      },
      addOnBlocks: [
        {
          blockId: 'abs-accessory',
          label: 'Abs / Accessory',
          category: 'accessory',
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it('validates minimal versioned planned-slot metadata', () => {
    const result = plannedSlotMetadataSchema.safeParse({
      schemaVersion: 1,
      ownership: 'app',
      source: 'training-blueprint',
      templateId: 'ppl-conditioning',
      slotId: 'day-2-pull',
      slotRole: 'pull',
      slotLabel: 'Pull',
      plannedDate: '2026-04-15',
      targetDurationMinutes: 45,
      equipmentLocationAssumptions: {
        environment: 'gym',
        equipment: [GYM_EQUIPMENT],
      },
      detailState: 'not-generated',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.locked).toBe(false);
      expect(result.data.userEdited).toBe(false);
    }
  });
});

describe('today plan provenance', () => {
  it('accepts minimal regeneration provenance on the canonical plan', () => {
    const result = todayPlanSchema.safeParse(
      createTodayPlanMock({
        responseId: 'resp-generated',
        generationProvenance: {
          provider: 'gemini',
          responseId: 'resp-generated',
        },
      })
    );

    expect(result.success).toBe(true);
  });

  it('continues to accept plans without regeneration provenance', () => {
    const result = todayPlanSchema.safeParse(createTodayPlanMock());

    expect(result.success).toBe(true);
  });
});
