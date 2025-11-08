/**
 * Tests for API client
 */

import { fetchHomeSnapshot, generateWorkout, logWorkout } from './api';
import { getDeviceToken } from '../storage/deviceToken';
import { createHomeSnapshotMock, createTodayPlanMock, createSessionSummaryMock } from '@workout-agent/shared';

// Mock dependencies
jest.mock('../storage/deviceToken');

const mockGetDeviceToken = getDeviceToken as jest.MockedFunction<typeof getDeviceToken>;

// Mock global fetch
global.fetch = jest.fn();

const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

describe('API client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDeviceToken.mockResolvedValue('test-token-123');
  });

  describe('fetchHomeSnapshot', () => {
    it('should fetch home snapshot successfully', async () => {
      const mockSnapshot = createHomeSnapshotMock();
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockSnapshot,
      } as Response);

      const result = await fetchHomeSnapshot();

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/home/snapshot',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-token-123',
          }),
        })
      );
      expect(result).toEqual(mockSnapshot);
    });

    it('should handle API errors', async () => {
      const errorResponse = { code: 'UNAUTHORIZED', message: 'Invalid token' };
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => errorResponse,
        clone: jest.fn().mockReturnValue({
          text: async () => JSON.stringify(errorResponse),
        }),
      } as unknown as Response);

      await expect(fetchHomeSnapshot()).rejects.toEqual(errorResponse);
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(fetchHomeSnapshot()).rejects.toThrow('Network error');
    });
  });

  describe('generateWorkout', () => {
    it('should generate workout successfully', async () => {
      const mockPlan = createTodayPlanMock();
      const request = {
        timeMinutes: 30,
        focus: 'Full Body',
        equipment: ['Bodyweight'],
        energy: 'moderate' as const,
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockPlan,
      } as Response);

      const result = await generateWorkout(request);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/workouts/generate',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(request),
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-token-123',
          }),
        })
      );
      expect(result).toEqual(mockPlan);
    });

    it('should handle BYOK_REQUIRED error', async () => {
      const errorResponse = { code: 'BYOK_REQUIRED', message: 'API key required' };
      mockFetch.mockResolvedValue({
        ok: false,
        status: 402,
        json: async () => errorResponse,
        clone: jest.fn().mockReturnValue({
          text: async () => JSON.stringify(errorResponse),
        }),
      } as unknown as Response);

      await expect(generateWorkout({})).rejects.toEqual(errorResponse);
    });
  });

  describe('logWorkout', () => {
    it('should log workout successfully', async () => {
      const mockSession = createSessionSummaryMock();
      const planId = 'plan-123';

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockSession,
      } as Response);

      const result = await logWorkout(planId);

      expect(mockFetch).toHaveBeenCalledWith(
        `http://localhost:3000/api/workouts/${planId}/log`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-token-123',
          }),
        })
      );
      expect(result).toEqual(mockSession);
    });

    it('should handle 404 errors', async () => {
      const errorResponse = { code: 'NOT_FOUND', message: 'Plan not found' };
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => errorResponse,
        clone: jest.fn().mockReturnValue({
          text: async () => JSON.stringify(errorResponse),
        }),
      } as unknown as Response);

      await expect(logWorkout('invalid-id')).rejects.toEqual(errorResponse);
    });
  });

  describe('authentication', () => {
    it('should include token in headers when available', async () => {
      mockGetDeviceToken.mockResolvedValue('test-token-123');
      const mockSnapshot = createHomeSnapshotMock();
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockSnapshot,
      } as Response);

      await fetchHomeSnapshot();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token-123',
          }),
        })
      );
    });

    it('should work without token', async () => {
      mockGetDeviceToken.mockResolvedValue(null);
      const mockSnapshot = createHomeSnapshotMock();
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockSnapshot,
      } as Response);

      await fetchHomeSnapshot();

      const callArgs = mockFetch.mock.calls[0];
      const headers = callArgs[1]?.headers as Record<string, string>;
      expect(headers).not.toHaveProperty('Authorization');
    });
  });
});

