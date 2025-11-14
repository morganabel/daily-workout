/**
 * Tests for useHomeData hook
 */

import { renderHook, waitFor, act } from '@testing-library/react-native';
import { useHomeData } from './useHomeData';
import { fetchHomeSnapshot } from '../services/api';
import { getDeviceToken } from '../storage/deviceToken';
import NetInfo from '@react-native-community/netinfo';
import { createHomeSnapshotMock, createTodayPlanMock, createSessionSummaryMock } from '@workout-agent/shared';

// Mock dependencies
jest.mock('../services/api');
jest.mock('../storage/deviceToken');
jest.mock('@react-native-community/netinfo');

const mockFetchHomeSnapshot = fetchHomeSnapshot as jest.MockedFunction<typeof fetchHomeSnapshot>;
const mockGetDeviceToken = getDeviceToken as jest.MockedFunction<typeof getDeviceToken>;
const mockNetInfo = NetInfo as jest.Mocked<typeof NetInfo>;

describe('useHomeData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default mocks
    mockGetDeviceToken.mockResolvedValue('test-token-123');
    mockNetInfo.fetch = jest.fn().mockResolvedValue({ isConnected: true });
    mockNetInfo.addEventListener = jest.fn().mockReturnValue(() => {});
  });

  it('should fetch data on mount', async () => {
    const mockSnapshot = createHomeSnapshotMock({ plan: null });
    mockFetchHomeSnapshot.mockResolvedValue(mockSnapshot);

    const { result } = renderHook(() => useHomeData());

    expect(result.current.status).toBe('loading');

    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });

    expect(mockFetchHomeSnapshot).toHaveBeenCalledTimes(1);
    expect(result.current.plan).toBeNull();
    expect(result.current.recentSessions).toEqual(mockSnapshot.recentSessions);
    expect(result.current.generationStatus.state).toBe(
      mockSnapshot.generationStatus.state,
    );
  });

  it('should handle offline state when network is disconnected', async () => {
    mockNetInfo.fetch = jest.fn().mockResolvedValue({ isConnected: false });

    const { result } = renderHook(() => useHomeData());

    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });

    expect(result.current.isOffline).toBe(true);
    expect(result.current.offlineHint.offline).toBe(true);
    expect(result.current.offlineHint.requiresApiKey).toBe(false);
    expect(mockFetchHomeSnapshot).not.toHaveBeenCalled();
  });

  it('should handle missing DeviceToken', async () => {
    mockGetDeviceToken.mockResolvedValue(null);

    const { result } = renderHook(() => useHomeData());

    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });

    expect(result.current.isOffline).toBe(true);
    expect(result.current.offlineHint.requiresApiKey).toBe(true);
    expect(result.current.offlineHint.message).toContain('Device token required');
    expect(mockFetchHomeSnapshot).not.toHaveBeenCalled();
  });

  it('should handle API errors', async () => {
    const apiError = { code: 'NETWORK_ERROR', message: 'Failed to fetch' };
    mockFetchHomeSnapshot.mockRejectedValue(apiError);

    const { result } = renderHook(() => useHomeData());

    await waitFor(() => {
      expect(result.current.status).toBe('error');
    });

    expect(result.current.error).toEqual(apiError);
    expect(result.current.isOffline).toBe(true);
  });

  it('should handle BYOK_REQUIRED error', async () => {
    const apiError = { code: 'BYOK_REQUIRED', message: 'API key required' };
    mockFetchHomeSnapshot.mockRejectedValue(apiError);

    const { result } = renderHook(() => useHomeData());

    await waitFor(() => {
      expect(result.current.status).toBe('error');
    });

    expect(result.current.offlineHint.requiresApiKey).toBe(true);
    expect(result.current.offlineHint.message).toBe('API key required');
  });

  it('should update plan optimistically', async () => {
    const mockSnapshot = createHomeSnapshotMock({ plan: null });
    mockFetchHomeSnapshot.mockResolvedValue(mockSnapshot);

    const { result } = renderHook(() => useHomeData());

    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });

    const newPlan = createTodayPlanMock();
    await act(async () => {
      result.current.setPlan(newPlan);
    });

    await waitFor(() => {
      expect(result.current.plan).toEqual(newPlan);
    });
  });

  it('should add session and clear plan', async () => {
    const mockPlan = createTodayPlanMock();
    const mockSnapshot = createHomeSnapshotMock({ plan: mockPlan });
    mockFetchHomeSnapshot.mockResolvedValue(mockSnapshot);

    const { result } = renderHook(() => useHomeData());

    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });

    await waitFor(() => {
      expect(result.current.plan).toEqual(mockPlan);
    });

    const session = createSessionSummaryMock();
    await act(async () => {
      result.current.addSession(session);
    });

    await waitFor(() => {
      expect(result.current.plan).toBeNull();
      expect(result.current.recentSessions).toContainEqual(session);
      expect(result.current.recentSessions.length).toBeLessThanOrEqual(3);
    });
  });

  it('should update staged values for quick actions', async () => {
    const mockSnapshot = createHomeSnapshotMock();
    mockFetchHomeSnapshot.mockResolvedValue(mockSnapshot);

    const { result } = renderHook(() => useHomeData());

    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });

    await act(async () => {
      result.current.updateStagedValue('time', '45');
    });

    await waitFor(() => {
      const timeAction = result.current.quickActions.find((a) => a.key === 'time');
      expect(timeAction?.stagedValue).toBe('45');
    });
  });

  it('should clear staged values when requested', async () => {
    const mockSnapshot = createHomeSnapshotMock();
    mockFetchHomeSnapshot.mockResolvedValue(mockSnapshot);

    const { result } = renderHook(() => useHomeData());

    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });

    await act(async () => {
      result.current.updateStagedValue('focus', 'Lower Body');
    });
    await waitFor(() => {
      const focusAction = result.current.quickActions.find((a) => a.key === 'focus');
      expect(focusAction?.stagedValue).toBe('Lower Body');
    });

    await act(async () => {
      result.current.clearStagedValues();
    });

    await waitFor(() => {
      const focusAction = result.current.quickActions.find((a) => a.key === 'focus');
      expect(focusAction?.stagedValue).toBeNull();
    });
  });

  it('should clear staged values after setting a new plan', async () => {
    const mockSnapshot = createHomeSnapshotMock({ plan: null });
    mockFetchHomeSnapshot.mockResolvedValue(mockSnapshot);

    const { result } = renderHook(() => useHomeData());

    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });

    await act(async () => {
      result.current.updateStagedValue('time', '45');
    });

    await waitFor(() => {
      const timeAction = result.current.quickActions.find((a) => a.key === 'time');
      expect(timeAction?.stagedValue).toBe('45');
    });

    await act(async () => {
      result.current.setPlan(createTodayPlanMock());
    });

    await waitFor(() => {
      const timeAction = result.current.quickActions.find((a) => a.key === 'time');
      expect(timeAction?.stagedValue).toBeNull();
    });
  });

  it('should refetch data when refetch is called', async () => {
    const mockSnapshot = createHomeSnapshotMock();
    mockFetchHomeSnapshot.mockResolvedValue(mockSnapshot);

    const { result } = renderHook(() => useHomeData());

    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });

    expect(mockFetchHomeSnapshot).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.refetch();
    });

    expect(mockFetchHomeSnapshot).toHaveBeenCalledTimes(2);
  });
});
