import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import {
  todayPlanSchema,
  llmTodayPlanSchema,
  type GenerationRequest,
  type GenerationContext,
  type LlmTodayPlan,
  type TodayPlan,
} from '@workout-agent/shared';
import { v7 as uuidv7 } from 'uuid';
import type { AiProvider, AiProviderOptions, GenerationResult } from './types';
import { AiGenerationError } from './types';
import {
  SYSTEM_PROMPT,
  INITIAL_GENERATION_INSTRUCTIONS,
  buildRegenerationMessage,
} from './prompts';

const DEFAULT_MODEL = process.env.OPENAI_MODEL ?? 'gpt-5-mini';
const DEFAULT_API_BASE =
  process.env.OPENAI_API_BASE ?? 'https://api.openai.com/v1';

function attachGeneratedIds(plan: LlmTodayPlan): TodayPlan {
  return {
    id: uuidv7(),
    ...plan,
    blocks: plan.blocks.map((block) => ({
      id: uuidv7(),
      ...block,
      exercises: block.exercises.map((exercise) => ({
        id: uuidv7(),
        ...exercise,
      })),
    })),
  };
}

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

    let planPayload: LlmTodayPlan | null = null;
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
          format: zodTextFormat(llmTodayPlanSchema, 'today_plan'),
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

    const withIds = attachGeneratedIds(planPayload);
    withIds.source = 'ai';
    withIds.responseId = responseId;

    return {
      plan: todayPlanSchema.parse(withIds),
      responseId,
    };
  }
}

