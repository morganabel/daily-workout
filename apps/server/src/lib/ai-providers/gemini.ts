import { GoogleGenAI } from '@google/genai';
import * as z from 'zod';
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
  getSchemaForVersion,
} from '../llm-transformer';

const DEFAULT_MODEL = process.env.GEMINI_MODEL ?? 'gemini-3-flash-preview';
const DEFAULT_API_BASE = process.env.GEMINI_API_BASE;
const getVertexEnvConfig = () => ({
  enabled: process.env.GOOGLE_GENAI_USE_VERTEXAI === 'true',
  projectId: process.env.GOOGLE_CLOUD_PROJECT,
  location: process.env.GOOGLE_CLOUD_LOCATION,
});

export class GeminiProvider implements AiProvider {
  async generate(
    request: GenerationRequest,
    context: GenerationContext,
    options: AiProviderOptions,
  ): Promise<GenerationResult> {
    const vertexEnv = getVertexEnvConfig();
    const useVertex =
      options.useVertexAi ??
      Boolean(
        !options.apiKey &&
          vertexEnv.enabled &&
          vertexEnv.projectId &&
          vertexEnv.location,
      );

    const clientConfig: { apiKey?: string; baseUrl?: string; projectId?: string; location?: string } =
      {};

    if (useVertex) {
      clientConfig.projectId = vertexEnv.projectId;
      clientConfig.location = vertexEnv.location;
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

    // Select schema version using selection algorithm
    // Gemini supports both v1-current and v2-flat, but prefers v2-flat for lower depth
    const schemaVersion = getDefaultSchemaVersion({
      supportedSchemas: ['v1-current', 'v2-flat'],
    });
    const selectedSchema = getSchemaForVersion(schemaVersion);

    // Convert the selected Zod schema to JSON Schema for Gemini structured output
    const geminiResponseSchema = z.toJSONSchema(selectedSchema);

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

    let planPayload: unknown = null;
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

      // Validate against selected Zod schema
      planPayload = selectedSchema.parse(parsed);

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
      console.error('[gemini.generate] transformation failed', {
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

    console.log('[gemini.generate] transformation succeeded', {
      schemaVersion: transformResult.schemaVersion,
    });

    return {
      plan: todayPlanSchema.parse(plan),
      responseId,
      schemaVersion: transformResult.schemaVersion,
    };
  }
}
