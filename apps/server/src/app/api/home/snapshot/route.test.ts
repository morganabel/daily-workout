/**
 * Tests for GET /api/home/snapshot route
 */

import { GET } from './route';
import { authenticateRequest } from '@/lib/auth';
import {
  createTodayPlanMock,
} from '@workout-agent/shared';
import {
  persistGeneratedPlan,
  resetGenerationStore,
  markGenerationPending,
} from '@/lib/generation-store';

// Mock dependencies
jest.mock('@/lib/auth');

const mockAuthenticateRequest = authenticateRequest as jest.MockedFunction<typeof authenticateRequest>;

describe('GET /api/home/snapshot', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetGenerationStore();
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
    expect(data).toHaveProperty('generationStatus');
    expect(data.generationStatus.state).toBe('idle');
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

  it('should include persisted plan when available', async () => {
    mockAuthenticateRequest.mockResolvedValue({
      userId: 'user-123',
      deviceToken: 'test-token',
    });

    const storedPlan = createTodayPlanMock({
      id: 'plan-123',
      focus: 'Lower Body',
      durationMinutes: 40,
      equipment: ['Dumbbells', 'Bands'],
    });
    persistGeneratedPlan('test-token', storedPlan);

    const request = new Request('http://localhost:3000/api/home/snapshot', {
      method: 'GET',
      headers: {
        Authorization: 'Bearer test-token',
      },
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.plan).not.toBeNull();
    expect(data.plan.id).toBe('plan-123');
    expect(data.quickActions[0].value).toBe('40');
    expect(data.quickActions[1].value).toBe('Lower Body');
  });

  it('should surface pending status when generation is in progress', async () => {
    mockAuthenticateRequest.mockResolvedValue({
      userId: 'user-123',
      deviceToken: 'test-token',
    });
    markGenerationPending('test-token', 25);

    const request = new Request('http://localhost:3000/api/home/snapshot', {
      method: 'GET',
      headers: {
        Authorization: 'Bearer test-token',
      },
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.generationStatus.state).toBe('pending');
    expect(data.generationStatus.etaSeconds).toBe(25);
  });
});
