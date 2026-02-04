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
  isAutoFocus,
  todayPlanSchema,
  createTodayPlanMock,
  type TodayPlan,
} from '@workout-agent/shared';
import {
  attachRequestId,
  createRequestContext,
  redactSensitiveStrings,
} from '../utils/logging';

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
   * Edition mode (CE or HOSTED)
   */
  edition?: 'CE' | 'HOSTED';

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
  return redactSensitiveStrings(message);
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
    const { requestId, urlPath, startedAt, log } = createRequestContext(request, 'workouts.generate');

    const errorResponse = (
      code: Parameters<typeof createErrorResponse>[0],
      message: string,
      status: number,
    ): Response => {
      const response = createErrorResponse(code, message, status);
      attachRequestId(response, requestId);
      log.info('request completed', {
        method: request.method,
        path: urlPath,
        status,
        durationMs: Date.now() - startedAt,
        code,
      });
      return response;
    };

    // Authenticate request
    const auth = await deps.auth.authenticate(request);
    if (!auth) {
      log.info('request unauthorized', { method: request.method, path: urlPath });
      return errorResponse('UNAUTHORIZED', 'Invalid or missing session', 401);
    }

    // Parse and validate request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      log.warn('invalid json body', { method: request.method, path: urlPath });
      return errorResponse('VALIDATION_ERROR', 'Invalid JSON in request body', 400);
    }

    const parseResult = generationRequestWithContextSchema.safeParse(body);
    if (!parseResult.success) {
      log.warn('request validation failed', {
        method: request.method,
        path: urlPath,
        issues: parseResult.error.issues.length,
      });
      return errorResponse(
        'VALIDATION_ERROR',
        `Invalid request: ${parseResult.error.message}`,
        400,
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
        return errorResponse(
          'INVALID_PROVIDER',
          `Unsupported provider: ${providerHeader}. Supported providers: openai, gemini`,
          400,
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
      return errorResponse(
        'BYOK_REQUIRED',
        `API key required for ${provider} provider in hosted mode`,
        402,
      );
    }

    // Check policy (quota/rate limits)
    if (deps.policy) {
      const policyResult = await deps.policy.canGenerate(auth.userId, generationRequest);
      if (!policyResult.allowed) {
        return errorResponse(
          'QUOTA_EXCEEDED',
          policyResult.reason ?? 'Quota exceeded',
          policyResult.statusCode ?? 429,
        );
      }
    }

    const mockPlan = () =>
      createTodayPlanMock({
        durationMinutes: generationRequest.timeMinutes ?? 30,
        focus:
          generationRequest.focus && !isAutoFocus(generationRequest.focus)
            ? generationRequest.focus
            : 'Full Body',
        equipment: generationRequest.equipment ?? ['Bodyweight'],
        energy: generationRequest.energy ?? 'moderate',
      });

    const context = await loadGenerationContext(auth.userId, generationRequest);
    const isRegeneration = Boolean(generationRequest.previousResponseId);

    // Log generation start (NEVER log API keys, prompts, or free-form feedback)
    log.info('generation started', {
      provider,
      hasApiKey: Boolean(apiKey),
      isByok,
      isRegeneration,
      hasFeedback: (generationRequest.feedback?.length ?? 0) > 0,
      feedbackCount: generationRequest.feedback?.length ?? 0,
    });

    // Use principalId for device-scoped state (GenerationStore)
    await deps.store.markPending(auth.principalId, DEFAULT_GENERATION_ETA_SECONDS);

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
        log.warn('ai generation failed; falling back to mock', {
          provider,
          message: sanitizedMessage,
          error,
        });
        await deps.store.setError(
          auth.principalId,
          'We could not generate a workout plan. Showing a fallback plan.'
        );
        plan = mockPlan();
      }
    } else {
      plan = mockPlan();
    }

    const validated = todayPlanSchema.parse(plan);

    if (!encounteredProviderError) {
      await deps.store.persistPlan(auth.principalId, validated, {
        schemaVersion,
      });
      log.info('generation completed', {
        durationMs: Date.now() - startedAt,
        source: apiKey ? 'ai' : 'mock',
        isRegeneration,
        responseId,
        schemaVersion,
      });
    } else {
      log.info('generation returned fallback plan', { durationMs: Date.now() - startedAt });
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

    const response = Response.json(validated);
    attachRequestId(response, requestId);
    log.info('request completed', {
      method: request.method,
      path: urlPath,
      status: 200,
      durationMs: Date.now() - startedAt,
    });
    return response;
  };
}
