import {
  createAdaptiveTrainingPlanFromTemplate,
  type AdaptivePlanTargetProgress,
  type AdaptiveTrainingPlan,
  type WorkoutSessionSummary,
} from '@workout-agent/shared';
import {
  computeAdaptiveTargetProgress,
  resolveAdaptiveTrainingRecommendation,
} from './adaptiveTrainingPlanResolver';

const createPlan = (): AdaptiveTrainingPlan => {
  const plan = createAdaptiveTrainingPlanFromTemplate('ppl-conditioning', {
    id: 'plan-ppl',
    activeFrom: '2026-04-13',
    updatedAt: '2026-04-13T12:00:00.000Z',
  });

  if (!plan) {
    throw new Error('Expected adaptive PPL plan');
  }

  return plan;
};

const session = (
  id: string,
  focus: string,
  completedAt: string
): WorkoutSessionSummary => ({
  id,
  name: focus,
  focus,
  completedAt,
  durationMinutes: 45,
  source: 'manual',
});

describe('adaptive training plan resolver', () => {
  it('recommends the next useful PPL block from recent rotation', () => {
    const recommendation = resolveAdaptiveTrainingRecommendation({
      plan: createPlan(),
      planningDateLocal: '2026-04-15',
      recentSessions: [
        session('pull', 'Pull', '2026-04-14T12:00:00.000Z'),
        session('push', 'Push', '2026-04-13T12:00:00.000Z'),
      ],
    });

    expect(recommendation.primaryBlockId).toBe('legs');
  });

  it('computes rolling target progress from recent completed sessions', () => {
    const progress = computeAdaptiveTargetProgress({
      plan: createPlan(),
      planningDateLocal: '2026-04-20',
      recentSessions: [
        session('push', 'Push', '2026-04-19T12:00:00.000Z'),
        session('pull', 'Pull', '2026-04-18T12:00:00.000Z'),
        session('legs', 'Legs', '2026-04-17T12:00:00.000Z'),
        session('old-push', 'Push', '2026-04-10T12:00:00.000Z'),
      ],
    });

    expect(
      progress.find(
        (target: AdaptivePlanTargetProgress) => target.targetId === 'lift'
      )?.count
    ).toBe(3);
  });

  it('does not treat an extra lift inside the range as broken', () => {
    const recommendation = resolveAdaptiveTrainingRecommendation({
      plan: createPlan(),
      planningDateLocal: '2026-04-20',
      recentSessions: [
        session('push-2', 'Push', '2026-04-19T12:00:00.000Z'),
        session('legs', 'Legs', '2026-04-18T12:00:00.000Z'),
        session('pull', 'Pull', '2026-04-17T12:00:00.000Z'),
        session('push', 'Push', '2026-04-16T12:00:00.000Z'),
      ],
    });

    expect(
      recommendation.targetProgress.find(
        (target: AdaptivePlanTargetProgress) => target.targetId === 'lift'
      )?.count
    ).toBe(4);
    expect(recommendation.rationale.map((item) => item.code)).not.toContain(
      'noncompliant'
    );
  });

  it('can combine Pull with Easy Cardio when time and target gaps allow', () => {
    const recommendation = resolveAdaptiveTrainingRecommendation({
      plan: createPlan(),
      planningDateLocal: '2026-04-14',
      recentSessions: [session('push', 'Push', '2026-04-13T12:00:00.000Z')],
      availableTimeMinutes: 75,
    });

    expect(recommendation.primaryBlockId).toBe('pull');
    expect(recommendation.addOnBlockIds).toContain('easy-cardio');
  });

  it('can combine Push with Abs / Accessory when cardio is already covered', () => {
    const recommendation = resolveAdaptiveTrainingRecommendation({
      plan: createPlan(),
      planningDateLocal: '2026-04-13',
      recentSessions: [
        session('sprint', 'Sprint', '2026-04-12T12:00:00.000Z'),
        session('cardio-2', 'Easy Cardio', '2026-04-11T12:00:00.000Z'),
        session('cardio-1', 'Easy Cardio', '2026-04-10T12:00:00.000Z'),
      ],
      availableTimeMinutes: 70,
    });

    expect(recommendation.primaryBlockId).toBe('push');
    expect(recommendation.addOnBlockIds).toContain('abs-accessory');
  });

  it('does not combine sprint with heavy legs', () => {
    const recommendation = resolveAdaptiveTrainingRecommendation({
      plan: createPlan(),
      planningDateLocal: '2026-04-15',
      recentSessions: [
        session('pull', 'Pull', '2026-04-14T12:00:00.000Z'),
        session('push', 'Push', '2026-04-13T12:00:00.000Z'),
      ],
      availableTimeMinutes: 90,
    });

    expect(recommendation.primaryBlockId).toBe('legs');
    expect(recommendation.addOnBlockIds).not.toContain('sprint');
  });

  it('swaps away from Friday Legs before a Saturday hike', () => {
    const recommendation = resolveAdaptiveTrainingRecommendation({
      plan: createPlan(),
      planningDateLocal: '2026-04-17',
      recentSessions: [
        session('pull', 'Pull', '2026-04-16T12:00:00.000Z'),
        session('push', 'Push', '2026-04-15T12:00:00.000Z'),
      ],
      upcomingEvents: [
        {
          kind: 'hike',
          title: 'Long Saturday hike',
          localDate: '2026-04-18',
          intensity: 'high',
          tags: ['lower-body'],
        },
      ],
    });

    expect(recommendation.primaryBlockId).not.toBe('legs');
    expect(recommendation.coachNotes.join(' ')).toContain('upcoming event');
  });

  it('preserves pinned sessions even when projected logic would reflow', () => {
    const plan: AdaptiveTrainingPlan = {
      ...createPlan(),
      sessionPreferences: [
        {
          id: 'pinned-legs',
          localDate: '2026-04-17',
          blockIds: ['legs'],
          status: 'pinned',
        },
      ],
    };

    const recommendation = resolveAdaptiveTrainingRecommendation({
      plan,
      planningDateLocal: '2026-04-17',
      recentSessions: [
        session('pull', 'Pull', '2026-04-16T12:00:00.000Z'),
        session('push', 'Push', '2026-04-15T12:00:00.000Z'),
      ],
      upcomingEvents: [
        {
          kind: 'hike',
          title: 'Long Saturday hike',
          localDate: '2026-04-18',
          intensity: 'high',
        },
      ],
    });

    expect(recommendation.primaryBlockId).toBe('legs');
    expect(recommendation.projectionStatus).toBe('pinned');
    expect(recommendation.rationale[0]?.code).toBe('pinned-session');
  });

  it('derives recommendations from structured blocks instead of PPL-specific slots', () => {
    const basePlan = createPlan();
    const plan: AdaptiveTrainingPlan = {
      ...basePlan,
      id: 'plan-upper-lower-yoga',
      sourceTemplateId: 'balanced-foundation',
      blocks: [
        {
          id: 'upper-strength',
          label: 'Upper Strength',
          role: 'upper-strength',
          category: 'strength',
          stressTags: ['upper-body'],
          defaultDurationMinutes: 40,
          targetContributions: [{ targetId: 'strength', count: 1 }],
          compatibleAddOnBlockIds: ['yoga'],
          conflictsWithBlockIds: [],
        },
        {
          id: 'lower-strength',
          label: 'Lower Strength',
          role: 'lower-strength',
          category: 'strength',
          stressTags: ['lower-body'],
          defaultDurationMinutes: 40,
          targetContributions: [{ targetId: 'strength', count: 1 }],
          compatibleAddOnBlockIds: ['yoga'],
          conflictsWithBlockIds: [],
        },
        {
          id: 'yoga',
          label: 'Yoga',
          role: 'yoga',
          category: 'mobility',
          stressTags: ['recovery'],
          defaultDurationMinutes: 20,
          targetContributions: [{ targetId: 'mobility', count: 1 }],
          compatibleAddOnBlockIds: ['upper-strength'],
          conflictsWithBlockIds: [],
        },
      ],
      targetRanges: [
        {
          id: 'strength',
          label: 'Strength',
          appliesTo: {
            blockIds: ['upper-strength', 'lower-strength'],
            categories: ['strength'],
            stressTags: [],
          },
          windowDays: 7,
          minCount: 2,
          maxCount: 4,
          idealCount: 3,
          priority: 'primary',
        },
        {
          id: 'mobility',
          label: 'Mobility',
          appliesTo: {
            blockIds: ['yoga'],
            categories: ['mobility'],
            stressTags: [],
          },
          windowDays: 7,
          minCount: 1,
          maxCount: 3,
          idealCount: 2,
          priority: 'secondary',
        },
      ],
      typicalWeekPreferences: [],
      recommendationSettings: {
        preferredRotationBlockIds: ['upper-strength', 'lower-strength'],
        allowCompatibleAddOns: true,
        protectUpcomingLowerBodyDays: 1,
      },
    };

    const recommendation = resolveAdaptiveTrainingRecommendation({
      plan,
      planningDateLocal: '2026-04-15',
      recentSessions: [
        session('upper', 'Upper Strength', '2026-04-14T12:00:00.000Z'),
      ],
      availableTimeMinutes: 60,
    });

    expect(recommendation.primaryBlockId).toBe('lower-strength');
    expect(recommendation.addOnBlockIds).toContain('yoga');
  });
});
