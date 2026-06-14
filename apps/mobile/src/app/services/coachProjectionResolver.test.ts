import {
  createAdaptiveTrainingPlanFromTemplate,
  type AdaptiveTrainingPlan,
  type CoachSessionAction,
} from '@workout-agent/shared';
import { createSessionSummaryFixture } from '@workout-agent/shared/testing';
import {
  deriveCoachProjection,
  deriveCoachProjectionCycleIndex,
} from './coachProjectionResolver';

const createPplPlan = (
  overrides: Partial<AdaptiveTrainingPlan> = {}
): AdaptiveTrainingPlan => {
  const plan = createAdaptiveTrainingPlanFromTemplate('ppl-conditioning', {
    id: 'plan-ppl',
    activeFrom: '2026-04-15',
    updatedAt: '2026-04-15T12:00:00.000Z',
  });
  if (!plan) {
    throw new Error('Expected adaptive plan');
  }
  return { ...plan, ...overrides };
};

const createBalancedPlan = (
  overrides: Partial<AdaptiveTrainingPlan> = {}
): AdaptiveTrainingPlan => {
  const plan = createAdaptiveTrainingPlanFromTemplate('balanced-foundation', {
    id: 'plan-balanced',
    activeFrom: '2026-04-15',
    updatedAt: '2026-04-15T12:00:00.000Z',
  });
  if (!plan) {
    throw new Error('Expected adaptive plan');
  }
  return { ...plan, ...overrides };
};

const createCompletedSession = (
  plan: AdaptiveTrainingPlan,
  blockId: string,
  completedAt: string
) =>
  createSessionSummaryFixture({
    id: `session-${blockId}-${completedAt}`,
    name: 'Generated workout with a renamed title',
    focus: 'Custom focus',
    completedAt,
    durationMinutes: 45,
    coachProgramAttribution: {
      programId: plan.id,
      programVersion: plan.programVersion ?? 1,
      sourceBlockId: blockId,
      scheduleStrategy: plan.scheduleStrategy ?? 'weekly-target-balance',
      sourceKind: 'generated',
      confidence: 'high',
    },
  });

const createSkipAction = (
  plan: AdaptiveTrainingPlan,
  overrides: Partial<CoachSessionAction> = {}
): CoachSessionAction => ({
  id: 'skip-1',
  actionKind: 'skip',
  programId: plan.id,
  programVersion: plan.programVersion ?? 1,
  strategy: plan.scheduleStrategy ?? 'ordered-rotation',
  cycleIndex: 0,
  sessionIdentityKey: 'ordered:push:1',
  projectionId: 'old-projection-id',
  sourceBlockId: 'push',
  projectedLocalDate: '2026-04-15',
  actionLocalDate: '2026-04-15',
  createdAt: '2026-04-15T12:00:00.000Z',
  ...overrides,
});

describe('coach projection resolver', () => {
  it('derives cycle indexes with calendar math across DST crossings', () => {
    expect(deriveCoachProjectionCycleIndex('2026-03-08', '2026-03-15')).toBe(1);
    expect(deriveCoachProjectionCycleIndex('2026-11-01', '2026-11-08')).toBe(1);
  });

  it('returns deterministic ordered-rotation projections', () => {
    const plan = createPplPlan();
    const first = deriveCoachProjection({
      plan,
      planningDateLocal: '2026-04-15',
      recentSessions: [],
    });
    const second = deriveCoachProjection({
      plan,
      planningDateLocal: '2026-04-15',
      recentSessions: [],
    });

    expect(second).toEqual(first);
    expect(first.strategy).toBe('ordered-rotation');
    expect(first.sessions[0]).toMatchObject({
      sourceBlockId: 'push',
      sessionIdentityKey: 'ordered:push:1',
    });
  });

  it('keeps ids stable across daily refreshes within a cycle', () => {
    const plan = createPplPlan();
    const dayOne = deriveCoachProjection({
      plan,
      planningDateLocal: '2026-04-15',
      recentSessions: [],
    });
    const dayTwo = deriveCoachProjection({
      plan,
      planningDateLocal: '2026-04-16',
      recentSessions: [],
    });

    const dayOneCarryover = dayOne.sessions.find(
      (session) => session.localDate === '2026-04-16'
    );

    expect(dayTwo.sessions[0]?.sessionIdentityKey).toBe(
      dayOneCarryover?.sessionIdentityKey
    );
    expect(dayTwo.sessions[0]?.id).toBe(dayOneCarryover?.id);
  });

  it('re-anchors ids at explicit cycle boundaries', () => {
    const plan = createPplPlan();
    const lastDayOfCycle = deriveCoachProjection({
      plan,
      planningDateLocal: '2026-04-21',
      recentSessions: [],
    });
    const nextCycle = deriveCoachProjection({
      plan,
      planningDateLocal: '2026-04-22',
      recentSessions: [],
    });

    expect(lastDayOfCycle.cycleIndex).toBe(0);
    expect(nextCycle.cycleIndex).toBe(1);
    expect(nextCycle.sessions[0]?.id).not.toBe(lastDayOfCycle.sessions[0]?.id);
  });

  it('completed occurrences do not shift the pending session identity', () => {
    const plan = createPplPlan();
    const planned = deriveCoachProjection({
      plan,
      planningDateLocal: '2026-04-15',
      recentSessions: [],
    });
    const expectedPull = planned.sessions.find(
      (session) => session.localDate === '2026-04-16'
    );

    const afterCompletion = deriveCoachProjection({
      plan,
      planningDateLocal: '2026-04-16',
      recentSessions: [
        createCompletedSession(plan, 'push', '2026-04-15T12:00:00.000Z'),
      ],
    });

    expect(afterCompletion.sessions[0]).toMatchObject({
      sourceBlockId: 'pull',
      sessionIdentityKey: expectedPull?.sessionIdentityKey,
      id: expectedPull?.id,
    });
  });

  it('keeps skipped ordered work pending unless it has a substitution', () => {
    const plan = createPplPlan();
    const projection = deriveCoachProjection({
      plan,
      planningDateLocal: '2026-04-15',
      recentSessions: [],
      sessionActions: [createSkipAction(plan)],
    });

    expect(projection.sessions[0]).toMatchObject({
      localDate: '2026-04-15',
      status: 'skipped',
      sourceBlockId: 'push',
    });
    expect(projection.sessions[1]).toMatchObject({
      localDate: '2026-04-16',
      sourceBlockId: 'push',
      sessionIdentityKey: 'ordered:push:2',
    });
  });

  it('keeps earlier skipped ordered work pending after the skipped date', () => {
    const plan = createPplPlan();
    const projection = deriveCoachProjection({
      plan,
      planningDateLocal: '2026-04-16',
      recentSessions: [],
      sessionActions: [createSkipAction(plan)],
    });

    expect(projection.sessions[0]).toMatchObject({
      localDate: '2026-04-16',
      sourceBlockId: 'push',
      sessionIdentityKey: 'ordered:push:2',
    });
  });

  it('does not reuse a skipped ordered identity when the skipped date is pinned', () => {
    const skippedAction = createSkipAction(createPplPlan());
    const plan = createPplPlan({
      sessionPreferences: [
        {
          id: `pin:${skippedAction.cycleIndex}:${skippedAction.sessionIdentityKey}`,
          localDate: skippedAction.projectedLocalDate,
          blockIds: ['push'],
          status: 'pinned',
        },
      ],
    });
    const projection = deriveCoachProjection({
      plan,
      planningDateLocal: '2026-04-15',
      recentSessions: [],
      sessionActions: [skippedAction],
    });

    expect(new Set(projection.sessions.map((session) => session.id)).size).toBe(
      projection.sessions.length
    );
    expect(
      projection.sessions.filter(
        (session) =>
          session.cycleIndex === skippedAction.cycleIndex &&
          session.sessionIdentityKey === skippedAction.sessionIdentityKey
      )
    ).toHaveLength(1);
    expect(
      projection.sessions.find(
        (session) =>
          session.cycleIndex === skippedAction.cycleIndex &&
          session.sessionIdentityKey === skippedAction.sessionIdentityKey &&
          session.status === 'projected'
      )
    ).toBeUndefined();
  });

  it('ignores skip records from a previous schedule strategy', () => {
    const plan = createPplPlan();
    const projection = deriveCoachProjection({
      plan,
      planningDateLocal: '2026-04-15',
      recentSessions: [],
      sessionActions: [
        createSkipAction(plan, {
          strategy: 'weekly-target-balance',
        }),
      ],
    });

    expect(projection.sessions[0]).toMatchObject({
      localDate: '2026-04-15',
      status: 'projected',
      sourceBlockId: 'push',
      sessionIdentityKey: 'ordered:push:1',
    });
  });

  it('applies skip records after program version changes', () => {
    const plan = createPplPlan({ programVersion: 2 });
    const projection = deriveCoachProjection({
      plan,
      planningDateLocal: '2026-04-15',
      recentSessions: [],
      sessionActions: [
        createSkipAction(plan, {
          programVersion: 1,
          projectionId: 'projection-from-version-1',
        }),
      ],
    });

    expect(projection.sessions[0]).toMatchObject({
      programVersion: 2,
      status: 'skipped',
      sessionIdentityKey: 'ordered:push:1',
    });
  });

  it('applies skip records after cycle re-anchoring regenerates projection ids', () => {
    const plan = createPplPlan();
    const projection = deriveCoachProjection({
      plan,
      planningDateLocal: '2026-04-22',
      recentSessions: [],
      sessionActions: [
        createSkipAction(plan, {
          cycleIndex: 1,
          sessionIdentityKey: 'ordered:push:1',
          projectionId: 'projection-from-previous-derivation',
          projectedLocalDate: '2026-04-22',
          actionLocalDate: '2026-04-22',
        }),
      ],
    });

    expect(projection.cycleIndex).toBe(1);
    expect(projection.sessions[0]).toMatchObject({
      status: 'skipped',
      sessionIdentityKey: 'ordered:push:1',
      localDate: '2026-04-22',
    });
    expect(projection.sessions[0]?.id).not.toBe(
      'projection-from-previous-derivation'
    );
  });

  it('projects weekly target balance without a strict queue identity', () => {
    const plan = createBalancedPlan();
    const projection = deriveCoachProjection({
      plan,
      planningDateLocal: '2026-04-15',
      recentSessions: [],
    });

    expect(projection.strategy).toBe('weekly-target-balance');
    expect(projection.sessions[0]?.sessionIdentityKey).toMatch(/^target:/);
    expect(
      new Set(projection.sessions.map((session) => session.sourceBlockId)).size
    ).toBeGreaterThan(1);
  });

  it('does not reuse a skipped weekly target identity when the skipped date is pinned', () => {
    const basePlan = createBalancedPlan();
    const baseProjection = deriveCoachProjection({
      plan: basePlan,
      planningDateLocal: '2026-04-15',
      recentSessions: [],
    });
    const skippedSession = baseProjection.sessions.find(
      (session) => session.sourceBlockId
    );
    if (!skippedSession?.sourceBlockId) {
      throw new Error('Expected generatable weekly target session');
    }

    const skipAction: CoachSessionAction = {
      id: 'skip-weekly-1',
      actionKind: 'skip',
      programId: basePlan.id,
      programVersion: basePlan.programVersion ?? 1,
      strategy: basePlan.scheduleStrategy ?? 'weekly-target-balance',
      cycleIndex: skippedSession.cycleIndex,
      sessionIdentityKey: skippedSession.sessionIdentityKey,
      projectionId: skippedSession.id,
      sourceBlockId: skippedSession.sourceBlockId,
      projectedLocalDate: skippedSession.localDate,
      actionLocalDate: skippedSession.localDate,
      createdAt: '2026-04-15T12:00:00.000Z',
    };
    const plan = createBalancedPlan({
      sessionPreferences: [
        {
          id: `pin:${skippedSession.cycleIndex}:${skippedSession.sessionIdentityKey}`,
          localDate: skippedSession.localDate,
          blockIds: [skippedSession.sourceBlockId],
          status: 'pinned',
        },
      ],
    });

    const projection = deriveCoachProjection({
      plan,
      planningDateLocal: '2026-04-15',
      recentSessions: [],
      sessionActions: [skipAction],
    });

    expect(new Set(projection.sessions.map((session) => session.id)).size).toBe(
      projection.sessions.length
    );
    expect(
      projection.sessions.filter(
        (session) =>
          session.cycleIndex === skippedSession.cycleIndex &&
          session.sessionIdentityKey === skippedSession.sessionIdentityKey
      )
    ).toHaveLength(1);
  });

  it('returns explicit unsupported state for future strategy hooks', () => {
    const plan = createBalancedPlan({ scheduleStrategy: 'event-prep' });
    const projection = deriveCoachProjection({
      plan,
      planningDateLocal: '2026-04-15',
      recentSessions: [],
    });

    expect(projection.strategyStatus).toBe('unsupported');
    expect(projection.sessions).toEqual([]);
    expect(projection.repairNotes[0]).toContain('not implemented yet');
  });

  it('repairs an event conflict without changing session identity', () => {
    const plan = createPplPlan();
    const baseline = deriveCoachProjection({
      plan,
      planningDateLocal: '2026-04-15',
      recentSessions: [],
    });
    const baselineLegs = baseline.sessions.find(
      (session) => session.sourceBlockId === 'legs'
    );

    const repaired = deriveCoachProjection({
      plan,
      planningDateLocal: '2026-04-15',
      recentSessions: [],
      upcomingEvents: [
        {
          kind: 'run',
          title: 'Tempo run',
          localDate: '2026-04-17',
          intensity: 'high',
        },
      ],
    });
    const repairedLegs = repaired.sessions.find(
      (session) => session.sourceBlockId === 'legs'
    );

    expect(repairedLegs).toMatchObject({
      id: baselineLegs?.id,
      sessionIdentityKey: baselineLegs?.sessionIdentityKey,
      status: 'repaired',
      localDate: '2026-04-18',
    });
    expect(repaired.repairNotes.join(' ')).toContain('upcoming event');
  });

  it('keeps pinned ids stable when the pinned date moves within a cycle', () => {
    const basePlan = createPplPlan({
      sessionPreferences: [
        {
          id: 'pin-push',
          localDate: '2026-04-15',
          blockIds: ['push'],
          status: 'pinned',
        },
      ],
    });
    const movedPlan = createPplPlan({
      sessionPreferences: [
        {
          id: 'pin-push',
          localDate: '2026-04-16',
          blockIds: ['push'],
          status: 'pinned',
        },
      ],
    });

    const base = deriveCoachProjection({
      plan: basePlan,
      planningDateLocal: '2026-04-15',
      recentSessions: [],
    });
    const moved = deriveCoachProjection({
      plan: movedPlan,
      planningDateLocal: '2026-04-15',
      recentSessions: [],
    });

    const basePinned = base.sessions.find(
      (session) => session.sessionIdentityKey === 'pin:pin-push'
    );
    const movedPinned = moved.sessions.find(
      (session) => session.sessionIdentityKey === 'pin:pin-push'
    );

    expect(movedPinned).toMatchObject({
      id: basePinned?.id,
      localDate: '2026-04-16',
      projectionStatus: 'pinned',
    });
  });

  it('warns rather than moving pinned conflicts', () => {
    const plan = createPplPlan({
      sessionPreferences: [
        {
          id: 'pin-legs',
          localDate: '2026-04-15',
          blockIds: ['legs'],
          status: 'pinned',
        },
      ],
    });
    const projection = deriveCoachProjection({
      plan,
      planningDateLocal: '2026-04-15',
      recentSessions: [],
      upcomingEvents: [
        {
          kind: 'run',
          title: 'Race day',
          localDate: '2026-04-15',
          intensity: 'high',
        },
      ],
    });

    expect(projection.sessions[0]).toMatchObject({
      status: 'conflict',
      projectionStatus: 'pinned',
      localDate: '2026-04-15',
    });
    expect(projection.conflictWarnings[0]).toMatchObject({
      kind: 'planned-event-conflict',
      eventTitle: 'Race day',
      actions: ['keep-pinned', 'move', 'unpin'],
    });
  });
});
