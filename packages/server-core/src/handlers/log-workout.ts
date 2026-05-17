import type { AuthProvider, GenerationStore } from '../types';
import { createErrorResponse } from '../utils/errors';
import { attachRequestId, createRequestContext } from '../utils/logging';
import { workoutLogPayloadSchema } from '@workout-agent/shared';

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
    const { requestId, urlPath, startedAt, log } = createRequestContext(
      request,
      'workouts.log'
    );

    // Authenticate request
    const auth = await deps.auth.authenticate(request);
    if (!auth) {
      log.info('request unauthorized', {
        method: request.method,
        path: urlPath,
      });
      const response = createErrorResponse(
        'UNAUTHORIZED',
        'Invalid or missing session',
        401
      );
      attachRequestId(response, requestId);
      return response;
    }

    let payload: unknown = {};
    try {
      const text = await request.text();
      if (text.trim()) {
        payload = JSON.parse(text);
      }
    } catch (error) {
      log.warn('invalid json body', {
        method: request.method,
        path: urlPath,
        error,
      });
      const response = createErrorResponse(
        'VALIDATION_ERROR',
        'Malformed JSON in request body',
        400
      );
      attachRequestId(response, requestId);
      return response;
    }

    const parsedPayload = workoutLogPayloadSchema.safeParse(payload);
    if (!parsedPayload.success) {
      log.warn('request validation failed', {
        method: request.method,
        path: urlPath,
        issues: parsedPayload.error.issues.length,
      });
      const response = createErrorResponse(
        'VALIDATION_ERROR',
        'Invalid workout log payload',
        400
      );
      attachRequestId(response, requestId);
      return response;
    }

    const response = createErrorResponse(
      'NOT_IMPLEMENTED',
      'Workout logging is not implemented on this server yet',
      501
    );
    attachRequestId(response, requestId);
    log.info('request completed', {
      method: request.method,
      path: urlPath,
      status: 501,
      durationMs: Date.now() - startedAt,
      planIdPresent: Boolean(planId),
    });
    return response;
  };
}
