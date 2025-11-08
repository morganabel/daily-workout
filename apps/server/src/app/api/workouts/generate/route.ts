import { authenticateRequest } from '@/lib/auth';
import { createErrorResponse } from '@/lib/errors';
import {
  generationRequestSchema,
  todayPlanSchema,
  createTodayPlanMock,
  type TodayPlan,
  type GenerationRequest,
} from '@workout-agent/shared';
import { NextResponse } from 'next/server';

/**
 * POST /api/workouts/generate
 * 
 * Accepts quick-action parameters and generates a workout plan.
 * Returns the generated TodayPlan.
 * 
 * Handles BYOK/offline rejection cases.
 */
export async function POST(request: Request) {
  // Authenticate request
  const auth = await authenticateRequest(request);
  if (!auth) {
    return createErrorResponse(
      'UNAUTHORIZED',
      'Invalid or missing DeviceToken',
      401,
    );
  }

  // Parse and validate request body
  let body: unknown;
  try {
    body = await request.json();
  } catch (error) {
    return createErrorResponse(
      'VALIDATION_ERROR',
      'Invalid JSON in request body',
    );
  }

  const parseResult = generationRequestSchema.safeParse(body);
  if (!parseResult.success) {
    return createErrorResponse(
      'VALIDATION_ERROR',
      `Invalid request: ${parseResult.error.message}`,
    );
  }

  const generationRequest: GenerationRequest = parseResult.data;

  // TODO: Check for BYOK/offline requirements
  // For now, stub: check if OPENAI_API_KEY is missing
  const hasApiKey = !!process.env.OPENAI_API_KEY;
  if (!hasApiKey && process.env.EDITION === 'HOSTED') {
    return createErrorResponse(
      'BYOK_REQUIRED',
      'API key required for workout generation in hosted mode',
    );
  }

  // TODO: Check quota limits (when implemented)
  // if (quotaExceeded) {
  //   return createErrorResponse(
  //     'QUOTA_EXCEEDED',
  //     'Workout generation quota exceeded',
  //     3600, // retry after 1 hour
  //   );
  // }

  // TODO: Replace with actual AI generation when provider is set up
  // For now, return a mock plan based on the request parameters
  const mockPlan: TodayPlan = createTodayPlanMock({
    durationMinutes: generationRequest.timeMinutes ?? 30,
    focus: generationRequest.focus ?? 'Full Body',
    equipment: generationRequest.equipment ?? ['Bodyweight'],
    energy: generationRequest.energy ?? 'moderate',
  });

  // Validate response against schema
  const validated = todayPlanSchema.parse(mockPlan);

  // TODO: Store plan in database
  // await prisma.workoutPlan.create({ ... });

  return NextResponse.json(validated);
}

