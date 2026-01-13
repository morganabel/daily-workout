import type { AuthProvider, GenerationStore } from '../types';
import { createErrorResponse } from '../utils/errors';
import {
  workoutLogPayloadSchema,
  workoutSessionSummarySchema,
  createSessionSummaryMock,
  type WorkoutSessionSummary,
} from '@workout-agent/shared';

/**
 * Dependencies for the log-workout handler
 */
export interface LogWorkoutHandlerDeps {
  auth: AuthProvider;
  store: GenerationStore;
}

/**
 * Factory for creating the POST /api/workouts/:id/log handler
 *
 * Marks a workout plan as completed and returns the updated session summary.
 *
 * TODO: Also support quick-log without a plan ID (separate endpoint or query param)
 */
export function createLogWorkoutHandler(deps: LogWorkoutHandlerDeps) {
  return async function logWorkoutHandler(
    request: Request,
    planId: string
  ): Promise<Response> {
    // Authenticate request
    const auth = await deps.auth.authenticate(request);
    if (!auth) {
      return createErrorResponse(
        'UNAUTHORIZED',
        'Invalid or missing session',
        401
      );
    }

    let payload: unknown = {};
    try {
      const text = await request.text();
      if (text.trim()) {
        payload = JSON.parse(text);
      }
    } catch (error) {
      console.error('Failed to parse JSON payload in logWorkoutHandler', error);
      return createErrorResponse(
        'VALIDATION_ERROR',
        'Malformed JSON in request body',
        400
      );
    }

    const parsedPayload = workoutLogPayloadSchema.safeParse(payload);
    if (!parsedPayload.success) {
      return createErrorResponse(
        'VALIDATION_ERROR',
        'Invalid workout log payload',
        400
      );
    }

    // TODO: Verify plan exists and belongs to user
    // const plan = await prisma.workoutPlan.findUnique({ where: { id: planId } });
    // if (!plan) {
    //   return createErrorResponse('NOT_FOUND', 'Workout plan not found', 404);
    // }

    // TODO: Create WorkoutSession in database
    // const session = await prisma.workoutSession.create({
    //   data: {
    //     planId,
    //     userId: auth.userId,
    //     completedAt: new Date(),
    //     // ... other fields
    //   },
    // });

    // For now, return a mock session summary
    const sessionSummary: WorkoutSessionSummary = createSessionSummaryMock({
      id: `session-${planId}-${Date.now()}`,
      completedAt: new Date().toISOString(),
      source: 'ai', // Would come from the plan
    });

    // Use principalId for device-scoped state (GenerationStore)
    await deps.store.clearPlan(auth.principalId);

    // Validate response against schema
    const validated = workoutSessionSummarySchema.parse(sessionSummary);

    // TODO: Return updated recentSessions list (last 3) instead of just the new one
    // For now, return the new session
    return Response.json(validated);
  };
}
