import {
  type GenerationRequest,
  type LlmTodayPlan,
  type TodayPlan,
  type RegenerationFeedback,
} from '@workout-agent/shared';
import { v7 as uuidv7 } from 'uuid';

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

export const SYSTEM_PROMPT =
  'You are a concise workout planner. Only reply with valid JSON that matches the schema and never include code fences, explanations, or markdown.';

export function buildRegenerationMessage(
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

export function attachGeneratedIds(plan: LlmTodayPlan): TodayPlan {
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

export function buildInitialUserPrompt(request: GenerationRequest, context: any): string {
  return JSON.stringify({
    request,
    context,
    instructions:
      'Generate a single workout session with at least one block and one exercise per block. Use realistic exercise names and prescriptions. Prioritize user context (history, preferences, environment) when deciding focus, volume, and equipment. If no focus is specified, choose the most appropriate one based on the user context.',
  });
}
