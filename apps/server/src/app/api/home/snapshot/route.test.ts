/**
 * Tests for GET /api/home/snapshot route
 */

import {
  createTodayPlanMock,
  createHomeSnapshotMock,
  homeSnapshotSchema,
} from '@workout-agent/shared';

// Mock the wiring module to prevent SDK initialization
jest.mock('@/lib/wiring');

import { GET } from './route';
import { snapshotHandler } from '@/lib/wiring';

const mockSnapshotHandler = snapshotHandler as jest.MockedFunction<typeof snapshotHandler>;

describe('GET /api/home/snapshot', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should delegate to snapshotHandler', async () => {
    const snapshot = createHomeSnapshotMock({ plan: null });
    const mockResponse = Response.json(homeSnapshotSchema.parse(snapshot));
    mockSnapshotHandler.mockResolvedValue(mockResponse);

    const request = new Request('http://localhost:3000/api/home/snapshot', {
      method: 'GET',
      headers: {
        Authorization: 'Bearer test-token',
      },
    });

    const response = await GET(request);

    expect(mockSnapshotHandler).toHaveBeenCalledWith(request);
    expect(response).toBe(mockResponse);
  });

  it('should return 401 when handler returns unauthorized', async () => {
    const mockResponse = Response.json(
      { code: 'UNAUTHORIZED', message: 'Invalid or missing DeviceToken' },
      { status: 401 }
    );
    mockSnapshotHandler.mockResolvedValue(mockResponse);

    const request = new Request('http://localhost:3000/api/home/snapshot', {
      method: 'GET',
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.code).toBe('UNAUTHORIZED');
  });

  it('should return snapshot with plan when handler provides it', async () => {
    const plan = createTodayPlanMock({
      id: 'plan-123',
      focus: 'Lower Body',
      durationMinutes: 40,
    });

    const snapshot = createHomeSnapshotMock({ plan });
    const mockResponse = Response.json(homeSnapshotSchema.parse(snapshot));
    mockSnapshotHandler.mockResolvedValue(mockResponse);

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
  });
});
