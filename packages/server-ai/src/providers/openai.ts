import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import {
  todayPlanSchema,
  type GenerationRequest,
  type GenerationContext,
} from '@workout-agent/shared';
import { createLogger } from '@workout-agent-ce/server-core';
import type { AiProvider, AiProviderOptions, GenerationResult } from './types';
import { AiGenerationError } from './types';
import {
  SYSTEM_PROMPT,
  buildInitialGenerationPromptPayload,
  buildRegenerationMessage,
} from './prompts';
import {
  transformLlmResponse,
  getDefaultSchemaVersion,
  getSchemaForVersion,
} from '../llm-transformer';

const DEFAULT_MODEL = process.env.OPENAI_MODEL ?? 'gpt-5-mini';
const DEFAULT_API_BASE =
  process.env.OPENAI_API_BASE ?? 'https://api.openai.com/v1';

export class OpenAIProvider implements AiProvider {
  private readonly log = createLogger({ route: 'ai.openai' });

  async generate(
    request: GenerationRequest,
    context: GenerationContext,
    options: AiProviderOptions,
  ): Promise<GenerationResult> {
    const { log } = this;
    if (!options.apiKey) {
      throw new AiGenerationError('Missing API key', 'NO_API_KEY');
    }

    const client = new OpenAI({
      apiKey: options.apiKey,
      baseURL: options.apiBaseUrl ?? DEFAULT_API_BASE,
    });

    const model = options.model ?? DEFAULT_MODEL;
    const isRegeneration = Boolean(
      request.previousResponseId || request.baselineWorkout,
    );

    // Select schema version using selection algorithm
    // OpenAI supports both v1-current and v2-flat
    const schemaVersion = getDefaultSchemaVersion({
      supportedSchemas: ['v1-current', 'v2-flat'],
    });
    const selectedSchema = getSchemaForVersion(schemaVersion);

    // Build input based on whether this is initial generation or regeneration
    const input: OpenAI.Responses.ResponseInputItem[] = isRegeneration
      ? [
          {
            role: 'user',
            content: buildRegenerationMessage(
              request,
              request.feedback,
              options.candidatePool,
              options.planningBrief,
            ),
          },
        ]
      : [
          {
            role: 'system',
            content: SYSTEM_PROMPT,
          },
          {
            role: 'user',
            content: JSON.stringify(
              buildInitialGenerationPromptPayload(
                request,
                context,
                options.planningBrief,
                options.candidatePool,
              ),
            ),
          },
        ];

    let planPayload: unknown = null;
    let responseId = '';
    const started = Date.now();
    try {
      const response = await client.responses.parse({
        model,
        reasoning: { effort: 'low' },
        input,
        // Store the response so we can reference it in future regenerations
        store: true,
        // Link to previous conversation for regeneration
        ...(request.previousResponseId && {
          previous_response_id: request.previousResponseId,
        }),
        text: {
          format: zodTextFormat(selectedSchema, 'today_plan'),
        },
      });
      planPayload = response.output_parsed;
      responseId = response.id;
      log.info('model call completed', {
        provider: 'openai',
        model,
        durationMs: Date.now() - started,
        isRegeneration,
      });
    } catch (error) {
      const originalMessage =
        error instanceof Error ? error.message : String(error);
      const status =
        typeof (error as { status?: number }).status === 'number'
          ? (error as { status?: number }).status
          : undefined;
      throw new AiGenerationError(
        `Provider request failed${status ? ` (${status})` : ''}: ${originalMessage}`,
        'REQUEST_FAILED',
        status,
      );
    }

    if (!planPayload) {
      throw new AiGenerationError(
        'Provider returned an empty response',
        'INVALID_RESPONSE',
      );
    }

    // Transform LLM response to canonical TodayPlan using transformation layer
    const transformResult = transformLlmResponse(planPayload, {
      schemaVersion,
    });

    if (!transformResult.success) {
      // Treat transformation failures as provider errors
      log.error('transformation failed', {
        provider: 'openai',
        message: transformResult.error.message,
        schemaVersion: transformResult.schemaVersion,
      });
      throw new AiGenerationError(
        `LLM response transformation failed: ${transformResult.error.message}`,
        'INVALID_RESPONSE',
      );
    }

    // Enrich the transformed plan with provider-specific metadata
    const plan = { ...transformResult.plan, source: 'ai' as const, responseId };

    log.info('transformation succeeded', {
      provider: 'openai',
      schemaVersion: transformResult.schemaVersion,
    });

    return {
      plan: todayPlanSchema.parse(plan),
      responseId,
      schemaVersion: transformResult.schemaVersion,
    };
  }
}
