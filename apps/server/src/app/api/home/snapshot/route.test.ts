/**
 * Tests for GET /api/home/snapshot route
 */

import { GET } from './route';
import { authenticateRequest } from '@/lib/auth';
import { createHomeSnapshotMock } from '@workout-agent/shared';

// Mock dependencies
jest.mock('@/lib/auth');

const mockAuthenticateRequest = authenticateRequest as jest.MockedFunction<typeof authenticateRequest>;

describe('GET /api/home/snapshot', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return snapshot when authenticated', async () => {
    mockAuthenticateRequest.mockResolvedValue({
      userId: 'user-123',
      deviceToken: 'test-token',
    });

    const request = new Request('http://localhost:3000/api/home/snapshot', {
      method: 'GET',
      headers: {
        Authorization: 'Bearer test-token',
      },
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('plan');
    expect(data).toHaveProperty('quickActions');
    expect(data).toHaveProperty('recentSessions');
    expect(data).toHaveProperty('offlineHint');
    expect(Array.isArray(data.quickActions)).toBe(true);
    expect(data.quickActions.length).toBe(5);
  });

  it('should return 401 when not authenticated', async () => {
    mockAuthenticateRequest.mockResolvedValue(null);

    const request = new Request('http://localhost:3000/api/home/snapshot', {
      method: 'GET',
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.code).toBe('UNAUTHORIZED');
    expect(data.message).toContain('DeviceToken');
  });

  it('should return snapshot with null plan when no plan exists', async () => {
    mockAuthenticateRequest.mockResolvedValue({
      userId: 'user-123',
      deviceToken: 'test-token',
    });

    const request = new Request('http://localhost:3000/api/home/snapshot', {
      method: 'GET',
      headers: {
        Authorization: 'Bearer test-token',
      },
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.plan).toBeNull();
  });

  it('should validate response against schema', async () => {
    mockAuthenticateRequest.mockResolvedValue({
      userId: 'user-123',
      deviceToken: 'test-token',
    });

    const request = new Request('http://localhost:3000/api/home/snapshot', {
      method: 'GET',
      headers: {
        Authorization: 'Bearer test-token',
      },
    });

    const response = await GET(request);
    const data = await response.json();

    // Should not throw - schema validation happens in route handler
    expect(data).toMatchObject({
      plan: expect.anything(),
      quickActions: expect.any(Array),
      recentSessions: expect.any(Array),
      offlineHint: expect.objectContaining({
        offline: expect.any(Boolean),
        requiresApiKey: expect.any(Boolean),
      }),
    });
  });
});

