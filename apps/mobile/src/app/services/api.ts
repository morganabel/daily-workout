/**
 * API client for workout agent backend
 */

import type {
  TodayPlan,
  GenerationRequest,
  GenerationRequestPayload,
  WorkoutSessionSummary,
  WorkoutLogPayload,
  GenerationContext,
  UserPreferences,
} from '@workout-agent/shared';
import { normalizeEquipmentSelection } from '@workout-agent/shared';
import { getDeviceToken } from '../storage/deviceToken';
import { getByokApiKey, getByokConfig } from '../storage/byokKey';
import { userRepository } from '../db/repositories/UserRepository';
import { workoutRepository } from '../db/repositories/WorkoutRepository';
import { plannedEventRepository } from '../db/repositories/PlannedEventRepository';
import { formatLocalDate, getLocalDateFromTimestamp } from '../utils/date';
import {
  setDebugLastGenerationTrace,
  type DebugGenerationTrace,
} from '../debug/debugState';
import {
  getSessionCookie,
  getSessionToken,
  isAuthEnabled,
} from './auth-client';

const API_BASE_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:3000';

export interface ApiError {
  code: string;
  message: string;
  retryAfter?: number;
}

/**
 * Get the authentication headers for API requests.
 *
 * Priority:
 * 1. Better Auth cookies (preferred; matches Better Auth Expo docs)
 * 2. Better Auth bearer token (fallback for edge cases / older clients)
 * 3. Legacy device token (only for stub auth mode servers)
 *
 * On Better Auth servers without a valid session, returns null.
 * Callers should handle this by triggering the sign-in flow.
 */
async function getAuthHeaders(): Promise<{
  headers: Record<string, string>;
  credentials?: 'omit' | 'include' | 'same-origin';
}> {
  // Prefer cookies (Better Auth default session transport).
  const cookie = getSessionCookie();
  if (cookie) {
    return {
      headers: {
        Cookie: cookie,
      },
      // 'include' can interfere with cookies we set manually in headers.
      credentials: 'omit',
    };
  }

  // Fallback: bearer token (works when server has bearer plugin enabled).
  const sessionToken = await getSessionToken();
  if (sessionToken) {
    return {
      headers: {
        Authorization: `Bearer ${sessionToken}`,
      },
    };
  }

  // Check if server uses Better Auth
  const authEnabled = await isAuthEnabled();
  if (authEnabled) {
    // On Better Auth servers, don't send stub device tokens - they'll be rejected.
    // Return no auth headers so the caller can trigger the sign-in flow.
    return { headers: {} };
  }

  // Only fall back to device token for stub auth mode servers
  const deviceToken = await getDeviceToken();
  if (!deviceToken) {
    return { headers: {} };
  }
  return {
    headers: {
      Authorization: `Bearer ${deviceToken}`,
    },
  };
}

/**
 * Make authenticated API request
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const auth = await getAuthHeaders();
  const byokConfig = await getByokConfig();
  const url = `${API_BASE_URL}${endpoint}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
    ...auth.headers,
  };

  // Add BYOK headers based on provider
  if (byokConfig) {
    headers['x-ai-provider'] = byokConfig.provider;
    // Use provider-specific header for backward compatibility, or generic x-ai-key
    if (byokConfig.provider === 'openai') {
      headers['x-openai-key'] = byokConfig.apiKey;
    } else if (byokConfig.provider === 'gemini') {
      headers['x-gemini-key'] = byokConfig.apiKey;
    }
    // Also send generic header
    headers['x-ai-key'] = byokConfig.apiKey;
  } else {
    // Legacy: check for old format
    const byokKey = await getByokApiKey();
    if (byokKey) {
      headers['x-openai-key'] = byokKey;
    }
  }

  const requestInit: RequestInit = { ...options, headers };
  if (auth.credentials) {
    requestInit.credentials = auth.credentials;
  }

  const response = await fetch(url, requestInit);

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
 * Build a GenerationContext from user preferences and recent workout history.
 * This replaces the mock context with real user data.
 */
export async function buildGenerationContext(
  request: GenerationRequest
): Promise<GenerationContext> {
  // Get user preferences from local DB
  const prefs: UserPreferences = await userRepository.getPreferences();

  // Get recent completed sessions (last 5), excluding archived
  const recentWorkouts = await workoutRepository.listRecentSessions(5, {
    includeArchived: false,
  });
  const recentSessions = recentWorkouts.map((w) =>
    workoutRepository.toSessionSummary(w)
  );

  // Determine equipment: quick action override > profile default > fallback
  const equipment = request.equipment ?? prefs.equipment ?? [];
  const effectiveEquipment = normalizeEquipmentSelection(equipment, [
    'Bodyweight',
  ]);

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

const sanitizeGenerationRequestForTrace = (
  request: GenerationRequest
): Record<string, unknown> => {
  return { ...request };
};

const getErrorCode = (error: unknown): string | undefined => {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' ? code : undefined;
  }
  return undefined;
};

const getErrorMessage = (error: unknown): string => {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    return typeof message === 'string' ? message : 'Unknown generation error';
  }
  return error instanceof Error ? error.message : String(error);
};

/**
 * Generate a workout plan.
 *
 * Builds full context from user preferences and history for both initial
 * generation and regeneration so provider continuity remains optional.
 */
export async function generateWorkout(
  request: GenerationRequest,
  options?: { scheduledDate?: number }
): Promise<TodayPlan> {
  const planningDateLocal =
    request.planningDateLocal ??
    (options?.scheduledDate
      ? getLocalDateFromTimestamp(options.scheduledDate)
      : formatLocalDate(new Date()));
  const upcomingEvents =
    request.upcomingEvents ??
    (await plannedEventRepository.listUpcomingEventContext({
      startLocalDate: planningDateLocal,
    }));

  const requestWithEvents = upcomingEvents?.length
    ? { ...request, upcomingEvents }
    : request;
  const requestWithPlanningDate = { ...requestWithEvents, planningDateLocal };

  const isRegeneration = Boolean(requestWithPlanningDate.previousResponseId);
  const context = await buildGenerationContext(requestWithPlanningDate);
  const enrichedRequest: GenerationRequestPayload = {
    ...requestWithPlanningDate,
    context,
  };

  console.log(
    isRegeneration
      ? '[API] Regeneration request:'
      : '[API] Generation request:',
    {
      previousResponseId: requestWithPlanningDate.previousResponseId,
      planningDateLocal,
      hasBaselineWorkout: Boolean(requestWithPlanningDate.baselineWorkout),
      hasContext: true,
      feedback: requestWithPlanningDate.feedback,
      timeMinutes: requestWithPlanningDate.timeMinutes,
      focus: requestWithPlanningDate.focus,
      equipmentOverride: requestWithPlanningDate.equipment,
      effectiveEquipment: context.environment.equipment,
      energy: requestWithPlanningDate.energy,
      upcomingEvents: requestWithPlanningDate.upcomingEvents?.length ?? 0,
    }
  );

  const startedAt = Date.now();
  const byokConfig = await getByokConfig();
  const traceBase: Omit<
    DebugGenerationTrace,
    'completedAt' | 'durationMs' | 'status' | 'result' | 'error'
  > = {
    id: `generation-${startedAt}`,
    startedAt: new Date(startedAt).toISOString(),
    operation: isRegeneration ? 'regenerate' : 'generate',
    provider: byokConfig?.provider,
    request: sanitizeGenerationRequestForTrace(requestWithPlanningDate),
    scheduledDate: options?.scheduledDate,
    contextSummary: {
      equipment: context.environment.equipment,
      recentSessionCount: context.recentSessions.length,
      upcomingEventCount: requestWithPlanningDate.upcomingEvents?.length ?? 0,
      hasNotes: Boolean(context.notes || requestWithPlanningDate.notes),
    },
  };

  try {
    const plan = await apiRequest<TodayPlan>('/api/workouts/generate', {
      method: 'POST',
      body: JSON.stringify(enrichedRequest),
    });

    await workoutRepository.saveGeneratedPlan(plan, {
      scheduledDate: options?.scheduledDate,
      baselineWorkoutId: requestWithPlanningDate.baselineWorkout?.id,
      generationRequest: requestWithPlanningDate,
    });
    const savedWorkout = await workoutRepository.getWorkoutByPlanId(plan.id);
    setDebugLastGenerationTrace({
      ...traceBase,
      status: 'success',
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      result: {
        planId: plan.id,
        savedWorkoutId: savedWorkout?.id,
        responseId: plan.responseId ?? plan.generationProvenance?.responseId,
        source: plan.source,
      },
    });

    void Promise.resolve(
      workoutRepository.pruneRejectedWorkoutVersions()
    ).catch((error) => {
      console.error('Failed to prune rejected workout versions', error);
    });
    return plan;
  } catch (error) {
    setDebugLastGenerationTrace({
      ...traceBase,
      status: 'error',
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      error: {
        code: getErrorCode(error),
        message: getErrorMessage(error),
      },
    });
    throw error;
  }
}

/**
 * Log a workout completion
 */
export async function logWorkout(
  planId: string,
  payload?: WorkoutLogPayload
): Promise<WorkoutSessionSummary> {
  return apiRequest<WorkoutSessionSummary>(`/api/workouts/${planId}/log`, {
    method: 'POST',
    body: payload ? JSON.stringify(payload) : undefined,
  });
}

/**
 * Archive (soft delete) a workout session locally so it no longer appears in recency-based contexts.
 */
export async function archiveWorkoutSession(workoutId: string): Promise<void> {
  await workoutRepository.archiveWorkoutById(workoutId);
}

/**
 * Unarchive a previously archived workout session.
 */
export async function unarchiveWorkoutSession(
  workoutId: string
): Promise<void> {
  await workoutRepository.unarchiveWorkoutById(workoutId);
}

/**
 * Toggle the favorite status of a workout session locally.
 */
export async function toggleFavoriteWorkout(workoutId: string): Promise<void> {
  await workoutRepository.toggleFavoriteWorkout(workoutId);
}

/**
 * Permanently delete a workout session and its related exercises/sets locally.
 */
export async function deleteWorkoutSession(workoutId: string): Promise<void> {
  await workoutRepository.deleteWorkoutById(workoutId);
}

/**
 * Quick log a manual workout session.
 * Creates a completed workout with source='manual' in the local database.
 * This is a local-first operation; future server sync can be layered on.
 */
export async function quickLogWorkout(params: {
  name: string;
  focus: string;
  durationMinutes: number;
  completedAt?: number;
  note?: string;
}): Promise<WorkoutSessionSummary> {
  const workout = await workoutRepository.quickLogManualSession(params);
  return workoutRepository.toSessionSummary(workout);
}
