import { authenticateRequest } from '@/lib/auth';
import { createErrorResponse } from '@/lib/errors';
import {
  generationRequestSchema,
  generationContextSchema,
  todayPlanSchema,
  createTodayPlanMock,
  type TodayPlan,
} from '@workout-agent/shared';
import { NextResponse } from 'next/server';
import { generateTodayPlanAI, type GenerationResult } from '@/lib/generator';
import { loadGenerationContext, type GenerationRequestWithContext } from '@/lib/context';
import {
  markGenerationPending,
  persistGeneratedPlan,
  setGenerationError,
  DEFAULT_GENERATION_ETA_SECONDS,
} from '@/lib/generation-store';

// Extended schema that accepts optional client-provided context
const generationRequestWithContextSchema = generationRequestSchema.extend({
  context: generationContextSchema.optional(),
});

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

  const parseResult = generationRequestWithContextSchema.safeParse(body);
  if (!parseResult.success) {
    return createErrorResponse(
      'VALIDATION_ERROR',
      `Invalid request: ${parseResult.error.message}`,
    );
  }

  const generationRequest: GenerationRequestWithContext = parseResult.data;
  const deviceToken = auth.deviceToken;

  const headerProvider = request.headers
    .get('x-ai-provider')
    ?.trim()
    .toLowerCase();
  const envProvider = process.env.AI_PROVIDER?.trim().toLowerCase();
  const providerId = headerProvider || envProvider || 'openai';

  const headerKey = request.headers.get('x-ai-key')?.trim();
  const headerOpenAiKey = request.headers.get('x-openai-key')?.trim();

  let apiKey: string | null = null;
  if (headerKey) {
    apiKey = headerKey;
  } else if (headerOpenAiKey) {
    // Legacy support: map x-openai-key to api key
    apiKey = headerOpenAiKey;
  } else {
    // Env fallback
    switch (providerId) {
      case 'gemini':
        apiKey = process.env.GOOGLE_GENAI_API_KEY ?? null;
        break;
      case 'deepseek':
        apiKey = process.env.DEEPSEEK_API_KEY ?? null;
        break;
      case 'mistral':
        apiKey = process.env.MISTRAL_API_KEY ?? null;
        break;
      case 'groq':
        apiKey = process.env.GROQ_API_KEY ?? null;
        break;
      case 'openai':
      default:
        apiKey = process.env.OPENAI_API_KEY ?? null;
        break;
    }
  }

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
  const startedAt = Date.now();
  const isRegeneration = Boolean(generationRequest.previousResponseId);
  console.log('[workouts.generate] generation started', {
    userId: auth.userId,
    hasApiKey: Boolean(apiKey),
    isRegeneration,
    feedback: generationRequest.feedback,
  });
  markGenerationPending(deviceToken, DEFAULT_GENERATION_ETA_SECONDS);

  let plan: TodayPlan;
  let responseId: string | undefined;
  let encounteredProviderError = false;
  if (apiKey) {
    try {
      const result: GenerationResult = await generateTodayPlanAI(
        generationRequest,
        context,
        { apiKey, providerId },
      );
      plan = result.plan;
      responseId = result.responseId;
    } catch (error) {
      encounteredProviderError = true;
      console.warn('[workouts.generate] AI generation failed, falling back to mock', {
        message: (error as Error).message,
      });
      setGenerationError(
        deviceToken,
        'We could not reach the AI provider. Showing a fallback plan.',
      );
      plan = mockPlan();
    }
  } else {
    plan = mockPlan();
  }

  const validated = todayPlanSchema.parse(plan);
  if (!encounteredProviderError) {
    persistGeneratedPlan(deviceToken, validated);
    console.log('[workouts.generate] generation completed', {
      userId: auth.userId,
      durationMs: Date.now() - startedAt,
      source: apiKey ? 'ai' : 'mock',
      isRegeneration,
      responseId,
    });
  } else {
    console.warn('[workouts.generate] generation returned fallback plan', {
      userId: auth.userId,
      durationMs: Date.now() - startedAt,
    });
  }

  return NextResponse.json(validated);
}
