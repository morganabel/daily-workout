import type { AuthProvider, GenerationStore } from '../types';
import { createErrorResponse } from '../utils/errors';
import { buildQuickActions } from '../utils/quick-actions';
import { attachRequestId, createLogger, getOrCreateRequestId } from '../utils/logging';
import {
  homeSnapshotSchema,
  createHomeSnapshotMock,
  type HomeSnapshot,
  type TodayPlan,
} from '@workout-agent/shared';

/**
 * Dependencies for the snapshot handler
 */
export interface SnapshotHandlerDeps {
  auth: AuthProvider;
  store: GenerationStore;
}

/**
 * Factory for creating the GET /api/home/snapshot handler
 *
 * Returns today's plan, quick-action presets, and generation status.
 * Falls back to mock data when no plan exists (plan: null).
 */
export function createSnapshotHandler(deps: SnapshotHandlerDeps) {
  return async function snapshotHandler(request: Request): Promise<Response> {
    const requestId = getOrCreateRequestId(request);
    const urlPath = (() => {
      try {
        return new URL(request.url).pathname;
      } catch {
        return 'unknown';
      }
    })();
    const startedAt = Date.now();
    const log = createLogger({ route: 'home.snapshot', requestId });

    // Authenticate request
    const auth = await deps.auth.authenticate(request);
    if (!auth) {
      log.info('request unauthorized', { method: request.method, path: urlPath });
      const response = createErrorResponse(
        'UNAUTHORIZED',
        'Invalid or missing session',
        401
      );
      attachRequestId(response, requestId);
      return response;
    }

    // Use principalId for device-scoped state (GenerationStore)
    const deviceState = await deps.store.getState(auth.principalId);
    const storedPlan: TodayPlan | null = deviceState.plan;

    const baseSnapshot = createHomeSnapshotMock({
      plan: storedPlan ?? null,
      recentSessions: [], // TODO: Replace with real history when persistence is added
    });

    const snapshot: HomeSnapshot = {
      ...baseSnapshot,
      plan: storedPlan,
      quickActions: buildQuickActions(storedPlan),
      generationStatus: deviceState.generationStatus,
    };

    // Validate response against schema
    const validated = homeSnapshotSchema.parse(snapshot);

    const response = Response.json(validated);
    attachRequestId(response, requestId);
    log.info('request completed', {
      method: request.method,
      path: urlPath,
      status: 200,
      durationMs: Date.now() - startedAt,
      hasPlan: Boolean(storedPlan),
      generationStatus: deviceState.generationStatus?.state ?? null,
    });
    return response;
  };
}
