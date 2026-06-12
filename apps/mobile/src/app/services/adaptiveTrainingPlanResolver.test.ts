import {
  createAdaptiveTrainingPlanFromTemplate,
  type AdaptivePlanTargetProgress,
  type AdaptiveTrainingPlan,
  type TrainingTemplateId,
  type WorkoutSessionSummary,
} from '@workout-agent/shared';
import {
  computeAdaptiveTargetProgress,
  getSessionBlockAttribution,
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

const createTemplatePlan = (
  templateId: TrainingTemplateId
): AdaptiveTrainingPlan => {
  const plan = createAdaptiveTrainingPlanFromTemplate(templateId, {
    id: `plan-${templateId}`,
    activeFrom: '2026-04-13',
    updatedAt: '2026-04-13T12:00:00.000Z',
  });

  if (!plan) {
    throw new Error(`Expected adaptive ${templateId} plan`);
  }

  return plan;
};

const createUpperLowerPlan = (): AdaptiveTrainingPlan => ({
  ...createPlan(),
  id: 'plan-upper-lower',
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
      compatibleAddOnBlockIds: [],
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
      compatibleAddOnBlockIds: [],
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
  ],
  typicalWeekPreferences: [],
  recommendationSettings: {
    preferredRotationBlockIds: ['upper-strength', 'lower-strength'],
    allowCompatibleAddOns: false,
    protectUpcomingLowerBodyDays: 1,
  },
});

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
  it('recommends sensible first blocks for expanded templates', () => {
    const cases: Array<{
      templateId: TrainingTemplateId;
      expectedBlockId: string;
    }> = [
      {
        templateId: 'balanced-foundation',
        expectedBlockId: 'full-body-strength',
      },
      { templateId: 'strength-foundation', expectedBlockId: 'strength-heavy' },
      {
        templateId: 'hypertrophy-foundation',
        expectedBlockId: 'upper-hypertrophy',
      },
      {
        templateId: 'fat-loss-conditioning',
        expectedBlockId: 'strength-circuit',
      },
      { templateId: 'endurance-support', expectedBlockId: 'easy-cardio' },
      { templateId: 'mobility-foundation', expectedBlockId: 'mobility-flow' },
      { templateId: 'busy-travel', expectedBlockId: 'quick-strength' },
    ];

    cases.forEach(({ templateId, expectedBlockId }) => {
      const recommendation = resolveAdaptiveTrainingRecommendation({
        plan: createTemplatePlan(templateId),
        planningDateLocal: '2026-04-13',
        recentSessions: [],
      });

      expect(recommendation.primaryBlockId).toBe(expectedBlockId);
    });
  });

  it('advances rotations for expanded templates after recent sessions', () => {
    const cases: Array<{
      templateId: TrainingTemplateId;
      completedBlockLabel: string;
      completedAt: string;
      planningDateLocal: string;
      expectedBlockId: string;
    }> = [
      {
        templateId: 'hypertrophy-foundation',
        completedBlockLabel: 'Upper Hypertrophy',
        completedAt: '2026-04-13T12:00:00.000Z',
        planningDateLocal: '2026-04-15',
        expectedBlockId: 'lower-hypertrophy',
      },
      {
        templateId: 'fat-loss-conditioning',
        completedBlockLabel: 'Strength Circuit',
        completedAt: '2026-04-13T12:00:00.000Z',
        planningDateLocal: '2026-04-14',
        expectedBlockId: 'zone2-cardio',
      },
      {
        templateId: 'endurance-support',
        completedBlockLabel: 'Easy Cardio',
        completedAt: '2026-04-13T12:00:00.000Z',
        planningDateLocal: '2026-04-15',
        expectedBlockId: 'strength-support',
      },
      {
        templateId: 'mobility-foundation',
        completedBlockLabel: 'Mobility Flow',
        completedAt: '2026-04-13T12:00:00.000Z',
        planningDateLocal: '2026-04-15',
        expectedBlockId: 'stability-strength',
      },
      {
        templateId: 'busy-travel',
        completedBlockLabel: 'Quick Strength',
        completedAt: '2026-04-13T12:00:00.000Z',
        planningDateLocal: '2026-04-17',
        expectedBlockId: 'quick-conditioning',
      },
    ];

    cases.forEach(
      ({
        templateId,
        completedBlockLabel,
        completedAt,
        planningDateLocal,
        expectedBlockId,
      }) => {
        const recommendation = resolveAdaptiveTrainingRecommendation({
          plan: createTemplatePlan(templateId),
          planningDateLocal,
          recentSessions: [session(templateId, completedBlockLabel, completedAt)],
        });

        expect(recommendation.primaryBlockId).toBe(expectedBlockId);
      }
    );
  });

  it('counts fractional target contributions from expanded templates', () => {
    const progress = computeAdaptiveTargetProgress({
      plan: createTemplatePlan('mobility-foundation'),
      planningDateLocal: '2026-04-20',
      recentSessions: [
        session(
          'stability-strength',
          'Stability Strength',
          '2026-04-18T12:00:00.000Z'
        ),
      ],
    });

    expect(
      progress.find(
        (target: AdaptivePlanTargetProgress) => target.targetId === 'strength'
      )?.count
    ).toBe(1);
    expect(
      progress.find(
        (target: AdaptivePlanTargetProgress) => target.targetId === 'mobility'
      )?.count
    ).toBe(0.5);
  });

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

  it('uses explicit session attribution when the workout title conflicts with the block', () => {
    const recommendation = resolveAdaptiveTrainingRecommendation({
      plan: createPlan(),
      planningDateLocal: '2026-04-15',
      recentSessions: [
        {
          ...session('renamed-session', 'Pull', '2026-04-14T12:00:00.000Z'),
          name: 'Pull day renamed by AI',
          coachProgramAttribution: {
            programId: 'plan-ppl',
            programVersion: 1,
            sourceBlockId: 'push',
            templateId: 'ppl-conditioning',
            scheduleStrategy: 'ordered-rotation',
            sourceKind: 'generated',
            confidence: 'high',
          },
        },
      ],
    });

    expect(recommendation.primaryBlockId).toBe('pull');
  });

  it('uses low-confidence explicit attribution before legacy title matching', () => {
    const attribution = getSessionBlockAttribution(createPlan(), {
      ...session(
        'low-confidence-manual',
        'Pull day renamed by user',
        '2026-04-14T12:00:00.000Z'
      ),
      coachProgramAttribution: {
        programId: 'plan-ppl',
        programVersion: 1,
        sourceBlockId: 'push',
        templateId: 'ppl-conditioning',
        scheduleStrategy: 'ordered-rotation',
        sourceKind: 'manual-log',
        confidence: 'low',
      },
    });

    expect(attribution).toMatchObject({
      source: 'explicit',
      block: expect.objectContaining({ id: 'push' }),
    });
  });

  it('uses session-level attribution without exercise-level block metadata', () => {
    const plan = createUpperLowerPlan();
    const progress = computeAdaptiveTargetProgress({
      plan,
      planningDateLocal: '2026-04-15',
      recentSessions: [
        {
          ...session(
            'attributed-session',
            'Renamed session',
            '2026-04-14T12:00:00.000Z'
          ),
          coachProgramAttribution: {
            programId: plan.id,
            programVersion: 1,
            sourceBlockId: 'lower-strength',
            templateId: 'balanced-foundation',
            scheduleStrategy: 'weekly-target-balance',
            sourceKind: 'manual-log',
            confidence: 'high',
          },
        },
      ],
    });

    expect(
      progress.find(
        (target: AdaptivePlanTargetProgress) => target.targetId === 'strength'
      )?.count
    ).toBe(1);
  });

  it('counts all legacy blocks named in combined sessions', () => {
    const progress = computeAdaptiveTargetProgress({
      plan: createPlan(),
      planningDateLocal: '2026-04-20',
      recentSessions: [
        session(
          'combined-legacy',
          'Pull + Easy Cardio',
          '2026-04-19T12:00:00.000Z'
        ),
      ],
    });

    expect(
      progress.find(
        (target: AdaptivePlanTargetProgress) => target.targetId === 'lift'
      )?.count
    ).toBe(1);
    expect(
      progress.find(
        (target: AdaptivePlanTargetProgress) => target.targetId === 'cardio'
      )?.count
    ).toBe(1);
  });

  it('counts primary and add-on blocks from session attribution', () => {
    const progress = computeAdaptiveTargetProgress({
      plan: createPlan(),
      planningDateLocal: '2026-04-20',
      recentSessions: [
        {
          ...session(
            'combined-attributed',
            'Renamed combined session',
            '2026-04-19T12:00:00.000Z'
          ),
          coachProgramAttribution: {
            programId: 'plan-ppl',
            programVersion: 1,
            sourceBlockId: 'pull',
            addOnBlockIds: ['easy-cardio'],
            templateId: 'ppl-conditioning',
            scheduleStrategy: 'ordered-rotation',
            sourceKind: 'generated',
            confidence: 'high',
          },
        },
      ],
    });

    expect(
      progress.find(
        (target: AdaptivePlanTargetProgress) => target.targetId === 'lift'
      )?.count
    ).toBe(1);
    expect(
      progress.find(
        (target: AdaptivePlanTargetProgress) => target.targetId === 'cardio'
      )?.count
    ).toBe(1);
  });

  it('marks legacy title/focus matches as low-confidence attribution', () => {
    const attribution = getSessionBlockAttribution(
      createPlan(),
      session('legacy-push', 'Push', '2026-04-14T12:00:00.000Z')
    );

    expect(attribution).toMatchObject({
      source: 'legacy',
      block: expect.objectContaining({ id: 'push' }),
      attribution: expect.objectContaining({
        sourceBlockId: 'push',
        sourceKind: 'legacy-inferred',
        confidence: 'low',
      }),
    });
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

  it('counts same-day sessions and ignores archived sessions for target progress', () => {
    const progress = computeAdaptiveTargetProgress({
      plan: createPlan(),
      planningDateLocal: '2026-04-20',
      recentSessions: [
        session('today-push', 'Push', '2026-04-20T12:00:00.000Z'),
        {
          ...session('archived-pull', 'Pull', '2026-04-19T12:00:00.000Z'),
          archivedAt: '2026-04-19T13:00:00.000Z',
        },
      ],
    });

    expect(
      progress.find(
        (target: AdaptivePlanTargetProgress) => target.targetId === 'lift'
      )?.count
    ).toBe(1);
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
        session('cardio-2', 'Easy Cardio', '2026-04-11T12:00:00.000Z'),
        session('cardio-1', 'Easy Cardio', '2026-04-10T12:00:00.000Z'),
      ],
      availableTimeMinutes: 70,
    });

    expect(recommendation.primaryBlockId).toBe('push');
    expect(recommendation.addOnBlockIds).toContain('abs-accessory');
  });

  it('prefers a recovery add-on after recent high-impact stress', () => {
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
    expect(recommendation.addOnBlockIds).toContain('mobility');
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

  it('includes same-day events in the protection window', () => {
    const recommendation = resolveAdaptiveTrainingRecommendation({
      plan: createPlan(),
      planningDateLocal: '2026-04-17',
      recentSessions: [
        session('pull', 'Pull', '2026-04-16T12:00:00.000Z'),
        session('push', 'Push', '2026-04-15T12:00:00.000Z'),
      ],
      upcomingEvents: [
        {
          kind: 'run',
          title: 'Morning trail run',
          localDate: '2026-04-17',
          intensity: 'high',
          tags: ['lower-body'],
        },
      ],
    });

    expect(recommendation.primaryBlockId).not.toBe('legs');
    expect(recommendation.rationale.map((item) => item.code)).toContain(
      'event-protection'
    );
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

  it('matches recent sessions by specific block labels instead of broad categories', () => {
    const recommendation = resolveAdaptiveTrainingRecommendation({
      plan: createUpperLowerPlan(),
      planningDateLocal: '2026-04-15',
      recentSessions: [
        session('lower', 'Lower Strength', '2026-04-14T12:00:00.000Z'),
      ],
    });

    expect(recommendation.primaryBlockId).toBe('upper-strength');
  });

  it('protects upcoming upper-body stress without template-specific rules', () => {
    const recommendation = resolveAdaptiveTrainingRecommendation({
      plan: createUpperLowerPlan(),
      planningDateLocal: '2026-04-15',
      recentSessions: [
        session('lower', 'Lower Strength', '2026-04-14T12:00:00.000Z'),
      ],
      upcomingEvents: [
        {
          kind: 'sport',
          title: 'Shoulder-heavy climbing session',
          localDate: '2026-04-16',
          intensity: 'high',
          tags: ['shoulder', 'grip'],
        },
      ],
    });

    expect(recommendation.primaryBlockId).not.toBe('upper-strength');
    expect(recommendation.rationale.map((item) => item.code)).toContain(
      'event-protection'
    );
  });

  it('can recommend rest when main targets are covered and hard stress is recent', () => {
    const recommendation = resolveAdaptiveTrainingRecommendation({
      plan: createPlan(),
      planningDateLocal: '2026-04-20',
      recentSessions: [
        session('sprint', 'Sprint', '2026-04-19T12:00:00.000Z'),
        session('cardio', 'Easy Cardio', '2026-04-18T12:00:00.000Z'),
        session('legs', 'Legs', '2026-04-17T12:00:00.000Z'),
        session('pull', 'Pull', '2026-04-16T12:00:00.000Z'),
        session('push', 'Push', '2026-04-15T12:00:00.000Z'),
      ],
      availableTimeMinutes: 30,
    });

    expect(recommendation.primaryBlockId).toBe('rest');
    expect(recommendation.rationale.map((item) => item.code)).toContain(
      'rest-fit'
    );
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
