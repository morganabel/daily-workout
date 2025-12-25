import type {
  AuthProvider,
  GenerationStore,
  ModelRouter,
  UsagePolicy,
  MeteringSink,
} from '../types';
import { createErrorResponse } from '../utils/errors';
import { loadGenerationContext, type GenerationRequestWithContext } from '../utils/context';
import {
  generationRequestSchema,
  generationContextSchema,
  todayPlanSchema,
  createTodayPlanMock,
  type TodayPlan,
} from '@workout-agent/shared';

// Extended schema that accepts optional client-provided context
const generationRequestWithContextSchema = generationRequestSchema.extend({
  context: generationContextSchema.optional(),
});

const DEFAULT_GENERATION_ETA_SECONDS = 18;

/**
 * Server configuration for generation
 */
export interface GenerateHandlerConfig {
  /**
   * Edition mode (OSS or HOSTED)
   */
  edition?: 'OSS' | 'HOSTED';

  /**
   * Whether to use Vertex AI for Gemini (server-configured)
   */
  useVertexAi?: boolean;

  /**
   * Google Cloud project ID (for Vertex AI)
   */
  googleCloudProject?: string;

  /**
   * Google Cloud location (for Vertex AI)
   */
  googleCloudLocation?: string;

  /**
   * Default API keys (server-managed, not BYOK)
   * IMPORTANT: These should never be logged
   */
  defaultApiKeys?: {
    openai?: string;
    gemini?: string;
  };

  /**
   * Default provider when not specified
   */
  defaultProvider?: 'openai' | 'gemini';
}

/**
 * Dependencies for the generate handler
 */
export interface GenerateHandlerDeps {
  auth: AuthProvider;
  store: GenerationStore;
  router: ModelRouter;
  policy?: UsagePolicy;
  metering?: MeteringSink;
  config: GenerateHandlerConfig;
}

/**
 * Sanitize error messages to remove any potential API key leaks
 */
function sanitizeErrorMessage(message: string): string {
  // Remove anything that looks like an API key (sk-..., AIza..., etc.)
  return message
    .replace(/sk-[a-zA-Z0-9_-]+/g, '[REDACTED]')
    .replace(/AIza[a-zA-Z0-9_-]+/g, '[REDACTED]')
    .replace(/\b[a-f0-9]{32,}\b/gi, '[REDACTED]');
}

/**
 * Factory for creating the POST /api/workouts/generate handler
 *
 * Accepts quick-action parameters and generates a workout plan.
 * Returns the generated TodayPlan.
 *
 * Handles BYOK/offline rejection cases.
 */
export function createGenerateHandler(deps: GenerateHandlerDeps) {
  return async function generateHandler(request: Request): Promise<Response> {
    const startedAt = Date.now();

    // Authenticate request
    const auth = await deps.auth.authenticate(request);
    if (!auth) {
      return createErrorResponse(
        'UNAUTHORIZED',
        'Invalid or missing DeviceToken',
        401
      );
    }

    // Parse and validate request body
    let body: unknown;
    try {
      body = await request.json();
    } catch (error) {
      return createErrorResponse(
        'VALIDATION_ERROR',
        'Invalid JSON in request body'
      );
    }

    const parseResult = generationRequestWithContextSchema.safeParse(body);
    if (!parseResult.success) {
      return createErrorResponse(
        'VALIDATION_ERROR',
        `Invalid request: ${parseResult.error.message}`
      );
    }

    const generationRequest: GenerationRequestWithContext = parseResult.data;

    // Extract provider from header (defaults based on legacy header or config)
    const providerHeader = request.headers.get('x-ai-provider')?.trim().toLowerCase();
    const openaiKeyHeader = request.headers.get('x-openai-key')?.trim();
    const geminiKeyHeader = request.headers.get('x-gemini-key')?.trim();
    const genericKeyHeader = request.headers.get('x-ai-key')?.trim();

    // Determine provider: explicit header > legacy x-openai-key inference > config default
    let provider: 'openai' | 'gemini';
    if (providerHeader) {
      if (!deps.router.isSupportedProvider(providerHeader)) {
        return createErrorResponse(
          'INVALID_PROVIDER',
          `Unsupported provider: ${providerHeader}. Supported providers: openai, gemini`,
          400
        );
      }
      provider = providerHeader as 'openai' | 'gemini';
    } else if (openaiKeyHeader) {
      // Legacy: x-openai-key implies OpenAI
      provider = 'openai';
    } else {
      // Default from config or router
      const defaultProvider = deps.config.defaultProvider ?? deps.router.getDefaultProvider();
      provider = defaultProvider as 'openai' | 'gemini';
    }

    // Determine if Vertex AI should be used
    const useVertexAi = Boolean(
      provider === 'gemini' &&
        deps.config.useVertexAi &&
        deps.config.googleCloudProject &&
        deps.config.googleCloudLocation
    );

    // Extract API key based on provider
    // Priority: BYOK header > server default key
    let apiKey: string | null = null;
    if (provider === 'openai') {
      apiKey =
        openaiKeyHeader ||
        genericKeyHeader ||
        deps.config.defaultApiKeys?.openai ||
        null;
    } else if (provider === 'gemini') {
      apiKey =
        geminiKeyHeader ||
        genericKeyHeader ||
        deps.config.defaultApiKeys?.gemini ||
        (useVertexAi ? 'vertex-env' : null);
    }

    const isByok = Boolean(openaiKeyHeader || geminiKeyHeader || genericKeyHeader);

    // Check BYOK requirement for hosted edition
    if (!apiKey && !useVertexAi && deps.config.edition === 'HOSTED') {
      return createErrorResponse(
        'BYOK_REQUIRED',
        `API key required for ${provider} provider in hosted mode`,
        402
      );
    }

    // Check policy (quota/rate limits)
    if (deps.policy) {
      const policyResult = await deps.policy.canGenerate(auth.userId, generationRequest);
      if (!policyResult.allowed) {
        return createErrorResponse(
          'QUOTA_EXCEEDED',
          policyResult.reason ?? 'Quota exceeded',
          policyResult.statusCode ?? 429
        );
      }
    }

    const mockPlan = () =>
      createTodayPlanMock({
        durationMinutes: generationRequest.timeMinutes ?? 30,
        focus: generationRequest.focus ?? 'Full Body',
        equipment: generationRequest.equipment ?? ['Bodyweight'],
        energy: generationRequest.energy ?? 'moderate',
      });

    const context = await loadGenerationContext(auth.userId, generationRequest);
    const isRegeneration = Boolean(generationRequest.previousResponseId);

    // Log generation start (NEVER log API keys)
    console.log('[workouts.generate] generation started', {
      userId: auth.userId,
      provider,
      hasApiKey: Boolean(apiKey),
      isByok,
      isRegeneration,
      feedback: generationRequest.feedback,
    });

    await deps.store.markPending(auth.deviceToken, DEFAULT_GENERATION_ETA_SECONDS);

    let plan: TodayPlan;
    let responseId: string | undefined;
    let schemaVersion: string | undefined;
    let encounteredProviderError = false;

    if (apiKey) {
      try {
        const result = await deps.router.generate(generationRequest, context, {
          apiKey: useVertexAi ? undefined : apiKey ?? undefined,
          provider,
          useVertexAi,
        });
        plan = result.plan;
        responseId = result.responseId;
        schemaVersion = result.schemaVersion;
      } catch (error) {
        encounteredProviderError = true;
        const sanitizedMessage = sanitizeErrorMessage((error as Error).message);
        console.warn('[workouts.generate] AI generation failed, falling back to mock', {
          provider,
          message: sanitizedMessage, // Use sanitized message
        });
        await deps.store.setError(
          auth.deviceToken,
          'We could not generate a workout plan. Showing a fallback plan.'
        );
        plan = mockPlan();
      }
    } else {
      plan = mockPlan();
    }

    const validated = todayPlanSchema.parse(plan);

    if (!encounteredProviderError) {
      await deps.store.persistPlan(auth.deviceToken, validated, {
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

    // Record metering event
    if (deps.metering && apiKey && !encounteredProviderError) {
      await deps.metering.recordUsage({
        userId: auth.userId,
        operation: isRegeneration ? 'regenerate' : 'generate',
        provider,
        byok: isByok,
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - startedAt,
        metadata: {
          responseId,
          schemaVersion,
        },
      });
    }

    return Response.json(validated);
  };
}
