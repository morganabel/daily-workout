import { generateHandler } from '@/lib/wiring';

/**
 * POST /api/workouts/generate
 *
 * Accepts quick-action parameters and generates a workout plan.
 * Returns the generated TodayPlan.
 *
 * Handles BYOK/offline rejection cases.
 */
export async function POST(request: Request) {
  return generateHandler(request);
}
