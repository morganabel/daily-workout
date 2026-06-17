import {
  ADAPTIVE_PPL_CONDITIONING_BLOCKS,
  coachProjectionSchema,
  coachProgramAttributionSchema,
  coachSessionActionSchema,
  createCoachProgramStrategyRevision,
  adaptivePlanIntentSchema,
  adaptiveTrainingPlanSchema,
  buildGenerationRequestFromQuickActions,
  createAdaptiveTrainingPlanFromTemplate,
  createTrainingBlueprintFromOnboarding,
  exerciseSlotPolicySchema,
  migrateAdaptiveTrainingPlanToCoachProgramAware,
  normalizeQuickActionValue,
  plannedSlotMetadataSchema,
  selectCoachStrategyForTemplate,
  selectTrainingTemplateId,
  supportsAdaptiveTrainingPlan,
  TRAINING_TEMPLATE_DEFINITIONS,
  trainingTemplateDefinitionSchema,
  workoutSetLogSchema,
  workoutExerciseLogSchema,
  workoutSessionDetailSchema,
  generationRequestSchema,
  generationRequestPayloadSchema,
  generationContextSchema,
  MAX_UPCOMING_EVENTS,
  EQUIPMENT_OPTIONS,
  GYM_EQUIPMENT,
  isAutoFocus,
  normalizeEquipmentSelection,
  resolveWorkoutCreationMode,
  todayPlanSchema,
  userPreferencesSchema,
  type GenerationRequest,
  type QuickActionPreset,
  type StarterWeekSlot,
} from './workouts';
import {
  createSessionDetailFixture,
  createTodayPlanFixture,
  createWorkoutExerciseLogFixture,
  createWorkoutSetLogFixture,
} from '../testing/workout-fixtures';

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

const hardLiftRoles = new Set([
  'upper',
  'lower',
  'push',
  'pull',
  'legs',
  'full-body',
]);

const countHardLiftSlots = (slots: StarterWeekSlot[]): number =>
  slots.filter((slot) => hardLiftRoles.has(slot.role)).length;

const maxConsecutiveHardLiftSlots = (slots: StarterWeekSlot[]): number => {
  const sortedSlots = [...slots].sort((a, b) => a.dayOffset - b.dayOffset);
  let current = 0;
  let max = 0;

  sortedSlots.forEach((slot) => {
    if (hardLiftRoles.has(slot.role)) {
      current += 1;
      max = Math.max(max, current);
      return;
    }

    current = 0;
  });

  return max;
};

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
  it('parses a session detail fixture without errors', () => {
    const session = createSessionDetailFixture();
    const parsed = workoutSessionDetailSchema.parse(session);
    expect(parsed.exercises).toHaveLength(1);
  });

  it('requires weightUnit when weight is provided', () => {
    const setLog = createWorkoutSetLogFixture({ weightUnit: undefined });
    expect(() => workoutSetLogSchema.parse(setLog)).toThrow();
  });

  it('allows weightUnit to be omitted when weight is absent', () => {
    const setLog = createWorkoutSetLogFixture({
      weight: undefined,
      weightUnit: undefined,
    });
    const parsed = workoutSetLogSchema.parse(setLog);
    expect(parsed.weightUnit).toBeUndefined();
  });

  it('parses exercise logs with set arrays', () => {
    const exercise = createWorkoutExerciseLogFixture({
      sets: [createWorkoutSetLogFixture({ reps: 8 })],
    });
    const parsed = workoutExerciseLogSchema.parse(exercise);
    expect(parsed.sets[0].reps).toBe(8);
  });

  it('accepts richer recent-session generation memory', () => {
    const context = generationContextSchema.parse({
      userProfile: {},
      preferences: {},
      environment: { equipment: ['Dumbbells'] },
      recentSessions: [
        {
          id: 'session-1',
          name: 'Garage Strength',
          completedAt: '2026-04-14T12:00:00.000Z',
          durationMinutes: 45,
          focus: 'Strength',
          exerciseNames: ['Back Squat', 'Bench Press'],
          completedSetCount: 6,
          perceivedEffort: 'intense',
          notes: 'Keep pressing lighter next time.',
        },
      ],
    });

    expect(context.recentSessions[0].exerciseNames).toEqual([
      'Back Squat',
      'Bench Press',
    ]);
    expect(context.recentSessions[0].completedSetCount).toBe(6);
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
  it('accepts explicit workout creation modes', () => {
    for (const creationMode of ['auto', 'library', 'ai'] as const) {
      const result = generationRequestSchema.safeParse({
        timeMinutes: 30,
        creationMode,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.creationMode).toBe(creationMode);
      }
    }
  });

  it('rejects unknown workout creation modes', () => {
    const result = generationRequestSchema.safeParse({
      timeMinutes: 30,
      creationMode: 'fallback',
    });

    expect(result.success).toBe(false);
  });

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
    const baselineWorkout = createTodayPlanFixture({
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

  it('accepts adaptive plan intent with structured exercise slot policy', () => {
    const result = generationRequestSchema.safeParse({
      planningDateLocal: '2026-04-15',
      adaptivePlanIntent: {
        planId: 'plan-ppl',
        programVersion: 2,
        scheduleStrategy: 'ordered-rotation',
        projectionId: 'projection-pull-1',
        planningDateLocal: '2026-04-15',
        sessionDisposition: 'projected',
        recommendationId: 'rec-1',
        sourceTemplateId: 'ppl-conditioning',
        primaryBlock: {
          blockId: 'pull',
          label: 'Pull',
          category: 'strength',
          role: 'pull',
        },
        addOnBlocks: [],
        targetRangeContext: [],
        rationale: [],
        projectionStatus: 'projected',
        exerciseSlotPolicy: {
          slots: [
            {
              id: 'pull-main-pull',
              label: 'Pull main lift',
              sourceBlockId: 'pull',
              role: 'main-lift',
              stabilityPolicy: 'stable',
              movementTags: ['row', 'vertical-pull'],
              focusTags: ['pull', 'upper-body'],
            },
          ],
          currentAssignments: [
            {
              slotId: 'pull-main-pull',
              exerciseName: 'Pull-Up',
              source: 'generated',
            },
          ],
          overrideReasons: [],
        },
      },
    });

    expect(result.success).toBe(true);
  });

  it('rejects slot assignments without an exercise id or name', () => {
    const result = exerciseSlotPolicySchema.safeParse({
      slots: [
        {
          id: 'push-main-press',
          label: 'Push main press',
          sourceBlockId: 'push',
          stabilityPolicy: 'stable',
        },
      ],
      currentAssignments: [
        {
          slotId: 'push-main-press',
          source: 'generated',
        },
      ],
      overrideReasons: [],
    });

    expect(result.success).toBe(false);
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
        goal: 'general-fitness',
        experienceLevel: 'beginner',
        environment: 'gym',
        equipment: [GYM_EQUIPMENT],
      })
    ).toBe('balanced-starter');

    expect(
      selectTrainingTemplateId({
        goal: 'general-fitness',
        experienceLevel: 'advanced',
        environment: 'gym',
        equipment: [GYM_EQUIPMENT],
      })
    ).toBe('balanced-performance');

    expect(
      selectTrainingTemplateId({
        goal: 'build-muscle',
        experienceLevel: 'beginner',
        environment: 'gym',
        equipment: [GYM_EQUIPMENT],
      })
    ).toBe('hypertrophy-starter');

    expect(
      selectTrainingTemplateId({
        goal: 'build-muscle',
        experienceLevel: 'intermediate',
        environment: 'gym',
        equipment: [GYM_EQUIPMENT],
      })
    ).toBe('upper-lower-hypertrophy');

    expect(
      selectTrainingTemplateId({
        goal: 'build-muscle',
        experienceLevel: 'advanced',
        environment: 'gym',
        equipment: [GYM_EQUIPMENT],
      })
    ).toBe('ppl-hypertrophy');

    expect(
      selectTrainingTemplateId({
        goal: 'build-strength',
        experienceLevel: 'beginner',
        environment: 'gym',
        equipment: [GYM_EQUIPMENT],
      })
    ).toBe('strength-starter');

    expect(
      selectTrainingTemplateId({
        goal: 'build-strength',
        experienceLevel: 'advanced',
        environment: 'gym',
        equipment: [GYM_EQUIPMENT],
      })
    ).toBe('strength-performance');

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
      templateId: 'strength-starter',
      setupStatus: 'completed',
      editStatus: 'accepted',
      horizonDays: 7,
      equipmentLocationAssumptions: {
        environment: 'home',
        equipment: ['Dumbbells'],
      },
    });
    expect(blueprint.slotSequence).toEqual(
      TRAINING_TEMPLATE_DEFINITIONS['strength-starter'].slotSequence
    );
    expect(blueprint.coachStrategySelection).toEqual(
      selectCoachStrategyForTemplate('strength-starter')
    );
    expect(blueprint.exerciseSlotTemplates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'full-body-main-lift',
          stabilityPolicy: 'stable',
        }),
        expect.objectContaining({
          id: 'full-body-accessory',
          stabilityPolicy: 'coach-rotatable',
        }),
      ])
    );
  });

  it('seeds exercise slots only for templates that need exercise stability', () => {
    const strengthPlan = createAdaptiveTrainingPlanFromTemplate(
      'ppl-conditioning',
      {
        activeFrom: '2026-04-15',
        updatedAt: '2026-04-15T12:00:00.000Z',
      }
    );
    const flexiblePlan = createAdaptiveTrainingPlanFromTemplate(
      'balanced-foundation',
      {
        activeFrom: '2026-04-15',
        updatedAt: '2026-04-15T12:00:00.000Z',
      }
    );

    expect(strengthPlan.exerciseSlotTemplates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'push-main-press',
          stabilityPolicy: 'stable',
        }),
        expect.objectContaining({
          id: 'pull-accessory',
          stabilityPolicy: 'coach-rotatable',
        }),
      ])
    );
    expect(
      strengthPlan.exerciseSlotTemplates.some(
        (slot) => slot.stabilityPolicy === 'user-locked'
      )
    ).toBe(false);
    expect(flexiblePlan.exerciseSlotTemplates).toEqual([]);
  });

  it('rejects default template slots that are user-locked', () => {
    const template = TRAINING_TEMPLATE_DEFINITIONS['ppl-conditioning'];
    const result = trainingTemplateDefinitionSchema.safeParse({
      ...template,
      adaptivePlanTemplate: {
        ...template.adaptivePlanTemplate,
        exerciseSlotTemplates: [
          {
            id: 'push-main-press',
            label: 'Push main press',
            sourceBlockId: 'push',
            stabilityPolicy: 'user-locked',
          },
        ],
      },
    });

    expect(result.success).toBe(false);
  });

  it('validates session-level coach program attribution', () => {
    const result = coachProgramAttributionSchema.safeParse({
      programId: 'plan-ppl',
      programVersion: 2,
      sourceBlockId: 'push',
      addOnBlockIds: ['easy-cardio'],
      templateId: 'ppl-conditioning',
      projectionId: 'projection-1',
      slotAssignments: [
        {
          slotId: 'push-main-press',
          exerciseName: 'Bench Press',
        },
      ],
      scheduleStrategy: 'ordered-rotation',
      sourceKind: 'generated',
      confidence: 'high',
    });

    expect(result.success).toBe(true);
  });

  it('validates derived coach projection output', () => {
    const result = coachProjectionSchema.safeParse({
      planId: 'plan-ppl',
      programVersion: 1,
      strategy: 'ordered-rotation',
      strategyStatus: 'ready',
      cycleIndex: 2,
      windowStartLocalDate: '2026-04-20',
      windowEndLocalDate: '2026-05-03',
      todaySessionId: 'coachproj_abc',
      sessions: [
        {
          id: 'coachproj_abc',
          planId: 'plan-ppl',
          programVersion: 1,
          cycleIndex: 2,
          strategy: 'ordered-rotation',
          sessionIdentityKey: 'ordered:push:1',
          localDate: '2026-04-20',
          sourceBlockId: 'push',
          targetIds: ['lift'],
          status: 'projected',
          projectionStatus: 'projected',
          blockLabel: 'Push',
          availableActions: ['skip', 'pin', 'move', 'generate'],
        },
      ],
      repairNotes: [],
      conflictWarnings: [],
      targetProgress: [],
    });

    expect(result.success).toBe(true);
  });

  it('validates durable coach session skip records', () => {
    const result = coachSessionActionSchema.safeParse({
      actionKind: 'skip',
      programId: 'plan-ppl',
      programVersion: 1,
      strategy: 'ordered-rotation',
      cycleIndex: 2,
      sessionIdentityKey: 'ordered:push:1',
      projectionId: 'coachproj_abc',
      sourceBlockId: 'push',
      projectedLocalDate: '2026-04-20',
      actionLocalDate: '2026-04-20',
      createdAt: '2026-04-20T12:00:00.000Z',
    });

    expect(result.success).toBe(true);
  });

  it('allows forward-compatible metadata on adaptive plan intent', () => {
    const result = adaptivePlanIntentSchema.safeParse({
      planId: 'plan-ppl',
      programVersion: 1,
      scheduleStrategy: 'ordered-rotation',
      futureIntentField: { value: 'ignored by older planners' },
      primaryBlock: {
        blockId: 'push',
        label: 'Push',
        category: 'strength',
      },
      addOnBlocks: [],
      targetRangeContext: [],
      rationale: [],
    });

    expect(result.success).toBe(true);
  });

  it('selects deterministic coach strategies from template defaults', () => {
    expect(selectCoachStrategyForTemplate('balanced-foundation')).toMatchObject(
      {
        strategy: 'weekly-target-balance',
        reason: expect.stringContaining('Balanced foundation'),
      }
    );
    expect(selectCoachStrategyForTemplate('ppl-conditioning')).toMatchObject({
      strategy: 'ordered-rotation',
      reason: expect.stringContaining('Lift conditioning'),
    });
  });

  it('scales starter-week lifting density by experience and template intent', () => {
    const beginner = createTrainingBlueprintFromOnboarding({
      goal: 'build-muscle',
      experienceLevel: 'beginner',
      environment: 'gym',
      equipment: [GYM_EQUIPMENT],
    });
    const intermediate = createTrainingBlueprintFromOnboarding({
      goal: 'build-muscle',
      experienceLevel: 'intermediate',
      environment: 'gym',
      equipment: [GYM_EQUIPMENT],
    });
    const advanced = createTrainingBlueprintFromOnboarding({
      goal: 'build-muscle',
      experienceLevel: 'advanced',
      environment: 'gym',
      equipment: [GYM_EQUIPMENT],
    });

    expect(countHardLiftSlots(beginner.slotSequence)).toBe(2);
    expect(countHardLiftSlots(intermediate.slotSequence)).toBe(4);
    expect(countHardLiftSlots(advanced.slotSequence)).toBe(5);
    expect(maxConsecutiveHardLiftSlots(intermediate.slotSequence)).toBeLessThan(
      3
    );
    expect(maxConsecutiveHardLiftSlots(advanced.slotSequence)).toBe(3);
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
      expect(result.data.aiFeaturesEnabled).toBe(true);
    }
  });

  it('persists explicit AI opt-out preferences', () => {
    const result = userPreferencesSchema.safeParse({
      equipment: ['Bodyweight'],
      aiFeaturesEnabled: false,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.aiFeaturesEnabled).toBe(false);
      expect(resolveWorkoutCreationMode(result.data)).toBe('library');
    }
  });

  it('resolves AI-enabled preferences to automatic workout creation', () => {
    const preferences = userPreferencesSchema.parse({
      equipment: ['Dumbbells'],
      aiFeaturesEnabled: true,
    });

    expect(resolveWorkoutCreationMode(preferences)).toBe('auto');
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
      expect(result.data.programVersion).toBe(1);
      expect(result.data.scheduleStrategy).toBe('ordered-rotation');
      expect(result.data.strategySelection).toEqual(
        selectCoachStrategyForTemplate('ppl-conditioning')
      );
      expect(result.data.revisions).toEqual([]);
    }
  });

  it('migrates existing adaptive plan v1 data into coach program metadata', () => {
    const plan = createAdaptiveTrainingPlanFromTemplate('balanced-foundation', {
      id: 'plan-balanced',
      activeFrom: '2026-04-15',
      updatedAt: '2026-04-15T12:00:00.000Z',
    });
    const legacyPlan = {
      schemaVersion: plan.schemaVersion,
      id: plan.id,
      sourceTemplateId: plan.sourceTemplateId,
      mode: plan.mode,
      activeFrom: plan.activeFrom,
      activeUntil: plan.activeUntil,
      blocks: plan.blocks,
      targetRanges: plan.targetRanges,
      typicalWeekPreferences: plan.typicalWeekPreferences,
      sessionPreferences: plan.sessionPreferences,
      recommendationSettings: plan.recommendationSettings,
      status: plan.status,
      updatedAt: plan.updatedAt,
    };

    const migrated = migrateAdaptiveTrainingPlanToCoachProgramAware(
      legacyPlan as typeof plan
    );

    expect(migrated).toMatchObject({
      id: 'plan-balanced',
      blocks: plan.blocks,
      targetRanges: plan.targetRanges,
      typicalWeekPreferences: plan.typicalWeekPreferences,
      sessionPreferences: plan.sessionPreferences,
      recommendationSettings: plan.recommendationSettings,
      sourceTemplateId: 'balanced-foundation',
      status: 'active',
      updatedAt: '2026-04-15T12:00:00.000Z',
      programVersion: 1,
      scheduleStrategy: 'weekly-target-balance',
      strategySelection: selectCoachStrategyForTemplate('balanced-foundation'),
      revisions: [],
    });
  });

  it('records explicit program strategy revisions with a reason', () => {
    const plan = createAdaptiveTrainingPlanFromTemplate('balanced-foundation', {
      id: 'plan-balanced',
      activeFrom: '2026-04-15',
      updatedAt: '2026-04-15T12:00:00.000Z',
    });

    const revised = createCoachProgramStrategyRevision(plan, {
      scheduleStrategy: 'ordered-rotation',
      reason: 'User chose a sequence-sensitive strength phase.',
      createdAt: '2026-04-20T12:00:00.000Z',
    });

    expect(revised.programVersion).toBe(2);
    expect(revised.scheduleStrategy).toBe('ordered-rotation');
    expect(revised.strategySelection).toEqual({
      strategy: 'ordered-rotation',
      reason: 'User chose a sequence-sensitive strength phase.',
    });
    expect(revised.revisions).toEqual([
      expect.objectContaining({
        version: 2,
        previousVersion: 1,
        scheduleStrategy: 'ordered-rotation',
        previousScheduleStrategy: 'weekly-target-balance',
        reason: 'User chose a sequence-sensitive strength phase.',
      }),
    ]);
  });

  it('keeps hard lifting streaks conservative except advanced five-day lifting plans', () => {
    Object.values(TRAINING_TEMPLATE_DEFINITIONS).forEach((template) => {
      const hardLiftCount = countHardLiftSlots(template.slotSequence);
      const maxConsecutive = maxConsecutiveHardLiftSlots(template.slotSequence);
      const canUseThreeDayLiftWave =
        template.id === 'ppl-hypertrophy' && hardLiftCount >= 5;

      if (canUseThreeDayLiftWave) {
        expect(maxConsecutive).toBeLessThanOrEqual(3);
        return;
      }

      expect(maxConsecutive).toBeLessThan(3);
    });
  });

  it('creates a distinct adaptive plan for every onboarding template', () => {
    const expectedTemplateSummaries = {
      'balanced-starter': {
        blocks: ['full-body', 'conditioning', 'flexible'],
        primaryTargets: ['strength'],
      },
      'balanced-foundation': {
        blocks: ['full-body-strength', 'conditioning', 'flexible-movement'],
        primaryTargets: ['strength'],
      },
      'balanced-performance': {
        blocks: ['full-body', 'conditioning', 'sprint'],
        primaryTargets: ['strength'],
      },
      'strength-starter': {
        blocks: ['full-body', 'conditioning', 'mobility'],
        primaryTargets: ['strength'],
      },
      'strength-foundation': {
        blocks: ['strength-heavy', 'strength-volume', 'lower-strength'],
        primaryTargets: ['strength'],
      },
      'strength-performance': {
        blocks: ['full-body', 'upper', 'lower'],
        primaryTargets: ['strength'],
      },
      'hypertrophy-starter': {
        blocks: ['upper-hypertrophy', 'lower-hypertrophy', 'full-body-pump'],
        primaryTargets: ['hypertrophy'],
      },
      'hypertrophy-foundation': {
        blocks: ['upper-hypertrophy', 'lower-hypertrophy', 'full-body-pump'],
        primaryTargets: ['hypertrophy'],
      },
      'upper-lower-hypertrophy': {
        blocks: ['upper-hypertrophy', 'lower-hypertrophy', 'easy-cardio'],
        primaryTargets: ['hypertrophy'],
      },
      'ppl-hypertrophy': {
        blocks: ['push', 'pull', 'legs', 'upper-pump', 'lower-pump'],
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
  it('accepts library workouts as canonical plans', () => {
    const result = todayPlanSchema.safeParse(
      createTodayPlanFixture({
        source: 'library',
        generationProvenance: undefined,
      })
    );

    expect(result.success).toBe(true);
  });

  it('accepts minimal regeneration provenance on the canonical plan', () => {
    const result = todayPlanSchema.safeParse(
      createTodayPlanFixture({
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
    const result = todayPlanSchema.safeParse(createTodayPlanFixture());

    expect(result.success).toBe(true);
  });

  it('accepts internal slot assignment metadata on canonical exercises', () => {
    const plan = createTodayPlanFixture({
      blocks: [
        {
          id: 'block-1',
          title: 'Push',
          durationMinutes: 30,
          focus: 'Push',
          exercises: [
            {
              id: 'exercise-1',
              name: 'Bench Press',
              prescription: '3 x 5',
              detail: null,
              slotAssignment: {
                slotId: 'push-main-press',
                slotLabel: 'Push main press',
                stabilityPolicy: 'stable',
                assignmentSource: 'generated',
              },
            },
          ],
        },
      ],
    });

    expect(todayPlanSchema.safeParse(plan).success).toBe(true);
  });
});
