/**
 * API client for workout agent backend
 */

import type {
  HomeSnapshot,
  TodayPlan,
  GenerationRequest,
  WorkoutSessionSummary,
} from '@workout-agent/shared';
import { getDeviceToken } from '../storage/deviceToken';

const API_BASE_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:3000';

export interface ApiError {
  code: string;
  message: string;
  retryAfter?: number;
}

/**
 * Make authenticated API request
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const token = await getDeviceToken();
  const url = `${API_BASE_URL}${endpoint}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  console.log(`[API] ${options.method || 'GET'} ${url}`, {
    hasToken: !!token,
    body: options.body,
  });

  const response = await fetch(url, {
    ...options,
    headers,
  });

  console.log(`[API] Response: ${response.status} ${response.statusText}`);

  if (!response.ok) {
    let error: ApiError;
    // Clone the response so we can read it multiple times if needed
    const responseClone = response.clone();
    try {
      error = await response.json();
      console.error('[API] Error response:', error);
    } catch {
      // If JSON parsing fails, try reading as text from the clone
      try {
        const text = await responseClone.text();
        console.error('[API] Error response (not JSON):', text);
      } catch (textError) {
        console.error('[API] Failed to read error response:', textError);
      }
      error = {
        code: 'NETWORK_ERROR',
        message: `HTTP ${response.status}: ${response.statusText}`,
      };
    }
    throw error;
  }

  const data = await response.json();
  console.log('[API] Success:', data);
  return data;
}

/**
 * Fetch home snapshot
 */
export async function fetchHomeSnapshot(): Promise<HomeSnapshot> {
  return apiRequest<HomeSnapshot>('/api/home/snapshot', {
    method: 'GET',
  });
}

/**
 * Generate a workout plan
 */
export async function generateWorkout(
  request: GenerationRequest,
): Promise<TodayPlan> {
  return apiRequest<TodayPlan>('/api/workouts/generate', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

/**
 * Log a workout completion
 */
export async function logWorkout(
  planId: string,
): Promise<WorkoutSessionSummary> {
  return apiRequest<WorkoutSessionSummary>(`/api/workouts/${planId}/log`, {
    method: 'POST',
  });
}

