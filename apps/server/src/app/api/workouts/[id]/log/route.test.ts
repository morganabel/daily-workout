/**
 * Tests for POST /api/workouts/:id/log route
 */

import { POST } from './route';
import { authenticateRequest } from '@/lib/auth';
import { createSessionSummaryMock } from '@workout-agent/shared';

// Mock dependencies
jest.mock('@/lib/auth');

const mockAuthenticateRequest = authenticateRequest as jest.MockedFunction<typeof authenticateRequest>;

describe('POST /api/workouts/:id/log', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should log workout successfully', async () => {
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
    });

    const params = Promise.resolve({ id: planId });
    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('id');
    expect(data).toHaveProperty('completedAt');
    expect(data).toHaveProperty('focus');
    expect(data).toHaveProperty('source');
    expect(data.id).toContain(planId);
  });

  it('should return 401 when not authenticated', async () => {
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

  it('should handle different plan IDs', async () => {
    mockAuthenticateRequest.mockResolvedValue({
      userId: 'user-123',
      deviceToken: 'test-token',
    });

    const planId1 = 'plan-abc';
    const request1 = new Request(`http://localhost:3000/api/workouts/${planId1}/log`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test-token',
      },
    });

    const params1 = Promise.resolve({ id: planId1 });
    const response1 = await POST(request1, { params: params1 });
    const data1 = await response.json();

    expect(response1.status).toBe(200);
    expect(data1.id).toContain(planId1);

    const planId2 = 'plan-xyz';
    const request2 = new Request(`http://localhost:3000/api/workouts/${planId2}/log`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test-token',
      },
    });

    const params2 = Promise.resolve({ id: planId2 });
    const response2 = await POST(request2, { params: params2 });
    const data2 = await response.json();

    expect(response2.status).toBe(200);
    expect(data2.id).toContain(planId2);
    expect(data1.id).not.toBe(data2.id);
  });

  it('should validate response against schema', async () => {
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
    });

    const params = Promise.resolve({ id: planId });
    const response = await POST(request, { params });
    const data = await response.json();

    // Should not throw - schema validation happens in route handler
    expect(data).toMatchObject({
      id: expect.any(String),
      completedAt: expect.any(String),
      focus: expect.any(String),
      source: expect.any(String),
    });
  });

  it('should handle direct params (non-Promise) for compatibility', async () => {
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
    });

    // Test with direct params object (not Promise)
    const params = { id: planId };
    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.id).toContain(planId);
  });
});

