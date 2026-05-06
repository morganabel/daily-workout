import {
  createTodayPlanMock,
  type AdaptivePlanIntent,
  type GenerationContext,
} from '@workout-agent/shared';
import {
  derivePlanningBrief,
  determineStageOnePlanningActivation,
} from './planning';

const createContext = (
  overrides: Partial<GenerationContext> = {},
): GenerationContext => ({
  userProfile: {
    experienceLevel: 'beginner',
    preferredStyle: 'strength',
    ...overrides.userProfile,
  },
  preferences: {
    focusBias: [],
    avoid: [],
    injuries: [],
    ...overrides.preferences,
  },
  environment: {
    equipment: ['Bodyweight'],
    timeAvailableMinutes: 30,
    ...overrides.environment,
  },
  recentSessions: overrides.recentSessions ?? [],
  notes: overrides.notes,
});

const adaptivePlanIntent: AdaptivePlanIntent = {
  planId: 'plan-ppl',
  recommendationId: 'rec-pull-cardio',
  sourceTemplateId: 'ppl-conditioning',
  primaryBlock: {
    blockId: 'pull',
    label: 'Pull',
    category: 'strength',
    role: 'pull',
    targetDurationMinutes: 50,
    stressTags: ['upper-body', 'pull'],
  },
  addOnBlocks: [
    {
      blockId: 'easy-cardio',
      label: 'Easy Cardio',
      category: 'cardio',
      role: 'easy-cardio',
      targetDurationMinutes: 25,
      stressTags: ['low-impact'],
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
};

describe('derivePlanningBrief', () => {
  it('keeps explicit focus and normalizes regeneration metadata', () => {
    const brief = derivePlanningBrief({
      request: {
        focus: 'Upper Body',
        timeMinutes: 45,
        previousResponseId: 'resp-1',
        baselineWorkout: createTodayPlanMock({ id: 'plan-1' }),
        feedback: ['different-exercises'],
      },
      context: createContext(),
      provider: 'openai',
    });

    expect(brief.focusMode).toBe('explicit');
    expect(brief.resolvedFocus).toBe('Upper Body');
    expect(brief.durationMinutes).toBe(45);
    expect(brief.variationMode).toBe('different-exercises');
    expect(brief.regeneration).toEqual(
      expect.objectContaining({
        isRegeneration: true,
        mode: 'stateful',
        baselineWorkoutId: 'plan-1',
      }),
    );
    expect(brief.blockIntents).toEqual([
      expect.objectContaining({
        focus: 'Upper Body',
        durationMinutes: 45,
      }),
    ]);
    expect(brief.stagedPlanning).toEqual({
      mode: 'llm-assisted',
      shouldRun: true,
      reasons: ['regeneration-feedback'],
    });
  });

  it('records unknown fields instead of inventing missing context', () => {
    const brief = derivePlanningBrief({
      request: {},
      context: {
        userProfile: {},
        preferences: {},
        environment: { equipment: [] },
        recentSessions: [],
      },
      provider: 'gemini',
    });

    expect(brief.unknowns).toEqual(
      expect.arrayContaining([
        'focus',
        'injuries',
        'avoid',
        'recentSessions',
        'preferredStyle',
        'primaryGoal',
      ]),
    );
    expect(brief.availableEquipment).toEqual(['Bodyweight']);
    expect(brief.regeneration.mode).toBe('initial');
    expect(brief.stagedPlanning).toEqual({
      mode: 'single-pass',
      shouldRun: false,
      reasons: [],
    });
  });

  it('infers strength style bias from strength-oriented goals', () => {
    const brief = derivePlanningBrief({
      request: { focus: 'Smart' },
      context: createContext({
        userProfile: {
          preferredStyle: undefined,
          primaryGoal: 'build muscle and strength',
        },
      }),
      provider: 'openai',
    });

    expect(brief.styleBias).toBe('strength');
  });

  it('protects a near-term event when smart focus is requested', () => {
    const brief = derivePlanningBrief({
      request: {
        focus: 'Smart',
        planningDateLocal: '2026-04-15',
        upcomingEvents: [
          {
            kind: 'run',
            title: '10K Tune-Up',
            localDate: '2026-04-16',
            intensity: 'high',
          },
        ],
      },
      context: createContext({
        userProfile: { energyToday: 'moderate' },
      }),
      provider: 'openai',
    });

    expect(brief.focusMode).toBe('smart');
    expect(brief.resolvedFocus).toBe('Upper Body & Core');
    expect(brief.eventProtection).toEqual(
      expect.objectContaining({ title: '10K Tune-Up' }),
    );
    expect(brief.disallowedStressors).toEqual(
      expect.arrayContaining(['lower_body_overload', 'high_impact']),
    );
    expect(brief.loadCeiling).toBe('low');
    expect(brief.stagedPlanning).toEqual(
      expect.objectContaining({
        mode: 'llm-assisted',
        shouldRun: true,
        reasons: ['smart-focus'],
      }),
    );
  });

  it('uses planned-slot intent before generic smart focus', () => {
    const brief = derivePlanningBrief({
      request: {
        focus: 'Smart',
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
            equipment: ['Gym'],
          },
        },
      },
      context: createContext({
        preferences: { focusBias: ['Lower Body'] },
      }),
      provider: 'openai',
    });

    expect(brief.focusMode).toBe('planned-slot');
    expect(brief.resolvedFocus).toBe('Upper Body Pull');
    expect(brief.durationMinutes).toBe(45);
    expect(brief.availableEquipment).toEqual(['Gym']);
    expect(brief.plannedSlotIntent).toEqual(
      expect.objectContaining({ role: 'pull', slotId: 'day-2-pull' }),
    );
  });

  it('keeps explicit focus ahead of planned-slot background context', () => {
    const brief = derivePlanningBrief({
      request: {
        focus: 'Mobility',
        plannedSlotIntent: {
          role: 'pull',
          label: 'Pull',
          targetDurationMinutes: 45,
          plannedDate: '2026-04-15',
          templateId: 'ppl-conditioning',
          slotId: 'day-2-pull',
          equipmentLocationAssumptions: {
            environment: 'gym',
            equipment: ['Gym'],
          },
        },
      },
      context: createContext(),
      provider: 'openai',
    });

    expect(brief.focusMode).toBe('explicit');
    expect(brief.resolvedFocus).toBe('Mobility');
    expect(brief.plannedSlotIntent).toEqual(
      expect.objectContaining({ role: 'pull' }),
    );
  });

  it('records adaptive plan intent and creates primary plus add-on block intents', () => {
    const brief = derivePlanningBrief({
      request: {
        focus: 'Pull',
        adaptivePlanIntent,
        planningDateLocal: '2026-04-15',
      },
      context: createContext(),
      provider: 'openai',
    });

    expect(brief.focusMode).toBe('adaptive-plan');
    expect(brief.adaptivePlanIntent).toEqual(
      expect.objectContaining({ planId: 'plan-ppl' }),
    );
    expect(brief.resolvedFocus).toBe('Pull + Easy Cardio');
    expect(brief.durationMinutes).toBe(75);
    expect(brief.blockIntents).toEqual([
      expect.objectContaining({ key: 'adaptive-primary', focus: 'Pull' }),
      expect.objectContaining({ key: 'adaptive-addon-1', focus: 'Easy Cardio' }),
    ]);
  });

  it('keeps explicit focus stronger than adaptive background context', () => {
    const brief = derivePlanningBrief({
      request: {
        focus: 'Mobility',
        adaptivePlanIntent,
      },
      context: createContext(),
      provider: 'openai',
    });

    expect(brief.focusMode).toBe('explicit');
    expect(brief.resolvedFocus).toBe('Mobility');
    expect(brief.adaptivePlanIntent).toEqual(
      expect.objectContaining({ planId: 'plan-ppl' }),
    );
    expect(brief.blockIntents).toEqual([
      expect.objectContaining({ key: 'main', focus: 'Mobility' }),
    ]);
  });

  it('protects upcoming events from adaptive lower-body recommendations', () => {
    const brief = derivePlanningBrief({
      request: {
        focus: 'Legs',
        adaptivePlanIntent: {
          ...adaptivePlanIntent,
          primaryBlock: {
            blockId: 'legs',
            label: 'Legs',
            category: 'strength',
            role: 'legs',
            targetDurationMinutes: 50,
            stressTags: ['lower-body', 'heavy'],
          },
          addOnBlocks: [],
        },
        planningDateLocal: '2026-04-15',
        upcomingEvents: [
          {
            kind: 'hike',
            title: 'Saturday hike',
            localDate: '2026-04-16',
            intensity: 'high',
          },
        ],
      },
      context: createContext(),
      provider: 'gemini',
    });

    expect(brief.focusMode).toBe('adaptive-plan');
    expect(brief.resolvedFocus).toBe('Upper Body & Core');
    expect(brief.disallowedStressors).toEqual(
      expect.arrayContaining(['lower_body_overload', 'high_impact']),
    );
  });

  it('keeps planned-slot intent but protects near-term events', () => {
    const brief = derivePlanningBrief({
      request: {
        focus: 'Smart',
        planningDateLocal: '2026-04-15',
        plannedSlotIntent: {
          role: 'sprint',
          targetDurationMinutes: 30,
          plannedDate: '2026-04-15',
          equipmentLocationAssumptions: {
            environment: 'outdoors',
            equipment: ['Bodyweight'],
          },
        },
        upcomingEvents: [
          {
            kind: 'run',
            title: '10K Tune-Up',
            localDate: '2026-04-16',
            intensity: 'high',
          },
        ],
      },
      context: createContext(),
      provider: 'openai',
    });

    expect(brief.focusMode).toBe('planned-slot');
    expect(brief.resolvedFocus).toBe('Upper Body & Core');
    expect(brief.eventProtection).toEqual(
      expect.objectContaining({ title: '10K Tune-Up' }),
    );
  });

  it('shifts smart focus away from repeated recent overload', () => {
    const brief = derivePlanningBrief({
      request: {
        focus: 'Smart',
        planningDateLocal: '2026-04-15',
      },
      context: createContext({
        recentSessions: [
          {
            id: 's1',
            name: 'Leg Day',
            completedAt: '2026-04-13T12:00:00.000Z',
            durationMinutes: 45,
            focus: 'Lower Body Strength',
          },
          {
            id: 's2',
            name: 'Legs Again',
            completedAt: '2026-04-11T12:00:00.000Z',
            durationMinutes: 40,
            focus: 'Lower Body Power',
          },
        ],
      }),
      provider: 'gemini',
    });

    expect(brief.recentStressorsToAvoid).toContain('lower_body');
    expect(brief.resolvedFocus).toBe('Upper Body');
    expect(brief.fallbackReasons).toEqual([]);
  });

  it('biases away from a single recent leg day for split-style users', () => {
    const brief = derivePlanningBrief({
      request: {
        focus: 'Smart',
        planningDateLocal: '2026-04-15',
      },
      context: createContext({
        userProfile: {
          preferredStyle: 'Bodybuilding',
        },
        preferences: {
          focusBias: ['Upper Body', 'Lower Body'],
        },
        recentSessions: [
          {
            id: 's1',
            name: 'Heavy Leg Day',
            completedAt: '2026-04-14T12:00:00.000Z',
            durationMinutes: 60,
            focus: 'Lower Body',
            perceivedEffort: 'moderate',
          },
        ],
      }),
      provider: 'openai',
    });

    expect(brief.recentStressorsToAvoid).toContain('lower_body');
    expect(brief.disallowedStressors).toEqual(
      expect.arrayContaining([
        'lower_body_fatigue',
        'axial_loading',
        'high_bracing',
      ]),
    );
    expect(brief.resolvedFocus).toBe('Upper Body');
  });

  it('suggests lower body after a recent push then pull sequence', () => {
    const brief = derivePlanningBrief({
      request: {
        focus: 'Smart',
        planningDateLocal: '2026-04-15',
      },
      context: createContext({
        recentSessions: [
          {
            id: 's1',
            name: 'Push Day',
            completedAt: '2026-04-12T12:00:00.000Z',
            durationMinutes: 45,
            focus: 'Push',
          },
          {
            id: 's2',
            name: 'Pull Day',
            completedAt: '2026-04-14T12:00:00.000Z',
            durationMinutes: 45,
            focus: 'Pull',
          },
        ],
      }),
      provider: 'openai',
    });

    expect(brief.recentStressorsToAvoid).toEqual(
      expect.arrayContaining(['push', 'pull', 'upper_body']),
    );
    expect(brief.resolvedFocus).toBe('Lower Body');
  });

  it('ignores sessions older than a week when resolving smart focus', () => {
    const brief = derivePlanningBrief({
      request: {
        focus: 'Smart',
        planningDateLocal: '2026-04-15',
      },
      context: createContext({
        recentSessions: [
          {
            id: 's1',
            name: 'Old Push Day',
            completedAt: '2026-04-05T12:00:00.000Z',
            durationMinutes: 45,
            focus: 'Push',
          },
          {
            id: 's2',
            name: 'Old Pull Day',
            completedAt: '2026-04-06T12:00:00.000Z',
            durationMinutes: 45,
            focus: 'Pull',
          },
        ],
      }),
      provider: 'gemini',
    });

    expect(brief.recentStressorsToAvoid).not.toEqual(
      expect.arrayContaining(['push', 'pull']),
    );
    expect(brief.resolvedFocus).toBe('Strength');
  });

  it('does not strongly bias away from a single recent session for full-body users', () => {
    const brief = derivePlanningBrief({
      request: {
        focus: 'Smart',
        planningDateLocal: '2026-04-15',
      },
      context: createContext({
        userProfile: {
          preferredStyle: 'Full Body',
        },
        recentSessions: [
          {
            id: 's1',
            name: 'Legs Yesterday',
            completedAt: '2026-04-14T12:00:00.000Z',
            durationMinutes: 45,
            focus: 'Lower Body',
            perceivedEffort: 'moderate',
          },
        ],
      }),
      provider: 'gemini',
    });

    expect(brief.recentStressorsToAvoid).not.toContain('lower_body');
    expect(brief.disallowedStressors).not.toContain('lower_body_fatigue');
    expect(brief.resolvedFocus).toBe('Full Body');
  });
});

describe('determineStageOnePlanningActivation', () => {
  it('skips stage one for low-ambiguity explicit requests', () => {
    expect(
      determineStageOnePlanningActivation({
        request: {
          focus: 'Upper Body',
          timeMinutes: 30,
        },
        context: createContext(),
        planningBrief: {
          focusMode: 'explicit',
          eventProtection: undefined,
          recentStressorsToAvoid: [],
          regeneration: {
            isRegeneration: false,
            mode: 'initial',
            feedback: [],
            baselineExerciseCount: 0,
          },
        },
      }),
    ).toEqual({
      mode: 'single-pass',
      shouldRun: false,
      reasons: [],
    });
  });

  it('activates stage one for dense notes even with explicit focus', () => {
    expect(
      determineStageOnePlanningActivation({
        request: {
          focus: 'Upper Body',
          notes:
            'Keep it shoulder-friendly, bias unilateral work, avoid long rest, and make it feel athletic rather than bodybuilding because I am also practicing climbing tomorrow morning.',
        },
        context: createContext(),
        planningBrief: {
          focusMode: 'explicit',
          eventProtection: undefined,
          recentStressorsToAvoid: [],
          regeneration: {
            isRegeneration: false,
            mode: 'initial',
            feedback: [],
            baselineExerciseCount: 0,
          },
          priorityNotes:
            'Keep it shoulder-friendly, bias unilateral work, avoid long rest, and make it feel athletic rather than bodybuilding because I am also practicing climbing tomorrow morning.',
        },
      }),
    ).toEqual({
      mode: 'llm-assisted',
      shouldRun: true,
      reasons: ['dense-notes'],
    });
  });
});
