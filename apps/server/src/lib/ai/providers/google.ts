import { GoogleGenAI } from '@google/genai';
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

const DEFAULT_MODEL = 'gemini-1.5-flash';

export class GoogleGenAiProvider implements AiProvider {
  id = 'gemini';

  async generatePlan(
    request: GenerationRequest,
    context: GenerationContext,
    options: GeneratePlanOptions,
  ): Promise<AiProviderResult> {
    if (!options.apiKey) {
      // TODO: Support Vertex AI via ADC if no API key?
      throw new AiGenerationError('Missing Google API key', 'NO_API_KEY');
    }

    const client = new GoogleGenAI({ apiKey: options.apiKey });
    const modelId = options.model ?? DEFAULT_MODEL;

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
      const result = await client.models.generateContent({
        model: modelId,
        config: {
          responseMimeType: 'application/json',
          systemInstruction: {
            parts: [{ text: SYSTEM_PROMPT }],
          },
        },
        contents: [
          {
            role: 'user',
            parts: [{ text: userMessageContent }],
          },
        ],
      });

      const text = result.response.text();
      responseId = ''; // Usage metadata/ID not strictly consistent in text response access

      if (!text) throw new Error('Empty response');

      // Clean markdown code fences if present (Gemini sometimes adds them despite system prompt)
      const cleanText = text.replace(/^```json\s*/, '').replace(/\s*```$/, '');

      const parsed = JSON.parse(cleanText);
      planPayload = llmTodayPlanSchema.parse(parsed);

      console.log(
        '[gemini] model call completed',
        `${((Date.now() - started) / 1000).toFixed(1)}s`,
        isRegeneration ? '(regeneration)' : '(initial)',
      );
    } catch (error) {
      const originalMessage =
        error instanceof Error ? error.message : String(error);
      throw new AiGenerationError(
        `Gemini request failed: ${originalMessage}`,
        'REQUEST_FAILED',
      );
    }

    if (!planPayload) {
      throw new AiGenerationError(
        'Gemini returned an empty response',
        'INVALID_RESPONSE',
      );
    }

    const withIds = attachGeneratedIds(planPayload);
    withIds.source = 'ai';
    withIds.responseId = responseId || 'gemini-no-id';

    return {
      plan: todayPlanSchema.parse(withIds),
      responseId: withIds.responseId,
    };
  }
}
