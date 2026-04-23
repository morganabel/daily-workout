import {
  isAutoFocus,
  type GenerationContext,
  type GenerationRequest,
  type RegenerationFeedback,
} from '@workout-agent/shared';
import type {
  ExerciseCandidatePool,
  PlanningBrief,
} from '@workout-agent-ce/server-core';

export const SYSTEM_PROMPT =
  'You are a concise workout planner. Only reply with valid JSON that matches the schema and never include code fences, explanations, or markdown.';

export const INITIAL_GENERATION_INSTRUCTIONS =
  'Generate a single workout session with at least one block and one exercise per block. Use realistic exercise names and prescriptions. Prefer the planning brief when present, otherwise use the request and context as the source of truth for focus, duration, equipment, and constraints. Prefer exercises from the candidate pool when one is provided. If no focus is specified, choose the most appropriate one from the available planning data.';

const MAX_PROMPT_CANDIDATE_EXERCISES = 64;

export function buildCandidatePoolPromptData(
  candidatePool?: ExerciseCandidatePool,
):
  | {
      libraryVersion: string;
      totalEligibleCount: number;
      searchText?: string;
      baselineExerciseIds: string[];
      exercises: Array<{ id: string; name: string }>;
      instructions: string;
    }
  | undefined {
  if (!candidatePool) {
    return undefined;
  }

  const exercises = candidatePool.candidateExercises.slice(
    0,
    MAX_PROMPT_CANDIDATE_EXERCISES,
  );

  return {
    libraryVersion: candidatePool.libraryVersion,
    totalEligibleCount: candidatePool.totalEligibleCount,
    searchText: candidatePool.searchText,
    baselineExerciseIds: candidatePool.baselineExerciseIds,
    exercises,
    instructions:
      'Prefer exercises from this candidate pool unless there is a strong reason not to. Treat the list as a bounded high-confidence set chosen from the exercise library after applying hard constraints. Do not mention the candidate pool in the final response.',
  };
}

export function buildPlanningBriefPromptData(planningBrief?: PlanningBrief):
  | {
      resolvedFocus: string;
      focusMode: PlanningBrief['focusMode'];
      durationMinutes: number;
      loadCeiling: PlanningBrief['loadCeiling'];
      availableEquipment: string[];
      disallowedStressors: string[];
      recentStressorsToAvoid: string[];
      eventProtection?: PlanningBrief['eventProtection'];
      blockIntents: PlanningBrief['blockIntents'];
      regeneration: PlanningBrief['regeneration'];
      variationMode: PlanningBrief['variationMode'];
      priorityNotes?: string;
    }
  | undefined {
  if (!planningBrief) {
    return undefined;
  }

  return {
    resolvedFocus: planningBrief.resolvedFocus,
    focusMode: planningBrief.focusMode,
    durationMinutes: planningBrief.durationMinutes,
    loadCeiling: planningBrief.loadCeiling,
    availableEquipment: planningBrief.availableEquipment,
    disallowedStressors: planningBrief.disallowedStressors,
    recentStressorsToAvoid: planningBrief.recentStressorsToAvoid,
    eventProtection: planningBrief.eventProtection,
    blockIntents: planningBrief.blockIntents,
    regeneration: planningBrief.regeneration,
    variationMode: planningBrief.variationMode,
    priorityNotes: planningBrief.priorityNotes,
  };
}

export function buildInitialGenerationPromptPayload(
  request: GenerationRequest,
  context: GenerationContext,
  planningBrief?: PlanningBrief,
  candidatePool?: ExerciseCandidatePool,
) {
  const payload = {
    planningBrief: buildPlanningBriefPromptData(planningBrief),
    candidatePool: buildCandidatePoolPromptData(candidatePool),
    instructions: INITIAL_GENERATION_INSTRUCTIONS,
  };

  if (planningBrief) {
    return payload;
  }

  return {
    ...payload,
    request: {
      ...request,
      // Filter out auto focus so it doesn't anchor the LLM.
      focus: isAutoFocus(request.focus) ? undefined : request.focus,
    },
    context,
  };
}

function buildBaselineWorkoutSummary(
  request: GenerationRequest,
): string | null {
  const baselineWorkout = request.baselineWorkout;
  if (!baselineWorkout) {
    return null;
  }

  const exerciseNames = baselineWorkout.blocks
    .flatMap((block) => block.exercises.map((exercise) => exercise.name))
    .slice(0, 12);

  return [
    `Baseline workout focus: ${baselineWorkout.focus}.`,
    `Baseline duration: ${baselineWorkout.durationMinutes} minutes.`,
    `Baseline exercises: ${exerciseNames.join(', ')}.`,
  ].join(' ');
}

/**
 * Build a conversational follow-up message for regeneration.
 * This is used when we have conversation history (previousResponseId).
 *
 * Matches the behavior from main branch.
 */
export function buildRegenerationMessage(
  request: GenerationRequest,
  feedback?: RegenerationFeedback[],
  candidatePool?: ExerciseCandidatePool,
  planningBrief?: PlanningBrief,
): string {
  const parts: string[] = [];

  const hasStructured =
    Boolean(request.timeMinutes) ||
    Boolean(request.focus) ||
    Boolean(request.energy) ||
    Boolean(request.equipment && request.equipment.length > 0) ||
    Boolean(feedback && feedback.length > 0);

  parts.push("The user wasn't satisfied with the previous workout.");

  if (planningBrief) {
    parts.push(
      `Resolved session intent: ${planningBrief.resolvedFocus}. Load ceiling: ${planningBrief.loadCeiling}.`,
    );
    if (planningBrief.disallowedStressors.length > 0) {
      parts.push(
        `Avoid these stressors: ${planningBrief.disallowedStressors.join(', ')}.`,
      );
    }
    if (planningBrief.eventProtection) {
      parts.push(
        `Protect freshness for ${planningBrief.eventProtection.title} on ${planningBrief.eventProtection.localDate}.`,
      );
    }
  }

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
  if (request.focus && !isAutoFocus(request.focus)) {
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

  // Include upcoming events context if provided
  if (request.upcomingEvents && request.upcomingEvents.length > 0) {
    const upcomingDescriptions = request.upcomingEvents.map((event) => {
      const details: string[] = [];
      if (event.allDay) {
        details.push('all-day');
      } else if (event.startsAt) {
        details.push(`starts ${event.startsAt}`);
      }
      if (event.durationMinutes) {
        details.push(`${event.durationMinutes} min`);
      }
      if (event.intensity) {
        details.push(`${event.intensity} intensity`);
      }
      if (event.tags && event.tags.length > 0) {
        details.push(`tags: ${event.tags.join(', ')}`);
      }
      if (event.notes) {
        details.push(`notes: ${event.notes}`);
      }
      return `${event.title} (${event.kind}) on ${event.localDate}${
        details.length > 0 ? `, ${details.join(', ')}` : ''
      }`;
    });
    parts.push(`Upcoming events: ${upcomingDescriptions.join('; ')}.`);
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

  const baselineSummary = buildBaselineWorkoutSummary(request);
  if (baselineSummary) {
    parts.push(baselineSummary);
  }

  const promptData = buildCandidatePoolPromptData(candidatePool);
  if (promptData) {
    parts.push(
      `Candidate pool from exercise library v${promptData.libraryVersion}: ${promptData.exercises.map((exercise) => exercise.name).join(', ')}. ${promptData.instructions}`,
    );
    if (promptData.baselineExerciseIds.length > 0) {
      parts.push(
        `Avoid repeating baseline exercises already used in the prior workout unless necessary.`,
      );
    }
  }

  parts.push('Please generate a new workout that addresses these preferences.');

  return parts.join(' ');
}
