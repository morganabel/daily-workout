import type {
  GenerationRequest,
  RegenerationFeedback,
} from '@workout-agent/shared';

export const SYSTEM_PROMPT =
  'You are a concise workout planner. Only reply with valid JSON that matches the schema and never include code fences, explanations, or markdown.';

export const INITIAL_GENERATION_INSTRUCTIONS =
  'Generate a single workout session with at least one block and one exercise per block. Use realistic exercise names and prescriptions. Prioritize user context (history, preferences, environment) when deciding focus, volume, and equipment. If no focus is specified, choose the most appropriate one based on the user context.';

/**
 * Build a conversational follow-up message for regeneration.
 * This is used when we have conversation history (previousResponseId).
 *
 * Matches the behavior from main branch.
 */
export function buildRegenerationMessage(
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

  // Handle user notes - this is the key addition from main
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
