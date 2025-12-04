import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import {
  todayPlanSchema,
  llmTodayPlanSchema,
  type GenerationRequest,
  type GenerationContext,
  type LlmTodayPlan,
} from '@workout-agent/shared';
import {
  type AiProvider,
  type AiProviderResult,
  type GeneratePlanOptions,
} from './types';
import {
  AiGenerationError,
  SYSTEM_PROMPT,
  buildRegenerationMessage,
  attachGeneratedIds,
  buildInitialUserPrompt,
} from '../utils';

const DEFAULT_MODEL = process.env.OPENAI_MODEL ?? 'gpt-5-mini';
const DEFAULT_API_BASE =
  process.env.OPENAI_API_BASE ?? 'https://api.openai.com/v1';

export class OpenAiProvider implements AiProvider {
  id = 'openai';

  async generatePlan(
    request: GenerationRequest,
    context: GenerationContext,
    options: GeneratePlanOptions,
  ): Promise<AiProviderResult> {
    if (!options.apiKey) {
      throw new AiGenerationError('Missing API key', 'NO_API_KEY');
    }

    const client =
      options.client ??
      new OpenAI({
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
            content: buildInitialUserPrompt(request, context),
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
        store: true,
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
        '[openai] model call completed',
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
        `OpenAI request failed${status ? ` (${status})` : ''}: ${originalMessage}`,
        'REQUEST_FAILED',
        status,
      );
    }

    if (!planPayload) {
      throw new AiGenerationError(
        'OpenAI returned an empty response',
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
