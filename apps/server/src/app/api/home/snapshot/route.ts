import { authenticateRequest } from '@/lib/auth';
import { createErrorResponse } from '@/lib/errors';
import {
  homeSnapshotSchema,
  createHomeSnapshotMock,
  type HomeSnapshot,
  type TodayPlan,
} from '@workout-agent/shared';
import { NextResponse } from 'next/server';
import {
  getGenerationState,
} from '@/lib/generation-store';
import { buildQuickActions } from '@/lib/quick-actions';

/**
 * GET /api/home/snapshot
 *
 * Returns today's plan, quick-action presets, and the last three session summaries.
 * Authenticates via DeviceToken in Authorization header.
 *
 * Falls back to mock data when no plan exists (plan: null).
 */
export async function GET(request: Request) {
  // Authenticate request
  const auth = await authenticateRequest(request);
  if (!auth) {
    return createErrorResponse(
      'UNAUTHORIZED',
      'Invalid or missing DeviceToken',
      401,
    );
  }

  const deviceState = getGenerationState(auth.deviceToken);
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

  return NextResponse.json(validated);
}
