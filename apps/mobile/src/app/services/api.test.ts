import {
  createTodayPlanMock,
  type WorkoutSessionSummary,
} from '@workout-agent/shared';
import {
  buildGenerationContext,
  generateWorkout,
  archiveWorkoutSession,
  deleteWorkoutSession,
  unarchiveWorkoutSession,
  quickLogWorkout,
} from './api';
import { workoutRepository } from '../db/repositories/WorkoutRepository';
import { userRepository } from '../db/repositories/UserRepository';
import { plannedEventRepository } from '../db/repositories/PlannedEventRepository';

// Mock auth-client to avoid ESM import issues (jest.mock is hoisted)
jest.mock('./auth-client', () => ({
  getSessionCookie: jest.fn(() => null),
  getSessionToken: jest.fn().mockResolvedValue(null),
  isAuthEnabled: jest.fn().mockResolvedValue(false),
}));

jest.mock('../storage/deviceToken', () => ({
  getDeviceToken: jest.fn().mockResolvedValue(null),
}));

jest.mock('../storage/byokKey', () => ({
  getByokApiKey: jest.fn().mockResolvedValue(null),
  getByokConfig: jest.fn().mockResolvedValue(null),
}));

jest.mock('../db/repositories/WorkoutRepository', () => ({
  workoutRepository: {
    listRecentSessions: jest.fn(),
    toSessionSummary: jest.fn(),
    saveGeneratedPlan: jest.fn(),
    archiveWorkoutById: jest.fn(),
    unarchiveWorkoutById: jest.fn(),
    deleteWorkoutById: jest.fn(),
    quickLogManualSession: jest.fn(),
  },
}));

jest.mock('../db/repositories/UserRepository', () => ({
  userRepository: {
    getPreferences: jest.fn(),
  },
}));

jest.mock('../db/repositories/PlannedEventRepository', () => ({
  plannedEventRepository: {
    listUpcomingEventContext: jest.fn(),
  },
}));

const mockWorkoutRepository = workoutRepository as jest.Mocked<
  typeof workoutRepository
>;
const mockUserRepository = userRepository as jest.Mocked<typeof userRepository>;
const mockPlannedEventRepository = plannedEventRepository as jest.Mocked<
  typeof plannedEventRepository
>;

describe('buildGenerationContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
    mockUserRepository.getPreferences.mockResolvedValue({
      equipment: ['Dumbbells'],
      experienceLevel: 'intermediate',
      primaryGoal: 'Get stronger',
      injuries: [],
      focusBias: [],
      avoid: [],
      preferredStyle: 'Hybrid',
    });
    mockPlannedEventRepository.listUpcomingEventContext.mockResolvedValue([]);
  });

  it('fetches recent sessions excluding archived at the query level', async () => {
    const now = new Date().toISOString();
    const session1: WorkoutSessionSummary = {
      id: 'session-1',
      name: 'Strength',
      focus: 'Legs',
      durationMinutes: 30,
      completedAt: now,
      source: 'manual',
    };
    const session2: WorkoutSessionSummary = {
      id: 'session-2',
      name: 'Cardio',
      focus: 'Full Body',
      durationMinutes: 20,
      completedAt: now,
      source: 'ai',
    };

    // listRecentSessions with includeArchived: false returns only non-archived workouts
    // (archived workouts are filtered at the database query level)
    mockWorkoutRepository.listRecentSessions.mockResolvedValue([
      { id: 'workout-1' } as any,
      { id: 'workout-2' } as any,
    ]);
    mockWorkoutRepository.toSessionSummary
      .mockReturnValueOnce(session1)
      .mockReturnValueOnce(session2);

    const context = await buildGenerationContext({
      timeMinutes: 30,
      focus: 'Legs',
    });

    expect(mockWorkoutRepository.listRecentSessions).toHaveBeenCalledWith(5, {
      includeArchived: false,
    });
    expect(context.recentSessions).toEqual([session1, session2]);
  });
});

describe('generateWorkout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
    mockUserRepository.getPreferences.mockResolvedValue({
      equipment: ['Dumbbells'],
      experienceLevel: 'intermediate',
      primaryGoal: 'Get stronger',
      injuries: [],
      focusBias: [],
      avoid: [],
      preferredStyle: 'Hybrid',
    });
    mockWorkoutRepository.listRecentSessions.mockResolvedValue([] as any);
    mockPlannedEventRepository.listUpcomingEventContext.mockResolvedValue([
      {
        kind: 'run',
        title: 'Tempo Run',
        localDate: '2026-04-16',
      },
    ]);
  });

  it('sends full context, planning date, and baseline workout during regeneration', async () => {
    const baselineWorkout = createTodayPlanMock({
      id: 'plan-existing',
      responseId: 'resp-baseline',
      generationProvenance: {
        provider: 'openai',
        responseId: 'resp-baseline',
      },
    });
    const generatedPlan = createTodayPlanMock({
      id: 'plan-new',
      generationProvenance: {
        provider: 'openai',
        responseId: 'resp-next',
      },
    });

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(generatedPlan),
    });

    await generateWorkout(
      {
        timeMinutes: 45,
        focus: 'Smart',
        energy: 'moderate',
        previousResponseId: 'resp-baseline',
        baselineWorkout,
        feedback: ['different-exercises'],
      },
      { scheduledDate: new Date('2026-04-15T12:00:00Z').getTime() },
    );

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [, requestInit] = (global.fetch as jest.Mock).mock.calls[0];
    const payload = JSON.parse(requestInit.body as string);

    expect(payload.previousResponseId).toBe('resp-baseline');
    expect(payload.planningDateLocal).toBe('2026-04-15');
    expect(payload.baselineWorkout.id).toBe('plan-existing');
    expect(payload.context).toEqual(
      expect.objectContaining({
        recentSessions: [],
        environment: expect.objectContaining({
          timeAvailableMinutes: 45,
        }),
      }),
    );
    expect(payload.upcomingEvents).toHaveLength(1);
    expect(mockWorkoutRepository.saveGeneratedPlan).toHaveBeenCalledWith(
      generatedPlan,
      { scheduledDate: new Date('2026-04-15T12:00:00Z').getTime() },
    );
  });
});

describe('workout archive/delete mutations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delegates archive, unarchive, and delete to the repository', async () => {
    await archiveWorkoutSession('w1');
    await unarchiveWorkoutSession('w2');
    await deleteWorkoutSession('w3');

    expect(mockWorkoutRepository.archiveWorkoutById).toHaveBeenCalledWith('w1');
    expect(mockWorkoutRepository.unarchiveWorkoutById).toHaveBeenCalledWith(
      'w2',
    );
    expect(mockWorkoutRepository.deleteWorkoutById).toHaveBeenCalledWith('w3');
  });
});

describe('quickLogWorkout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a manual workout session and returns the summary', async () => {
    const mockWorkout = { id: 'quick-log-1', name: 'Morning Run' };
    const mockSummary: WorkoutSessionSummary = {
      id: 'quick-log-1',
      name: 'Morning Run',
      focus: 'Cardio',
      durationMinutes: 30,
      completedAt: new Date().toISOString(),
      source: 'manual',
    };

    mockWorkoutRepository.quickLogManualSession.mockResolvedValue(
      mockWorkout as any,
    );
    mockWorkoutRepository.toSessionSummary.mockReturnValue(mockSummary);

    const result = await quickLogWorkout({
      name: 'Morning Run',
      focus: 'Cardio',
      durationMinutes: 30,
    });

    expect(mockWorkoutRepository.quickLogManualSession).toHaveBeenCalledWith({
      name: 'Morning Run',
      focus: 'Cardio',
      durationMinutes: 30,
    });
    expect(mockWorkoutRepository.toSessionSummary).toHaveBeenCalledWith(
      mockWorkout,
    );
    expect(result).toEqual(mockSummary);
  });

  it('passes completedAt for earlier-today entries', async () => {
    const mockWorkout = { id: 'quick-log-2' };
    const mockSummary: WorkoutSessionSummary = {
      id: 'quick-log-2',
      name: 'Yoga',
      focus: 'Mobility',
      durationMinutes: 45,
      completedAt: new Date().toISOString(),
      source: 'manual',
    };
    const completedAt = Date.now() - 2 * 60 * 60 * 1000;

    mockWorkoutRepository.quickLogManualSession.mockResolvedValue(
      mockWorkout as any,
    );
    mockWorkoutRepository.toSessionSummary.mockReturnValue(mockSummary);

    await quickLogWorkout({
      name: 'Yoga',
      focus: 'Mobility',
      durationMinutes: 45,
      completedAt,
      note: 'Felt great!',
    });

    expect(mockWorkoutRepository.quickLogManualSession).toHaveBeenCalledWith({
      name: 'Yoga',
      focus: 'Mobility',
      durationMinutes: 45,
      completedAt,
      note: 'Felt great!',
    });
  });
});
