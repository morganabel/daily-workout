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
import { generateTodayPlanAI } from '@/lib/generator';
import { loadGenerationContext } from '@/lib/context';

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

  const headerApiKey = request.headers.get('x-openai-key')?.trim();
  const envApiKey = process.env.OPENAI_API_KEY?.trim();
  const apiKey = headerApiKey || envApiKey || null;

  if (!apiKey && process.env.EDITION === 'HOSTED') {
    return createErrorResponse(
      'BYOK_REQUIRED',
      'API key required for workout generation in hosted mode',
      402,
    );
  }

  const mockPlan = () =>
    createTodayPlanMock({
      durationMinutes: generationRequest.timeMinutes ?? 30,
      focus: generationRequest.focus ?? 'Full Body',
      equipment: generationRequest.equipment ?? ['Bodyweight'],
      energy: generationRequest.energy ?? 'moderate',
    });

  const context = await loadGenerationContext(auth.userId, generationRequest);

  let plan: TodayPlan;
  if (apiKey) {
    try {
      plan = await generateTodayPlanAI(generationRequest, context, { apiKey });
    } catch (error) {
      console.warn('[workouts.generate] AI generation failed, falling back to mock', {
        message: (error as Error).message,
      });
      plan = mockPlan();
    }
  } else {
    plan = mockPlan();
  }

  const validated = todayPlanSchema.parse(plan);
  return NextResponse.json(validated);
}
