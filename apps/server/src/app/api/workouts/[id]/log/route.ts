import { logWorkoutHandler } from '@/lib/wiring';

/**
 * POST /api/workouts/:id/log
 *
 * Marks a workout plan as completed and returns the updated session summary.
 *
 * TODO: Also support quick-log without a plan ID (separate endpoint or query param)
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
): Promise<Response> {
  // Handle both Promise and direct params (Next.js version compatibility)
  const resolvedParams = 'then' in params ? await params : params;
  const planId = resolvedParams.id;

  return logWorkoutHandler(request, planId);
}
