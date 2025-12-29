/**
 * Tests for POST /api/workouts/:id/log route
 */

// Mock the wiring module to prevent SDK initialization
jest.mock('@/lib/wiring');

import { POST } from './route';
import { logWorkoutHandler } from '@/lib/wiring';
import {
  createSessionSummaryMock,
  workoutSessionSummarySchema,
} from '@workout-agent/shared';

const mockLogWorkoutHandler = logWorkoutHandler as jest.MockedFunction<
  typeof logWorkoutHandler
>;

describe('POST /api/workouts/:id/log', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should delegate to logWorkoutHandler with planId', async () => {
    const session = createSessionSummaryMock({
      id: 'session-123',
      completedAt: new Date().toISOString(),
    });
    const mockResponse = Response.json(workoutSessionSummarySchema.parse(session));
    mockLogWorkoutHandler.mockResolvedValue(mockResponse);

    const request = new Request(
      'http://localhost:3000/api/workouts/plan-123/log',
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer test-token',
        },
      }
    );

    const params = { id: 'plan-123' };
    const response = await POST(request, { params });

    expect(mockLogWorkoutHandler).toHaveBeenCalledWith(request, 'plan-123');
    expect(response).toBe(mockResponse);
  });

  it('should handle Promise params (Next.js 15 compatibility)', async () => {
    const session = createSessionSummaryMock({
      id: 'session-456',
    });
    const mockResponse = Response.json(workoutSessionSummarySchema.parse(session));
    mockLogWorkoutHandler.mockResolvedValue(mockResponse);

    const request = new Request(
      'http://localhost:3000/api/workouts/plan-456/log',
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer test-token',
        },
      }
    );

    const params = Promise.resolve({ id: 'plan-456' });
    const response = await POST(request, { params });

    expect(mockLogWorkoutHandler).toHaveBeenCalledWith(request, 'plan-456');
    expect(response).toBe(mockResponse);
  });

  it('should return 401 when handler returns unauthorized', async () => {
    const mockResponse = Response.json(
      { code: 'UNAUTHORIZED', message: 'Invalid or missing DeviceToken' },
      { status: 401 }
    );
    mockLogWorkoutHandler.mockResolvedValue(mockResponse);

    const request = new Request(
      'http://localhost:3000/api/workouts/plan-123/log',
      {
        method: 'POST',
      }
    );

    const params = { id: 'plan-123' };
    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.code).toBe('UNAUTHORIZED');
  });

  it('should return session summary on success', async () => {
    const session = createSessionSummaryMock({
      id: 'session-789',
      completedAt: '2024-01-15T10:30:00Z',
      source: 'ai',
    });
    const mockResponse = Response.json(workoutSessionSummarySchema.parse(session));
    mockLogWorkoutHandler.mockResolvedValue(mockResponse);

    const request = new Request(
      'http://localhost:3000/api/workouts/plan-789/log',
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer test-token',
        },
      }
    );

    const params = { id: 'plan-789' };
    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.id).toBe('session-789');
    expect(data.source).toBe('ai');
  });
});
