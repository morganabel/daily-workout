import { createAdaptiveTrainingPlanFromTemplate } from '@workout-agent/shared';
import { deriveCoachProjection } from './coachProjectionResolver';
import {
  buildCoachProjectionAdaptiveIntent,
  buildCoachProjectionGenerationRequest,
} from './coachProjectionGenerationRequest';

const buildPlanAndProjection = (planningDateLocal: string) => {
  const plan = createAdaptiveTrainingPlanFromTemplate('ppl-conditioning', {
    id: 'plan-ppl',
    activeFrom: '2026-04-15',
    updatedAt: '2026-04-15T12:00:00.000Z',
  });
  if (!plan) {
    throw new Error('Expected adaptive plan from template');
  }

  const projection = deriveCoachProjection({
    plan,
    planningDateLocal,
    recentSessions: [],
    sessionActions: [],
    upcomingEvents: [],
    windowDays: 14,
  });

  return { plan, projection };
};

const firstGeneratableSession = (
  projection: ReturnType<typeof buildPlanAndProjection>['projection']
) => {
  const session = projection.sessions.find((entry) => entry.sourceBlockId);
  if (!session) {
    throw new Error('Expected at least one session with a source block');
  }
  return session;
};

const futureGeneratableSession = (
  projection: ReturnType<typeof buildPlanAndProjection>['projection'],
  planningDateLocal: string
) => {
  const session = projection.sessions.find(
    (entry) => entry.sourceBlockId && entry.localDate !== planningDateLocal
  );
  if (!session) {
    throw new Error('Expected a future session with a source block');
  }
  return session;
};

describe('buildCoachProjectionGenerationRequest', () => {
  it('builds a request that carries the projection coach intent', () => {
    const planningDateLocal = '2026-04-15';
    const { plan, projection } = buildPlanAndProjection(planningDateLocal);
    const session = futureGeneratableSession(projection, planningDateLocal);

    const request = buildCoachProjectionGenerationRequest({
      plan,
      projection,
      session,
      planningDateLocal: session.localDate,
    });

    expect(request).not.toBeNull();
    expect(request?.adaptivePlanIntent?.planId).toBe('plan-ppl');
    expect(request?.adaptivePlanIntent?.projectionId).toBe(session.id);
    expect(request?.adaptivePlanIntent?.primaryBlock.blockId).toBe(
      session.sourceBlockId
    );
    expect(request?.planningDateLocal).toBe(session.localDate);
    expect(request?.adaptivePlanIntent?.planningDateLocal).toBe(
      session.localDate
    );
    expect(request?.focus).toBe(
      request?.adaptivePlanIntent?.primaryBlock.label
    );
  });

  it('defaults energy to moderate and applies duration/equipment overrides', () => {
    const { plan, projection } = buildPlanAndProjection('2026-04-15');
    const session = firstGeneratableSession(projection);

    const defaulted = buildCoachProjectionGenerationRequest({
      plan,
      projection,
      session,
      planningDateLocal: '2026-04-15',
    });
    expect(defaulted?.energy).toBe('moderate');

    const overridden = buildCoachProjectionGenerationRequest({
      plan,
      projection,
      session,
      planningDateLocal: '2026-04-15',
      durationMinutes: 75,
      energy: 'intense',
      equipment: ['Dumbbells'],
    });
    expect(overridden?.timeMinutes).toBe(75);
    expect(overridden?.energy).toBe('intense');
    expect(overridden?.equipment).toEqual(['Dumbbells']);
  });

  it('keeps pinned disposition when a pinned session is shown as a conflict', () => {
    const { plan, projection } = buildPlanAndProjection('2026-04-15');
    const session = {
      ...firstGeneratableSession(projection),
      status: 'conflict' as const,
      projectionStatus: 'pinned' as const,
    };

    const intent = buildCoachProjectionAdaptiveIntent({
      plan,
      projection,
      session,
      planningDateLocal: session.localDate,
    });

    expect(intent?.sessionDisposition).toBe('pinned');
    expect(intent?.projectionStatus).toBe('pinned');
  });

  it('returns null when the session has no source block (rest projection)', () => {
    const { plan, projection } = buildPlanAndProjection('2026-04-15');
    const session = firstGeneratableSession(projection);

    const restSession = { ...session, sourceBlockId: undefined };
    const intent = buildCoachProjectionAdaptiveIntent({
      plan,
      projection,
      session: restSession,
      planningDateLocal: '2026-04-15',
    });
    expect(intent).toBeNull();

    const request = buildCoachProjectionGenerationRequest({
      plan,
      projection,
      session: restSession,
      planningDateLocal: '2026-04-15',
    });
    expect(request).toBeNull();
  });
});
