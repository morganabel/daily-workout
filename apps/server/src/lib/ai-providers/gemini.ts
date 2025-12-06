import { GoogleGenAI, Type } from '@google/genai';
import {
  todayPlanSchema,
  llmTodayPlanSchema,
  type GenerationRequest,
  type GenerationContext,
  type LlmTodayPlan,
  type TodayPlan,
  type RegenerationFeedback,
} from '@workout-agent/shared';
import { v7 as uuidv7 } from 'uuid';
import type { AiProvider, AiProviderOptions, GenerationResult } from './types';
import { AiGenerationError } from './types';

const DEFAULT_MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.0-flash-exp';
const DEFAULT_API_BASE = process.env.GEMINI_API_BASE;

const SYSTEM_PROMPT =
  'You are a concise workout planner. Only reply with valid JSON that matches the schema and never include code fences, explanations, or markdown.';

/**
 * Build a conversational follow-up message for regeneration.
 * This is used when we have conversation history (previousResponseId).
 */
function buildRegenerationMessage(
  request: GenerationRequest,
  feedback?: RegenerationFeedback[],
): string {
  const parts: string[] = [];

  parts.push("The user wasn't satisfied with the previous workout.");

  // Add feedback if provided
  if (feedback && feedback.length > 0) {
    const feedbackDescriptions = feedback.map((f) => {
      switch (f) {
        case 'too-hard':
          return 'it was too hard/intense';
        case 'too-easy':
          return 'it was too easy/not challenging enough';
        case 'different-exercises':
          return 'they want different exercises';
        case 'just-try-again':
          return 'they just want a fresh variation';
        default:
          return f;
      }
    });
    parts.push(`Their feedback: ${feedbackDescriptions.join(', ')}.`);
  }

  // Add requested parameter changes
  const changes: string[] = [];
  if (request.timeMinutes) {
    changes.push(`duration: ${request.timeMinutes} minutes`);
  }
  if (request.focus) {
    changes.push(`focus: ${request.focus}`);
  }
  if (request.equipment && request.equipment.length > 0) {
    changes.push(`equipment: ${request.equipment.join(', ')}`);
  }
  if (request.energy) {
    changes.push(`energy level: ${request.energy}`);
  }

  if (changes.length > 0) {
    parts.push(`Requested changes: ${changes.join(', ')}.`);
  }

  parts.push('Please generate a new workout that addresses these preferences.');

  return parts.join(' ');
}

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

/**
 * Convert Zod schema to Gemini Schema format for structured output
 */
function buildGeminiSchema(): any {
  return {
    type: Type.OBJECT,
    properties: {
      focus: { type: Type.STRING },
      durationMinutes: { type: Type.NUMBER },
      equipment: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
      },
      source: { type: Type.STRING },
      energy: { type: Type.STRING },
      summary: { type: Type.STRING },
      blocks: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            durationMinutes: { type: Type.NUMBER },
            focus: { type: Type.STRING },
            exercises: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  prescription: { type: Type.STRING },
                  detail: { type: Type.STRING, nullable: true },
                },
                required: ['name', 'prescription', 'detail'],
              },
            },
          },
          required: ['title', 'durationMinutes', 'focus', 'exercises'],
        },
      },
    },
    required: [
      'focus',
      'durationMinutes',
      'equipment',
      'source',
      'energy',
      'summary',
      'blocks',
    ],
  };
}

export class GeminiProvider implements AiProvider {
  async generate(
    request: GenerationRequest,
    context: GenerationContext,
    options: AiProviderOptions,
  ): Promise<GenerationResult> {
    if (!options.apiKey) {
      throw new AiGenerationError('Missing API key', 'NO_API_KEY');
    }

    const clientConfig: { apiKey: string; baseUrl?: string } = {
      apiKey: options.apiKey,
    };
    if (options.apiBaseUrl) {
      clientConfig.baseUrl = options.apiBaseUrl;
    } else if (DEFAULT_API_BASE) {
      clientConfig.baseUrl = DEFAULT_API_BASE;
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
        instructions:
          'Generate a single workout session with at least one block and one exercise per block. Use realistic exercise names and prescriptions. Prioritize user context (history, preferences, environment) when deciding focus, volume, and equipment. If no focus is specified, choose the most appropriate one based on the user context.',
      })}`;
    }

    let planPayload: LlmTodayPlan | null = null;
    let responseId = '';
    const started = Date.now();
    try {
      // Use structured output with JSON schema
      const responseSchema = buildGeminiSchema();
      const result = await genAI.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema,
        },
      });

      responseId = `gemini-${Date.now()}`;

      const text = result.text.trim();
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
        '[workouts.generate] Gemini model call completed',
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

