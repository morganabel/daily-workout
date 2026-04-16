import {
  isAutoFocus,
  type GenerationRequest,
  type RegenerationFeedback,
} from '@workout-agent/shared';
import type {
  ExerciseCandidatePool,
  PlanningBrief,
  StageOnePlannerArtifact,
} from '@workout-agent-ce/server-core';

export const SYSTEM_PROMPT =
  'You are a concise workout planner. Only reply with valid JSON that matches the schema and never include code fences, explanations, or markdown.';

export const INITIAL_GENERATION_INSTRUCTIONS =
  "Generate a single workout session with at least one block and one exercise per block. Use realistic exercise names and prescriptions. Prioritize user context (history, preferences, environment) when deciding focus, volume, and equipment. Treat user-supplied injuries and avoid lists as hard constraints. Treat planner-generated avoidances as lower-confidence guidance that should not override the user's explicit constraints. If no focus is specified, choose the most appropriate one based on the user context.";

export const STAGE_ONE_PLANNER_SYSTEM_PROMPT =
  'You are an internal workout planning assistant. Return only valid JSON matching the schema. Resolve ambiguity, preserve hard constraints, and give advisory guidance for a final workout-generation model. Do not assemble the full workout.';

export const STAGE_ONE_PLANNER_INSTRUCTIONS =
  'Interpret the request and context, resolve the most likely session intent, note stressors to protect or avoid, and produce concise rerank/prompt guidance for the final workout model. Treat user-supplied injuries and avoid lists as hard constraints. Keep hard constraints server-owned and treat your output as advisory.';

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
      userConstraints: PlanningBrief['userConstraints'];
      plannerAvoidances: string[];
      recentStressorsToAvoid: string[];
      eventProtection?: PlanningBrief['eventProtection'];
      blockIntents: PlanningBrief['blockIntents'];
      regeneration: PlanningBrief['regeneration'];
      variationMode: PlanningBrief['variationMode'];
      stagedPlanning: PlanningBrief['stagedPlanning'];
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
    userConstraints: planningBrief.userConstraints,
    plannerAvoidances: planningBrief.disallowedStressors,
    recentStressorsToAvoid: planningBrief.recentStressorsToAvoid,
    eventProtection: planningBrief.eventProtection,
    blockIntents: planningBrief.blockIntents,
    regeneration: planningBrief.regeneration,
    variationMode: planningBrief.variationMode,
    stagedPlanning: planningBrief.stagedPlanning,
    priorityNotes: planningBrief.priorityNotes,
  };
}

export function buildStageOnePlannerArtifactPromptData(
  artifact?: StageOnePlannerArtifact,
):
  | {
      planningIntent: string;
      confidence: StageOnePlannerArtifact['confidence'];
      resolvedFocus?: string;
      protectStressors: string[];
      avoidStressors: string[];
      styleBiases: string[];
      loadBias?: StageOnePlannerArtifact['loadBias'];
      noveltyTarget?: StageOnePlannerArtifact['noveltyTarget'];
      rerankHints: string[];
      candidateInstructions: string[];
    }
  | undefined {
  if (!artifact) {
    return undefined;
  }

  return {
    planningIntent: artifact.planningIntent,
    confidence: artifact.confidence,
    resolvedFocus: artifact.resolvedFocus,
    protectStressors: artifact.protectStressors,
    avoidStressors: artifact.avoidStressors,
    styleBiases: artifact.styleBiases,
    loadBias: artifact.loadBias,
    noveltyTarget: artifact.noveltyTarget,
    rerankHints: artifact.rerankHints,
    candidateInstructions: artifact.candidateInstructions,
  };
}

export function buildStageOnePlannerRequestPayload(
  request: GenerationRequest,
  planningBrief?: PlanningBrief,
  candidatePool?: ExerciseCandidatePool,
) {
  return {
    request: {
      focus: request.focus,
      timeMinutes: request.timeMinutes,
      equipment: request.equipment,
      energy: request.energy,
      feedback: request.feedback,
      notes: request.notes,
      planningDateLocal: request.planningDateLocal,
      upcomingEvents: request.upcomingEvents,
      baselineWorkout: request.baselineWorkout
        ? {
            focus: request.baselineWorkout.focus,
            durationMinutes: request.baselineWorkout.durationMinutes,
            equipment: request.baselineWorkout.equipment,
            summary: request.baselineWorkout.summary,
          }
        : undefined,
    },
    planningBrief: buildPlanningBriefPromptData(planningBrief),
    candidatePool: buildCandidatePoolPromptData(candidatePool),
    instructions: STAGE_ONE_PLANNER_INSTRUCTIONS,
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
  stageOneArtifact?: StageOnePlannerArtifact,
): string {
  const parts: string[] = [];
  const shouldForceExerciseChanges =
    Boolean(request.baselineWorkout) &&
    (Boolean(
      feedback?.some((item) =>
        ['different-exercises', 'just-try-again', 'too-hard'].includes(item),
      ),
    ) ||
      planningBrief?.variationMode === 'different-exercises' ||
      stageOneArtifact?.noveltyTarget === 'medium' ||
      stageOneArtifact?.noveltyTarget === 'high');

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
    if (planningBrief.userConstraints.avoid.length > 0) {
      parts.push(
        `Hard user avoid list: ${planningBrief.userConstraints.avoid.join(', ')}. Treat these as hard constraints and do not include them.`,
      );
    }
    if (planningBrief.userConstraints.injuries.length > 0) {
      parts.push(
        `Hard user injury context: ${planningBrief.userConstraints.injuries.join(', ')}. Treat these as hard constraints and keep the workout safely away from aggravating patterns.`,
      );
    }
    if (planningBrief.disallowedStressors.length > 0) {
      parts.push(
        `Planner-generated avoidances: ${planningBrief.disallowedStressors.join(', ')}. Use these as lower-confidence guidance unless they conflict with the user's explicit constraints.`,
      );
    }
    if (planningBrief.eventProtection) {
      parts.push(
        `Protect freshness for ${planningBrief.eventProtection.title} on ${planningBrief.eventProtection.localDate}.`,
      );
    }
  }

  if (stageOneArtifact) {
    parts.push(
      `Planner intent: ${stageOneArtifact.planningIntent}. Confidence: ${stageOneArtifact.confidence}.`,
    );
    if (stageOneArtifact.resolvedFocus) {
      parts.push(`Planner-resolved focus: ${stageOneArtifact.resolvedFocus}.`);
    }
    if (stageOneArtifact.avoidStressors.length > 0) {
      parts.push(
        `Planner avoid stressors: ${stageOneArtifact.avoidStressors.join(', ')}.`,
      );
    }
    if (stageOneArtifact.noveltyTarget) {
      parts.push(`Novelty target: ${stageOneArtifact.noveltyTarget}.`);
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

  if (shouldForceExerciseChanges) {
    parts.push(
      'When viable alternatives exist, make meaningful exercise changes that are proportional to the feedback. If only one or two baseline exercises are the problem, it is acceptable to replace only those exercises and keep the rest of the workout aligned to the original intent. Do not just reshuffle the exact same full exercise list into new blocks or lightly rewrite prescriptions/details when the user is asking for a real change.',
    );
    if (promptData?.baselineExerciseIds.length) {
      parts.push(
        'Prefer unused exercises from the candidate pool before falling back to any baseline exercise.',
      );
    }
  }

  parts.push('Please generate a new workout that addresses these preferences.');

  return parts.join(' ');
}
