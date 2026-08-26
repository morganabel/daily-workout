import { getActiveDatabase } from '../activeDatabase';
import { CoachSessionActionRepository } from './CoachSessionActionRepository';

const database = getActiveDatabase();
const coachSessionActionRepository = new CoachSessionActionRepository(database);

describe('CoachSessionActionRepository', () => {
  afterEach(async () => {
    await database.write(async () => {
      const actions = await database.collections
        .get('coach_session_actions')
        .query()
        .fetch();
      await Promise.all(actions.map((action) => action.destroyPermanently()));
    });
  });

  it('records and lists durable skip actions', async () => {
    const action = await coachSessionActionRepository.recordSkipAction({
      programId: 'plan-ppl',
      programVersion: 1,
      strategy: 'ordered-rotation',
      cycleIndex: 2,
      sessionIdentityKey: 'ordered:push:1',
      projectionId: 'coachproj_push',
      sourceBlockId: 'push',
      projectedLocalDate: '2026-04-20',
      actionLocalDate: '2026-04-20',
      workoutId: 'workout-1',
      createdAt: '2026-04-20T12:00:00.000Z',
    });

    expect(action).toMatchObject({
      id: expect.any(String),
      actionKind: 'skip',
      programId: 'plan-ppl',
      projectionId: 'coachproj_push',
      workoutId: 'workout-1',
    });

    await expect(
      coachSessionActionRepository.listActionsForProgram('plan-ppl')
    ).resolves.toEqual([action]);
  });

  it('upserts skips by strategy, program version, cycle, and session identity', async () => {
    await coachSessionActionRepository.recordSkipAction({
      programId: 'plan-ppl',
      programVersion: 1,
      strategy: 'ordered-rotation',
      cycleIndex: 2,
      sessionIdentityKey: 'ordered:push:1',
      projectionId: 'coachproj_old',
      sourceBlockId: 'push',
      projectedLocalDate: '2026-04-20',
      actionLocalDate: '2026-04-20',
      createdAt: '2026-04-20T12:00:00.000Z',
    });

    const updated = await coachSessionActionRepository.recordSkipAction({
      programId: 'plan-ppl',
      programVersion: 1,
      strategy: 'ordered-rotation',
      cycleIndex: 2,
      sessionIdentityKey: 'ordered:push:1',
      projectionId: 'coachproj_new',
      sourceBlockId: 'push',
      projectedLocalDate: '2026-04-21',
      actionLocalDate: '2026-04-21',
      substitutionBlockId: 'pull',
      createdAt: '2026-04-21T12:00:00.000Z',
    });

    const actions = await coachSessionActionRepository.listActionsForProgram(
      'plan-ppl'
    );
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({
      id: updated.id,
      projectionId: 'coachproj_new',
      projectedLocalDate: '2026-04-21',
      substitutionBlockId: 'pull',
    });
  });

  it('keeps skip actions separate across schedule strategies', async () => {
    await coachSessionActionRepository.recordSkipAction({
      programId: 'plan-ppl',
      programVersion: 1,
      strategy: 'ordered-rotation',
      cycleIndex: 2,
      sessionIdentityKey: 'shared-session-key',
      projectionId: 'coachproj_ordered',
      sourceBlockId: 'push',
      projectedLocalDate: '2026-04-20',
      actionLocalDate: '2026-04-20',
      createdAt: '2026-04-20T12:00:00.000Z',
    });

    await coachSessionActionRepository.recordSkipAction({
      programId: 'plan-ppl',
      programVersion: 1,
      strategy: 'weekly-target-balance',
      cycleIndex: 2,
      sessionIdentityKey: 'shared-session-key',
      projectionId: 'coachproj_weekly',
      sourceBlockId: 'push',
      projectedLocalDate: '2026-04-20',
      actionLocalDate: '2026-04-20',
      createdAt: '2026-04-20T12:05:00.000Z',
    });

    const actions = await coachSessionActionRepository.listActionsForProgram(
      'plan-ppl'
    );

    expect(actions).toHaveLength(2);
    expect(actions.map((action) => action.projectionId).sort()).toEqual([
      'coachproj_ordered',
      'coachproj_weekly',
    ]);
  });
});
