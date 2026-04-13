import {
  createTodayPlanMock,
  type GenerationContext,
} from '@workout-agent/shared';
import { derivePlanningBrief } from './planning';

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
  });

  it('shifts smart focus away from repeated recent overload', () => {
    const brief = derivePlanningBrief({
      request: {
        focus: 'Smart',
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
  });
});
