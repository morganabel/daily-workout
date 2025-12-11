import { GoogleGenAI } from '@google/genai';
import * as z from 'zod';
import {
  todayPlanSchema,
  llmTodayPlanSchema,
  type GenerationRequest,
  type GenerationContext,
  type LlmTodayPlan,
  type TodayPlan,
} from '@workout-agent/shared';
import type { AiProvider, AiProviderOptions, GenerationResult } from './types';
import { AiGenerationError } from './types';
import {
  SYSTEM_PROMPT,
  INITIAL_GENERATION_INSTRUCTIONS,
  buildRegenerationMessage,
} from './prompts';
import { attachGeneratedIds } from './utils';

const DEFAULT_MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';
const DEFAULT_API_BASE = process.env.GEMINI_API_BASE;
const USE_VERTEX_AI = process.env.GOOGLE_GENAI_USE_VERTEXAI === 'true';
const VERTEX_PROJECT = process.env.GOOGLE_CLOUD_PROJECT;
const VERTEX_LOCATION = process.env.GOOGLE_CLOUD_LOCATION;

// Convert the shared Zod schema to JSON Schema for Gemini structured output
const geminiResponseSchema = z.toJSONSchema(llmTodayPlanSchema);

export class GeminiProvider implements AiProvider {
  async generate(
    request: GenerationRequest,
    context: GenerationContext,
    options: AiProviderOptions,
  ): Promise<GenerationResult> {
    const useVertex =
      options.useVertexAi ||
      (!options.apiKey && USE_VERTEX_AI && VERTEX_PROJECT && VERTEX_LOCATION);

    const clientConfig: { apiKey?: string; baseUrl?: string; projectId?: string; location?: string } =
      {};

    if (useVertex) {
      clientConfig.projectId = VERTEX_PROJECT;
      clientConfig.location = VERTEX_LOCATION;
    } else {
      if (!options.apiKey) {
        throw new AiGenerationError('Missing API key', 'NO_API_KEY');
      }
      clientConfig.apiKey = options.apiKey;
      if (options.apiBaseUrl) {
        clientConfig.baseUrl = options.apiBaseUrl;
      } else if (DEFAULT_API_BASE) {
        clientConfig.baseUrl = DEFAULT_API_BASE;
      }
    }

    const genAI = new GoogleGenAI(clientConfig);
    const model = options.model ?? DEFAULT_MODEL;

    const isRegeneration = Boolean(request.previousResponseId);

    // Build prompt based on whether this is initial generation or regeneration
    let prompt: string;
    if (isRegeneration) {
      prompt = buildRegenerationMessage(request, request.feedback);
    } else {
      prompt = `${SYSTEM_PROMPT}\n\n${JSON.stringify({
        request,
        context,
        instructions: INITIAL_GENERATION_INSTRUCTIONS,
      })}`;
    }

    let planPayload: LlmTodayPlan | null = null;
    let responseId = '';
    const started = Date.now();
    try {
      // Use structured output with JSON schema
      const result = await genAI.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: geminiResponseSchema,
        },
      });

      responseId = `gemini-${Date.now()}`;

      const text = (result.text ?? '').trim();
      if (!text) {
        throw new Error('Empty response from Gemini');
      }

      // Parse JSON response
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch (parseError) {
        throw new Error(`Failed to parse JSON response: ${parseError}`);
      }

      // Validate against Zod schema
      planPayload = llmTodayPlanSchema.parse(parsed);

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

