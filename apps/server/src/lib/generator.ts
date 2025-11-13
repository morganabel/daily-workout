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

export type GeneratePlanOptions = {
  apiKey: string;
  model?: string;
  client?: OpenAI;
  apiBaseUrl?: string;
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
 * Calls the AI provider to generate a TodayPlan payload using the Responses API.
 * Throws AiGenerationError on provider or parsing failures.
 */
export async function generateTodayPlanAI(
  request: GenerationRequest,
  context: GenerationContext,
  options: GeneratePlanOptions,
): Promise<TodayPlan> {
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

  let planPayload: LlmTodayPlan | null = null;
  const started = Date.now();
  try {
    const response = await client.responses.parse({
      model,
      reasoning: { effort: 'low' },
      input: [
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
              'Generate a single workout session with at least one block and one exercise per block. Use realistic exercise names and prescriptions. Prioritize user context (history, preferences, environment) when deciding focus, volume, and equipment.',
          }),
        },
      ],
      text: {
        format: zodTextFormat(llmTodayPlanSchema, 'today_plan'),
      }
    });
    planPayload = response.output_parsed;
    console.log(
      '[workouts.generate] model call completed',
      `${((Date.now() - started) / 1000).toFixed(1)}s`,
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

  return todayPlanSchema.parse(withIds);
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
