import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
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

export type GeneratePlanOptions = {
  apiKey: string;
  model?: string;
  client?: OpenAI;
  apiBaseUrl?: string;
};

export type GenerationResult = {
  plan: TodayPlan;
  responseId: string;
};

export class AiGenerationError extends Error {
  constructor(
    message: string,
    public readonly code: 'NO_API_KEY' | 'REQUEST_FAILED' | 'INVALID_RESPONSE',
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'AiGenerationError';
  }
}

const DEFAULT_MODEL = process.env.OPENAI_MODEL ?? 'gpt-5-mini';
const DEFAULT_API_BASE =
  process.env.OPENAI_API_BASE ?? 'https://api.openai.com/v1';

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

  const hasStructured =
    Boolean(request.timeMinutes) ||
    Boolean(request.focus) ||
    Boolean(request.energy) ||
    Boolean(request.equipment && request.equipment.length > 0) ||
    Boolean(feedback && feedback.length > 0);

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

  if (request.notes) {
    if (!hasStructured) {
      parts.push(
        'The instructions below are free form feedback from the user. Treat the instructions below as the single source of truth. Override any prior context or workout details when there is a conflict.',
      );
    } else {
      parts.push(
        'Prioritize the user instructions below over any previous context or the earlier workout. If there is a conflict, follow the new instructions.',
      );
    }
    parts.push(`User explicit instructions: ${request.notes}`);
  }

  parts.push('Please generate a new workout that addresses these preferences.');

  return parts.join(' ');
}

/**
 * Calls the AI provider to generate a TodayPlan payload using the Responses API.
 * Throws AiGenerationError on provider or parsing failures.
 *
 * When previousResponseId is provided, uses conversational follow-up instead of
 * full structured request, allowing the LLM to reference the previous workout.
 */
export async function generateTodayPlanAI(
  request: GenerationRequest,
  context: GenerationContext,
  options: GeneratePlanOptions,
): Promise<GenerationResult> {
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
          content: JSON.stringify({
            request,
            context,
            instructions:
              'Generate a single workout session with at least one block and one exercise per block. Use realistic exercise names and prescriptions. Prioritize user context (history, preferences, environment) when deciding focus, volume, and equipment. If no focus is specified, choose the most appropriate one based on the user context.',
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
