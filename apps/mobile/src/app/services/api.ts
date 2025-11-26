/**
 * API client for workout agent backend
 */

import type {
  HomeSnapshot,
  TodayPlan,
  GenerationRequest,
  WorkoutSessionSummary,
  GenerationContext,
  UserPreferences,
} from '@workout-agent/shared';
import { getDeviceToken } from '../storage/deviceToken';
import { getByokApiKey } from '../storage/byokKey';
import { userRepository } from '../db/repositories/UserRepository';
import { workoutRepository } from '../db/repositories/WorkoutRepository';
import Workout from '../db/models/Workout';

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
  const byokKey = await getByokApiKey();
  const url = `${API_BASE_URL}${endpoint}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (byokKey) {
    headers['x-openai-key'] = byokKey;
  }

  console.log(`[API] ${options.method || 'GET'} ${url}`, {
    hasToken: !!token,
    hasByokKey: !!byokKey,
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
 * Build a GenerationContext from user preferences and recent workout history.
 * This replaces the mock context with real user data.
 */
async function buildGenerationContext(
  request: GenerationRequest,
): Promise<GenerationContext> {
  // Get user preferences from local DB
  const prefs: UserPreferences = await userRepository.getPreferences();

  // Get recent completed sessions (last 5)
  const recentWorkouts = await new Promise<Workout[]>((resolve) => {
    let subscription: { unsubscribe: () => void } | null = null;
    let resolved = false;

    subscription = workoutRepository.observeRecentSessions(5).subscribe((workouts) => {
      if (resolved) return;
      resolved = true;
      // Defer unsubscribe to avoid race condition if observable emits synchronously
      setTimeout(() => subscription?.unsubscribe(), 0);
      resolve(workouts);
    });
  });

  const recentSessions = recentWorkouts.map((w) => workoutRepository.toSessionSummary(w));

  // Determine equipment: quick action override > profile default > fallback
  const equipment = request.equipment ?? prefs.equipment ?? [];
  const effectiveEquipment = equipment.length > 0 ? equipment : ['Bodyweight'];

  // Build the context
  const context: GenerationContext = {
    userProfile: {
      experienceLevel: prefs.experienceLevel,
      primaryGoal: prefs.primaryGoal,
      energyToday: request.energy,
      preferredStyle: prefs.preferredStyle,
    },
    preferences: {
      focusBias: prefs.focusBias?.slice(0, 3),
      avoid: prefs.avoid?.slice(0, 5),
      injuries: prefs.injuries?.slice(0, 3),
    },
    environment: {
      equipment: effectiveEquipment,
      timeAvailableMinutes: request.timeMinutes,
    },
    recentSessions,
    notes: request.notes,
  };

  return context;
}

/**
 * Generate a workout plan
 */
export async function generateWorkout(
  request: GenerationRequest,
): Promise<TodayPlan> {
  // Build real context from user preferences and history
  const context = await buildGenerationContext(request);

  console.log('[API] Generation context:', JSON.stringify(context, null, 2));

  const enrichedRequest = {
    ...request,
    context,
  };

  const plan = await apiRequest<TodayPlan>('/api/workouts/generate', {
    method: 'POST',
    body: JSON.stringify(enrichedRequest),
  });

  await workoutRepository.saveGeneratedPlan(plan);
  return plan;
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
