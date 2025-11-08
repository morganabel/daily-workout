/**
 * Tests for POST /api/workouts/generate route
 */

import { POST } from './route';
import { authenticateRequest } from '@/lib/auth';
import { createTodayPlanMock } from '@workout-agent/shared';

// Mock dependencies
jest.mock('@/lib/auth');

const mockAuthenticateRequest = authenticateRequest as jest.MockedFunction<typeof authenticateRequest>;

describe('POST /api/workouts/generate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset environment variables
    delete process.env.EDITION;
    delete process.env.OPENAI_API_KEY;
  });

  it('should generate workout plan when authenticated', async () => {
    mockAuthenticateRequest.mockResolvedValue({
      userId: 'user-123',
      deviceToken: 'test-token',
    });

    const requestBody = {
      timeMinutes: 30,
      focus: 'Full Body',
      equipment: ['Bodyweight'],
      energy: 'moderate' as const,
    };

    const request = new Request('http://localhost:3000/api/workouts/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-token',
      },
      body: JSON.stringify(requestBody),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('id');
    expect(data).toHaveProperty('focus');
    expect(data).toHaveProperty('durationMinutes');
    expect(data).toHaveProperty('equipment');
    expect(data).toHaveProperty('blocks');
    expect(data.focus).toBe('Full Body');
    expect(data.durationMinutes).toBe(30);
  });

  it('should return 401 when not authenticated', async () => {
    mockAuthenticateRequest.mockResolvedValue(null);

    const request = new Request('http://localhost:3000/api/workouts/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.code).toBe('UNAUTHORIZED');
  });

  it('should return 400 for invalid request body', async () => {
    mockAuthenticateRequest.mockResolvedValue({
      userId: 'user-123',
      deviceToken: 'test-token',
    });

    const request = new Request('http://localhost:3000/api/workouts/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-token',
      },
      body: JSON.stringify({ invalid: 'data' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe('VALIDATION_ERROR');
  });

  it('should return BYOK_REQUIRED when in hosted mode without API key', async () => {
    process.env.EDITION = 'HOSTED';
    delete process.env.OPENAI_API_KEY;

    mockAuthenticateRequest.mockResolvedValue({
      userId: 'user-123',
      deviceToken: 'test-token',
    });

    const requestBody = {
      timeMinutes: 30,
      focus: 'Full Body',
      equipment: ['Bodyweight'],
      energy: 'moderate' as const,
    };

    const request = new Request('http://localhost:3000/api/workouts/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-token',
      },
      body: JSON.stringify(requestBody),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(402);
    expect(data.code).toBe('BYOK_REQUIRED');
    expect(data.message).toContain('API key');
  });

  it('should accept optional fields', async () => {
    mockAuthenticateRequest.mockResolvedValue({
      userId: 'user-123',
      deviceToken: 'test-token',
    });

    const requestBody = {
      timeMinutes: 45,
    };

    const request = new Request('http://localhost:3000/api/workouts/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-token',
      },
      body: JSON.stringify(requestBody),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.durationMinutes).toBe(45);
  });

  it('should handle invalid JSON gracefully', async () => {
    mockAuthenticateRequest.mockResolvedValue({
      userId: 'user-123',
      deviceToken: 'test-token',
    });

    const request = new Request('http://localhost:3000/api/workouts/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-token',
      },
      body: 'invalid json',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe('VALIDATION_ERROR');
  });
});

