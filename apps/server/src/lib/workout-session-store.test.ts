import { persistLoggedSession, getRecentSessions, resetWorkoutSessionStore } from './workout-session-store';
import type { WorkoutSession, WorkoutSessionSummary } from '@workout-agent/shared';

describe('workout-session-store', () => {
  const tokenA = 'device-a';
  const tokenB = 'device-b';

  const makeSession = (id: string): { summary: WorkoutSessionSummary; session: WorkoutSession } => ({
    summary: {
      id,
      name: `Session ${id}`,
      focus: 'Push',
      completedAt: '2025-12-17T00:00:00Z',
      durationMinutes: 30,
      source: 'ai',
    },
    session: {
      id,
      workoutId: 'plan-1',
      name: `Session ${id}`,
      focus: 'Push',
      source: 'ai',
      completedAt: '2025-12-17T00:00:00Z',
      durationSeconds: 1800,
      exercises: [
        {
          exerciseId: 'ex-1',
          name: 'Bench',
          sets: [
            { order: 0, reps: 5, load: { weight: 100, unit: 'lb' }, completed: true },
            { order: 1, reps: 5, load: { weight: 90, unit: 'lb' }, completed: false },
          ],
        },
      ],
    },
  });

  beforeEach(() => {
    resetWorkoutSessionStore();
  });

  it('truncates to the recent limit and clones responses', () => {
    for (let i = 0; i < 6; i += 1) {
      const { summary, session } = makeSession(`s${i}`);
      persistLoggedSession(tokenA, summary, session, 3);
    }

    const result = getRecentSessions(tokenA, 3);
    expect(result.recentSessions).toHaveLength(3);
    expect(result.recentSessions[0].id).toBe('s5');

    // Mutate the returned objects to confirm cloning
    result.recentSessions[0].name = 'Mutated';
    if (result.loggedSession) {
      result.loggedSession.exercises[0].sets[0].load!.weight = 999;
    }

    const fresh = getRecentSessions(tokenA, 3);
    expect(fresh.recentSessions[0].name).toBe('Session s5');
    expect(fresh.loggedSession?.exercises[0].sets[0].load?.weight).toBe(100);
  });

  it('isolates sessions per device token', () => {
    const { summary, session } = makeSession('sa');
    persistLoggedSession(tokenA, summary, session, 5);

    const { summary: summaryB, session: sessionB } = makeSession('sb');
    persistLoggedSession(tokenB, summaryB, sessionB, 5);

    const aView = getRecentSessions(tokenA, 5);
    const bView = getRecentSessions(tokenB, 5);

    expect(aView.recentSessions[0].id).toBe('sa');
    expect(bView.recentSessions[0].id).toBe('sb');
    expect(aView.recentSessions[0].id).not.toBe(bView.recentSessions[0].id);
  });
});
