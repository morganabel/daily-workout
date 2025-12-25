import { snapshotHandler } from '@/lib/wiring';

/**
 * GET /api/home/snapshot
 *
 * Returns today's plan, quick-action presets, and the last three session summaries.
 * Authenticates via DeviceToken in Authorization header.
 *
 * Falls back to mock data when no plan exists (plan: null).
 */
export async function GET(request: Request) {
  return snapshotHandler(request);
}
