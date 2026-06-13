import {
  type AdaptivePlanIntent,
  type GenerationContext,
} from '@workout-agent/shared';
import { createTodayPlanFixture } from '@workout-agent/shared/testing';
import {
  derivePlanningBrief,
  determineStageOnePlanningActivation,
} from './planning';

const createContext = (
  overrides: Partial<GenerationContext> = {}
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
        baselineWorkout: createTodayPlanFixture({ id: 'plan-1' }),
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
      })
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
      ])
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
      expect.objectContaining({ title: '10K Tune-Up' })
    );
    expect(brief.disallowedStressors).toEqual(
      expect.arrayContaining(['lower_body_overload', 'high_impact'])
    );
    expect(brief.loadCeiling).toBe('low');
    expect(brief.stagedPlanning).toEqual(
      expect.objectContaining({
        mode: 'llm-assisted',
        shouldRun: true,
        reasons: ['smart-focus'],
      })
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
      expect.objectContaining({ planId: 'plan-ppl' })
    );
    expect(brief.resolvedFocus).toBe('Pull + Easy Cardio');
    expect(brief.durationMinutes).toBe(75);
    expect(brief.blockIntents).toEqual([
      expect.objectContaining({ key: 'adaptive-primary', focus: 'Pull' }),
      expect.objectContaining({
        key: 'adaptive-addon-1',
        focus: 'Easy Cardio',
      }),
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
      expect.objectContaining({ planId: 'plan-ppl' })
    );
    expect(brief.durationMinutes).toBe(30);
    expect(brief.blockIntents).toEqual([
      expect.objectContaining({ key: 'main', focus: 'Mobility' }),
    ]);
  });

  it('scales adaptive block durations to explicit requested time', () => {
    const brief = derivePlanningBrief({
      request: {
        focus: 'Pull',
        timeMinutes: 60,
        adaptivePlanIntent,
        planningDateLocal: '2026-04-15',
      },
      context: createContext(),
      provider: 'openai',
    });

    expect(brief.durationMinutes).toBe(60);
    expect(brief.blockIntents).toEqual([
      expect.objectContaining({
        key: 'adaptive-primary',
        focus: 'Pull',
        durationMinutes: 40,
      }),
      expect.objectContaining({
        key: 'adaptive-addon-1',
        focus: 'Easy Cardio',
        durationMinutes: 20,
      }),
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
    expect(brief.durationMinutes).toBe(30);
    expect(brief.disallowedStressors).toEqual(
      expect.arrayContaining(['lower_body_overload', 'high_impact'])
    );
    expect(brief.blockIntents).toEqual([
      expect.objectContaining({ key: 'main', focus: 'Upper Body & Core' }),
    ]);
  });

  it('protects upcoming events from adaptive lower-body add-ons', () => {
    const brief = derivePlanningBrief({
      request: {
        focus: 'Pull',
        adaptivePlanIntent: {
          ...adaptivePlanIntent,
          addOnBlocks: [
            {
              blockId: 'sprint',
              label: 'Sprint',
              category: 'conditioning',
              role: 'sprint',
              targetDurationMinutes: 30,
              stressTags: ['lower-body', 'high-impact'],
            },
          ],
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
    expect(brief.blockIntents).toEqual([
      expect.objectContaining({ key: 'main', focus: 'Upper Body & Core' }),
    ]);
  });

  it('preserves stable slot assignments when hard constraints allow them', () => {
    const brief = derivePlanningBrief({
      request: {
        focus: 'Pull',
        adaptivePlanIntent: {
          ...adaptivePlanIntent,
          exerciseSlotPolicy: {
            slots: [
              {
                id: 'pull-main-pull',
                label: 'Pull main lift',
                sourceBlockId: 'pull',
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
        planningDateLocal: '2026-04-15',
      },
      context: createContext(),
      provider: 'openai',
    });

    expect(brief.exerciseSlotPolicy).toEqual(
      expect.objectContaining({
        slots: [
          expect.objectContaining({
            id: 'pull-main-pull',
            stabilityPolicy: 'stable',
          }),
        ],
        currentAssignments: [
          expect.objectContaining({
            slotId: 'pull-main-pull',
            exerciseName: 'Pull-Up',
          }),
        ],
        overrideReasons: [],
      })
    );
  });

  it('keeps coach-rotatable accessory slots available for variation', () => {
    const brief = derivePlanningBrief({
      request: {
        focus: 'Pull',
        adaptivePlanIntent: {
          ...adaptivePlanIntent,
          exerciseSlotPolicy: {
            slots: [
              {
                id: 'pull-accessory',
                label: 'Pull accessory',
                sourceBlockId: 'pull',
                stabilityPolicy: 'coach-rotatable',
                movementTags: ['biceps', 'rear-delts'],
                focusTags: ['pull', 'accessory'],
              },
            ],
            currentAssignments: [
              {
                slotId: 'pull-accessory',
                exerciseName: 'Hammer Curl',
                source: 'generated',
              },
            ],
            overrideReasons: [],
          },
        },
        planningDateLocal: '2026-04-15',
      },
      context: createContext(),
      provider: 'gemini',
    });

    expect(brief.exerciseSlotPolicy?.slots).toEqual([
      expect.objectContaining({
        id: 'pull-accessory',
        stabilityPolicy: 'coach-rotatable',
      }),
    ]);
    expect(brief.exerciseSlotPolicy?.overrideReasons).toEqual([]);
  });

  it.each([
    {
      label: 'equipment',
      exerciseName: 'Barbell Back Squat',
      requiredEquipment: ['Barbell'],
      context: createContext({ environment: { equipment: ['Dumbbells'] } }),
      request: {},
      expectedCode: 'equipment-unavailable',
    },
    {
      label: 'injury',
      exerciseName: 'Barbell Back Squat',
      requiredEquipment: [],
      context: createContext({
        preferences: { injuries: ['back squat'] },
      }),
      request: {},
      expectedCode: 'injury-conflict',
    },
    {
      label: 'avoid list',
      exerciseName: 'Romanian Deadlift',
      requiredEquipment: [],
      context: createContext({
        preferences: { avoid: ['deadlift'] },
      }),
      request: {},
      expectedCode: 'avoid-list',
    },
    {
      label: 'event protection',
      exerciseName: 'Back Squat',
      requiredEquipment: [],
      context: createContext(),
      request: {
        upcomingEvents: [
          {
            kind: 'hike',
            title: 'Saturday hike',
            localDate: '2026-04-16',
            intensity: 'high' as const,
          },
        ],
      },
      expectedCode: 'event-protection',
    },
  ])(
    'records slot override reasons for $label constraints',
    ({ exerciseName, requiredEquipment, context, request, expectedCode }) => {
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
            exerciseSlotPolicy: {
              slots: [
                {
                  id: 'legs-main-lift',
                  label: 'Legs main lift',
                  sourceBlockId: 'legs',
                  stabilityPolicy: 'stable',
                  movementTags: ['squat', 'hinge'],
                  focusTags: ['legs', 'lower-body'],
                  requiredEquipment,
                },
              ],
              currentAssignments: [
                {
                  slotId: 'legs-main-lift',
                  exerciseName,
                  source: 'generated',
                },
              ],
              overrideReasons: [],
            },
          },
          planningDateLocal: '2026-04-15',
          ...request,
        },
        context,
        provider: 'openai',
      });

      expect(brief.exerciseSlotPolicy?.overrideReasons).toEqual([
        expect.objectContaining({
          slotId: 'legs-main-lift',
          code: expectedCode,
          blockedExerciseName: exerciseName,
        }),
      ]);
    }
  );

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
      ])
    );
    expect(brief.resolvedFocus).toBe('Upper Body');
  });

  it('uses recent exercise names when focus is vague', () => {
    const brief = derivePlanningBrief({
      request: {
        focus: 'Smart',
        planningDateLocal: '2026-04-15',
      },
      context: createContext({
        userProfile: {
          preferredStyle: 'Bodybuilding split',
        },
        recentSessions: [
          {
            id: 's1',
            name: 'Garage Strength',
            completedAt: '2026-04-14T12:00:00.000Z',
            durationMinutes: 45,
            focus: 'Strength',
            perceivedEffort: 'intense',
            exerciseNames: ['Back Squat', 'Romanian Deadlift'],
            completedSetCount: 6,
          },
        ],
      }),
      provider: 'gemini',
    });

    expect(brief.recentStressorsToAvoid).toContain('lower_body');
    expect(brief.disallowedStressors).toEqual(
      expect.arrayContaining(['lower_body_fatigue', 'axial_loading'])
    );
    expect(brief.resolvedFocus).toBe('Upper Body');
  });

  it('does not infer pull stressors from short substring matches', () => {
    const brief = derivePlanningBrief({
      request: {
        focus: 'Smart',
        planningDateLocal: '2026-04-15',
      },
      context: createContext({
        userProfile: {
          preferredStyle: 'Bodybuilding split',
        },
        recentSessions: [
          {
            id: 's1',
            name: 'Plate Machine Pilates',
            completedAt: '2026-04-14T12:00:00.000Z',
            durationMinutes: 30,
            focus: 'Strength',
            perceivedEffort: 'intense',
            exerciseNames: [
              'Pilates Roll-Up',
              'Plate Circuit',
              'Machine Setup',
            ],
            completedSetCount: 6,
          },
        ],
      }),
      provider: 'gemini',
    });

    expect(brief.recentStressorsToAvoid).not.toContain('pull');
    expect(brief.recentStressorsToAvoid).not.toContain('upper_body');
    expect(brief.disallowedStressors).not.toContain('upper_body_pull_fatigue');
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
      expect.arrayContaining(['push', 'pull', 'upper_body'])
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
      expect.arrayContaining(['push', 'pull'])
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
      })
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
      })
    ).toEqual({
      mode: 'llm-assisted',
      shouldRun: true,
      reasons: ['dense-notes'],
    });
  });
});
