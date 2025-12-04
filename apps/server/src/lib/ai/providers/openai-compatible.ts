import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
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

export class OpenAiChatProvider implements AiProvider {
  constructor(
    public id: string,
    private defaultBaseUrl: string,
    private defaultModel: string,
  ) {}

  async generatePlan(
    request: GenerationRequest,
    context: GenerationContext,
    options: GeneratePlanOptions,
  ): Promise<AiProviderResult> {
    if (!options.apiKey) {
      throw new AiGenerationError(
        `Missing API key for ${this.id}`,
        'NO_API_KEY',
      );
    }

    const client = new OpenAI({
      apiKey: options.apiKey,
      baseURL: options.apiBaseUrl ?? this.defaultBaseUrl,
    });

    const model = options.model ?? this.defaultModel;
    const isRegeneration = Boolean(request.previousResponseId);
    let userMessageContent = '';

    if (isRegeneration) {
      const contextStr = buildInitialUserPrompt(request, context);
      const regenStr = buildRegenerationMessage(request, request.feedback);
      userMessageContent = `Original Context: ${contextStr}\n\nFeedback/Instructions: ${regenStr}`;
    } else {
      userMessageContent = buildInitialUserPrompt(request, context);
    }

    const started = Date.now();
    let planPayload: LlmTodayPlan | null = null;
    let responseId = '';

    try {
      const response = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessageContent },
        ],
        response_format: zodResponseFormat(llmTodayPlanSchema, 'today_plan'),
      });

      const content = response.choices[0]?.message?.content;
      responseId = response.id;

      if (!content) throw new Error('Empty content');

      const parsed = JSON.parse(content);
      planPayload = llmTodayPlanSchema.parse(parsed);

      console.log(
        `[${this.id}] model call completed`,
        `${((Date.now() - started) / 1000).toFixed(1)}s`,
        isRegeneration ? '(regeneration)' : '(initial)',
      );
    } catch (error) {
      const originalMessage =
        error instanceof Error ? error.message : String(error);
      throw new AiGenerationError(
        `Request failed: ${originalMessage}`,
        'REQUEST_FAILED',
      );
    }

    const withIds = attachGeneratedIds(planPayload);
    withIds.source = 'ai';
    withIds.responseId = responseId;

    return {
      plan: todayPlanSchema.parse(withIds),
      responseId: withIds.responseId,
    };
  }
}
