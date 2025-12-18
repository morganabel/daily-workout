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
import { initializeProviders } from '@/lib/ai-providers/init';
import { isSupportedProvider, getDefaultProviderName } from '@/lib/ai-providers/registry';

// Initialize providers on module load
initializeProviders();

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

  // Extract provider from header (defaults based on legacy header or env)
  const providerHeader = request.headers.get('x-ai-provider')?.trim().toLowerCase();
  const openaiKeyHeader = request.headers.get('x-openai-key')?.trim();
  const geminiKeyHeader = request.headers.get('x-gemini-key')?.trim();
  const genericKeyHeader = request.headers.get('x-ai-key')?.trim();

  // Determine provider: explicit header > legacy x-openai-key inference > env default
  let provider: 'openai' | 'gemini';
  if (providerHeader) {
    if (!isSupportedProvider(providerHeader)) {
      return createErrorResponse(
        'INVALID_PROVIDER',
        `Unsupported provider: ${providerHeader}. Supported providers: openai, gemini`,
        400,
      );
    }
    provider = providerHeader;
  } else if (openaiKeyHeader) {
    // Legacy: x-openai-key implies OpenAI
    provider = 'openai';
  } else {
    // Default from env
    provider = getDefaultProviderName();
  }

  // Extract API key based on provider
  let apiKey: string | null = null;
  const useVertexAi = Boolean(
    provider === 'gemini' &&
    process.env.GOOGLE_GENAI_USE_VERTEXAI === 'true' &&
    process.env.GOOGLE_CLOUD_PROJECT &&
    process.env.GOOGLE_CLOUD_LOCATION
  );
  if (provider === 'openai') {
    apiKey = openaiKeyHeader || genericKeyHeader || process.env.OPENAI_API_KEY?.trim() || null;
  } else if (provider === 'gemini') {
    apiKey =
      geminiKeyHeader ||
      genericKeyHeader ||
      process.env.GEMINI_API_KEY?.trim() ||
      (useVertexAi ? 'vertex-env' : null);
  }

  // Check BYOK requirement for hosted edition
  if (!apiKey && !useVertexAi && process.env.EDITION === 'HOSTED') {
    return createErrorResponse(
      'BYOK_REQUIRED',
      `API key required for ${provider} provider in hosted mode`,
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
    provider,
    hasApiKey: Boolean(apiKey),
    isRegeneration,
    feedback: generationRequest.feedback,
  });
  markGenerationPending(deviceToken, DEFAULT_GENERATION_ETA_SECONDS);

  let plan: TodayPlan;
  let responseId: string | undefined;
  let schemaVersion: 'v1-current' | undefined;
  let encounteredProviderError = false;
  if (apiKey) {
    try {
      const result: GenerationResult = await generateTodayPlanAI(
        generationRequest,
        context,
        { apiKey: useVertexAi ? undefined : apiKey ?? undefined, provider, useVertexAi },
      );
      plan = result.plan;
      responseId = result.responseId;
      schemaVersion = result.schemaVersion;
    } catch (error) {
      encounteredProviderError = true;
      console.warn('[workouts.generate] AI generation failed, falling back to mock', {
        provider,
        message: (error as Error).message,
      });
      setGenerationError(
        deviceToken,
        'We could not generate a workout plan. Showing a fallback plan.',
      );
      plan = mockPlan();
    }
  } else {
    plan = mockPlan();
  }

  const validated = todayPlanSchema.parse(plan);
  if (!encounteredProviderError) {
    persistGeneratedPlan(deviceToken, validated, {
      schemaVersion,
    });
    console.log('[workouts.generate] generation completed', {
      userId: auth.userId,
      durationMs: Date.now() - startedAt,
      source: apiKey ? 'ai' : 'mock',
      isRegeneration,
      responseId,
      schemaVersion,
    });
  } else {
    console.warn('[workouts.generate] generation returned fallback plan', {
      userId: auth.userId,
      durationMs: Date.now() - startedAt,
    });
  }

  return NextResponse.json(validated);
}
