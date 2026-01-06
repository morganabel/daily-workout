import { snapshotHandler } from '@/lib/wiring';

/**
 * GET /api/home/snapshot
 *
 * Returns today's plan, quick-action presets, and the last three session summaries.
 * Authenticates via the configured AuthProvider (Better Auth session or stub bearer token).
 *
 * Falls back to mock data when no plan exists (plan: null).
 */
export async function GET(request: Request) {
  return snapshotHandler(request);
}
