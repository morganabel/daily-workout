import { authenticateRequest } from '@/lib/auth';
import {
  homeSnapshotSchema,
  createHomeSnapshotMock,
  type HomeSnapshot,
} from '@workout-agent/shared';
import { NextResponse } from 'next/server';

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
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: 'Invalid or missing DeviceToken' },
      { status: 401 },
    );
  }

  // TODO: Replace with actual database queries when Prisma is set up
  // For now, return mock data with plan: null to simulate empty state
  const snapshot: HomeSnapshot = createHomeSnapshotMock({
    plan: null, // No plan exists yet
    recentSessions: [], // Empty history
  });

  // Validate response against schema
  const validated = homeSnapshotSchema.parse(snapshot);

  return NextResponse.json(validated);
}

