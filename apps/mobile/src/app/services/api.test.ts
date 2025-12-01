import { buildGenerationContext, archiveWorkoutSession, deleteWorkoutSession, unarchiveWorkoutSession } from './api';
import { workoutRepository } from '../db/repositories/WorkoutRepository';
import { userRepository } from '../db/repositories/UserRepository';
import type { WorkoutSessionSummary } from '@workout-agent/shared';

jest.mock('../db/repositories/WorkoutRepository', () => ({
  workoutRepository: {
    listRecentSessions: jest.fn(),
    toSessionSummary: jest.fn(),
    archiveWorkoutById: jest.fn(),
    unarchiveWorkoutById: jest.fn(),
    deleteWorkoutById: jest.fn(),
  },
}));

jest.mock('../db/repositories/UserRepository', () => ({
  userRepository: {
    getPreferences: jest.fn(),
  },
}));

const mockWorkoutRepository = workoutRepository as jest.Mocked<typeof workoutRepository>;
const mockUserRepository = userRepository as jest.Mocked<typeof userRepository>;

describe('buildGenerationContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUserRepository.getPreferences.mockResolvedValue({
      equipment: ['Dumbbells'],
      experienceLevel: 'intermediate',
      primaryGoal: 'Get stronger',
      injuries: [],
      focusBias: [],
      avoid: [],
      preferredStyle: 'Hybrid',
    });
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
      source: 'generated',
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

    const context = await buildGenerationContext({ timeMinutes: 30, focus: 'Legs' });

    expect(mockWorkoutRepository.listRecentSessions).toHaveBeenCalledWith(5, { includeArchived: false });
    expect(context.recentSessions).toEqual([session1, session2]);
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
    expect(mockWorkoutRepository.unarchiveWorkoutById).toHaveBeenCalledWith('w2');
    expect(mockWorkoutRepository.deleteWorkoutById).toHaveBeenCalledWith('w3');
  });
});
