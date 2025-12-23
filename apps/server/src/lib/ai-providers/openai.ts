import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import {
  todayPlanSchema,
  type GenerationRequest,
  type GenerationContext,
} from '@workout-agent/shared';
import type { AiProvider, AiProviderOptions, GenerationResult } from './types';
import { AiGenerationError } from './types';
import {
  SYSTEM_PROMPT,
  INITIAL_GENERATION_INSTRUCTIONS,
  buildRegenerationMessage,
} from './prompts';
import {
  transformLlmResponse,
  getDefaultSchemaVersion,
  selectSchemaVersion,
  getSchemaForVersion,
  type LlmSchemaVersion,
} from '../llm-transformer';

const DEFAULT_MODEL = process.env.OPENAI_MODEL ?? 'gpt-5-mini';
const DEFAULT_API_BASE =
  process.env.OPENAI_API_BASE ?? 'https://api.openai.com/v1';

export class OpenAIProvider implements AiProvider {
  async generate(
    request: GenerationRequest,
    context: GenerationContext,
    options: AiProviderOptions,
  ): Promise<GenerationResult> {
    if (!options.apiKey) {
      throw new AiGenerationError('Missing API key', 'NO_API_KEY');
    }

    const client = new OpenAI({
      apiKey: options.apiKey,
      baseURL: options.apiBaseUrl ?? DEFAULT_API_BASE,
    });

    const model = options.model ?? DEFAULT_MODEL;
    const isRegeneration = Boolean(request.previousResponseId);

    // Select schema version using selection algorithm
    // OpenAI supports both v1-current and v2-flat
    const schemaVersion = selectSchemaVersion({
      supportedSchemas: ['v1-current', 'v2-flat'],
    });
    const selectedSchema = getSchemaForVersion(schemaVersion);

    // Build input based on whether this is initial generation or regeneration
    const input: OpenAI.Responses.ResponseInputItem[] = isRegeneration
      ? [
          {
            role: 'user',
            content: buildRegenerationMessage(request, request.feedback),
          },
        ]
      : [
          {
            role: 'system',
            content: SYSTEM_PROMPT,
          },
          {
            role: 'user',
            content: JSON.stringify({
              request,
              context,
              instructions: INITIAL_GENERATION_INSTRUCTIONS,
            }),
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
      console.log(
        '[workouts.generate] model call completed',
        `${((Date.now() - started) / 1000).toFixed(1)}s`,
        isRegeneration ? '(regeneration)' : '(initial)',
      );
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
      console.error('[openai.generate] transformation failed', {
        error: transformResult.error.message,
        schemaVersion: transformResult.schemaVersion,
      });
      throw new AiGenerationError(
        `LLM response transformation failed: ${transformResult.error.message}`,
        'INVALID_RESPONSE',
      );
    }

    // Enrich the transformed plan with provider-specific metadata
    const plan = { ...transformResult.plan, source: 'ai' as const, responseId };

    console.log('[openai.generate] transformation succeeded', {
      schemaVersion: transformResult.schemaVersion,
    });

    return {
      plan: todayPlanSchema.parse(plan),
      responseId,
      schemaVersion: transformResult.schemaVersion,
    };
  }
}

