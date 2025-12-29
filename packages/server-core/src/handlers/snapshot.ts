import type { AuthProvider, GenerationStore } from '../types';
import { createErrorResponse } from '../utils/errors';
import { buildQuickActions } from '../utils/quick-actions';
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
    // Authenticate request
    const auth = await deps.auth.authenticate(request);
    if (!auth) {
      return createErrorResponse(
        'UNAUTHORIZED',
        'Invalid or missing DeviceToken',
        401
      );
    }

    const deviceState = await deps.store.getState(auth.deviceToken);
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

    return Response.json(validated);
  };
}
