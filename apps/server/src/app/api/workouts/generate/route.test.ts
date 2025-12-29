jest.mock('uuid', () => ({
  v7: jest.fn(() => 'mock-uuid'),
}));

/**
 * Tests for POST /api/workouts/generate route
 */

// Mock the wiring module to prevent SDK initialization
jest.mock('@/lib/wiring');

import { POST } from './route';
import { generateHandler } from '@/lib/wiring';
import { createTodayPlanMock, todayPlanSchema } from '@workout-agent/shared';

const mockGenerateHandler = generateHandler as jest.MockedFunction<typeof generateHandler>;

describe('POST /api/workouts/generate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should delegate to generateHandler', async () => {
    const plan = createTodayPlanMock({
      id: 'plan-123',
      focus: 'Full Body',
      durationMinutes: 30,
    });
    const mockResponse = Response.json(todayPlanSchema.parse(plan));
    mockGenerateHandler.mockResolvedValue(mockResponse);

    const requestBody = {
      timeMinutes: 30,
      focus: 'Full Body',
      equipment: ['Bodyweight'],
      energy: 'moderate' as const,
    };

    const request = new Request('http://localhost:3000/api/workouts/generate', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const response = await POST(request);

    expect(mockGenerateHandler).toHaveBeenCalledWith(request);
    expect(response).toBe(mockResponse);
  });

  it('should return 401 when handler returns unauthorized', async () => {
    const mockResponse = Response.json(
      { code: 'UNAUTHORIZED', message: 'Invalid or missing DeviceToken' },
      { status: 401 }
    );
    mockGenerateHandler.mockResolvedValue(mockResponse);

    const request = new Request('http://localhost:3000/api/workouts/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        timeMinutes: 30,
        focus: 'Full Body',
        equipment: ['Bodyweight'],
        energy: 'moderate',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.code).toBe('UNAUTHORIZED');
  });

  it('should return validation error for invalid request', async () => {
    const mockResponse = Response.json(
      { code: 'VALIDATION_ERROR', message: 'Invalid request' },
      { status: 400 }
    );
    mockGenerateHandler.mockResolvedValue(mockResponse);

    const request = new Request('http://localhost:3000/api/workouts/generate', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ invalid: 'data' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe('VALIDATION_ERROR');
  });

  it('should return generated plan', async () => {
    const plan = createTodayPlanMock({
      id: 'plan-456',
      focus: 'Upper Body',
      durationMinutes: 45,
      equipment: ['Dumbbells'],
    });
    const mockResponse = Response.json(todayPlanSchema.parse(plan));
    mockGenerateHandler.mockResolvedValue(mockResponse);

    const request = new Request('http://localhost:3000/api/workouts/generate', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        timeMinutes: 45,
        focus: 'Upper Body',
        equipment: ['Dumbbells'],
        energy: 'high',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.id).toBe('plan-456');
    expect(data.focus).toBe('Upper Body');
  });
});
