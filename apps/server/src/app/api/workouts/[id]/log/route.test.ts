/**
 * Tests for POST /api/workouts/:id/log route
 */

import { POST } from './route';
import { authenticateRequest } from '@/lib/auth';
import { getGenerationState, clearStoredPlan } from '@/lib/generation-store';
import { persistLoggedSession } from '@/lib/workout-session-store';

jest.mock('@/lib/auth');
jest.mock('@/lib/generation-store');
jest.mock('@/lib/workout-session-store');

const mockAuthenticateRequest = authenticateRequest as jest.MockedFunction<typeof authenticateRequest>;
const mockGetGenerationState = getGenerationState as jest.MockedFunction<typeof getGenerationState>;
const mockClearStoredPlan = clearStoredPlan as jest.MockedFunction<typeof clearStoredPlan>;
const mockPersistLoggedSession = persistLoggedSession as jest.MockedFunction<typeof persistLoggedSession>;

describe('POST /api/workouts/:id/log', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPersistLoggedSession.mockImplementation((_, summary, session) => ({
      recentSessions: [summary],
      loggedSession: session,
    }));
    mockGetGenerationState.mockReturnValue({
      plan: {
        id: 'plan-123',
        focus: 'Upper Body Push',
        durationMinutes: 32,
        equipment: [],
        source: 'ai',
        energy: 'moderate',
        summary: 'Sample',
        blocks: [],
      },
      generationStatus: { state: 'idle', submittedAt: null },
    });
  });

  it('logs a detailed plan session with sets', async () => {
    mockAuthenticateRequest.mockResolvedValue({
      userId: 'user-123',
      deviceToken: 'test-token',
    });

    const planId = 'plan-123';
    const payload = {
      type: 'plan',
      durationSeconds: 1800,
      exercises: [
        {
          exerciseId: 'ex-1',
          name: 'Bench Press',
          sets: [
            { order: 1, reps: 10, load: { weight: 60, unit: 'kg' }, completed: true },
            { order: 2, reps: 8, load: { weight: 60, unit: 'kg' }, rpe: 8, completed: true },
          ],
        },
      ],
    };

    const request = new Request(`http://localhost:3000/api/workouts/${planId}/log`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const params = Promise.resolve({ id: planId });
    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.loggedSession.exercises[0].sets[0].load.unit).toBe('kg');
    expect(data.recentSessions[0].id).toBe(data.loggedSession.id);
    expect(mockPersistLoggedSession).toHaveBeenCalled();
    expect(mockClearStoredPlan).toHaveBeenCalledWith('test-token');
  });

  it('returns 401 when not authenticated', async () => {
    mockAuthenticateRequest.mockResolvedValue(null);

    const planId = 'plan-123';
    const request = new Request(`http://localhost:3000/api/workouts/${planId}/log`, {
      method: 'POST',
    });

    const params = Promise.resolve({ id: planId });
    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.code).toBe('UNAUTHORIZED');
  });

  it('supports legacy quick log payload without sets', async () => {
    mockAuthenticateRequest.mockResolvedValue({
      userId: 'user-123',
      deviceToken: 'test-token',
    });
    mockGetGenerationState.mockReturnValue({
      plan: null,
      generationStatus: { state: 'idle', submittedAt: null },
    });

    const planId = 'manual';
    const payload = {
      name: 'Manual Session',
      focus: 'Legs',
      durationMinutes: 25,
    };

    const request = new Request(`http://localhost:3000/api/workouts/${planId}/log`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const response = await POST(request, { params: { id: planId } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.loggedSession.source).toBe('manual');
    expect(data.recentSessions[0].focus).toBe('Legs');
  });

  it('handles direct params for compatibility', async () => {
    mockAuthenticateRequest.mockResolvedValue({
      userId: 'user-123',
      deviceToken: 'test-token',
    });

    const planId = 'plan-123';
    const request = new Request(`http://localhost:3000/api/workouts/${planId}/log`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test-token',
      },
      body: JSON.stringify({
        type: 'plan',
        exercises: [
          {
            exerciseId: 'ex-1',
            name: 'Bench',
            sets: [{ order: 0, reps: 5, load: { weight: 100, unit: 'lb' }, completed: true }],
          },
        ],
      }),
    });

    const response = await POST(request, { params: { id: planId } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.loggedSession.workoutId).toBe(planId);
  });

  it('returns 422 for weight without unit', async () => {
    mockAuthenticateRequest.mockResolvedValue({
      userId: 'user-123',
      deviceToken: 'test-token',
    });

    const planId = 'plan-123';
    const request = new Request(`http://localhost:3000/api/workouts/${planId}/log`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'plan',
        exercises: [
          {
            exerciseId: 'ex-1',
            name: 'Bench',
            sets: [{ order: 0, reps: 5, load: { weight: 100 }, completed: true }],
          },
        ],
      }),
    });

    const response = await POST(request, { params: { id: planId } });
    expect(response.status).toBe(422);
  });

  it('returns 422 for unit without weight', async () => {
    mockAuthenticateRequest.mockResolvedValue({
      userId: 'user-123',
      deviceToken: 'test-token',
    });

    const planId = 'plan-123';
    const request = new Request(`http://localhost:3000/api/workouts/${planId}/log`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'plan',
        exercises: [
          {
            exerciseId: 'ex-1',
            name: 'Bench',
            sets: [{ order: 0, reps: 5, load: { unit: 'kg' }, completed: true }],
          },
        ],
      }),
    });

    const response = await POST(request, { params: { id: planId } });
    expect(response.status).toBe(422);
  });

  it('returns 422 for invalid reps or rpe', async () => {
    mockAuthenticateRequest.mockResolvedValue({
      userId: 'user-123',
      deviceToken: 'test-token',
    });

    const planId = 'plan-123';
    const request = new Request(`http://localhost:3000/api/workouts/${planId}/log`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'plan',
        exercises: [
          {
            exerciseId: 'ex-1',
            name: 'Bench',
            sets: [
              { order: 0, reps: 0, load: { weight: 50, unit: 'kg' }, completed: false },
              { order: 1, reps: 5, load: { weight: 50, unit: 'kg' }, rpe: 11, completed: true },
            ],
          },
        ],
      }),
    });

    const response = await POST(request, { params: { id: planId } });
    expect(response.status).toBe(422);
  });

  it('returns 422 for malformed json', async () => {
    mockAuthenticateRequest.mockResolvedValue({
      userId: 'user-123',
      deviceToken: 'test-token',
    });

    const planId = 'plan-123';
    const badBody = '{ "type": "plan", "exercises": ['; // incomplete JSON

    const request = new Request(`http://localhost:3000/api/workouts/${planId}/log`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test-token',
        'Content-Type': 'application/json',
      },
      body: badBody,
    });

    const response = await POST(request, { params: { id: planId } });
    expect(response.status).toBe(422);
  });
});
