import {
  isAutoFocus,
  type GenerationContext,
  type GenerationRequest,
  type RegenerationFeedback,
} from '@leveza/shared';
import type {
  CatalogSeed,
  ExerciseCandidatePool,
  PlanningBrief,
  StageOnePlannerArtifact,
} from '@leveza/server-core';

export const SYSTEM_PROMPT =
  'You are a concise workout planner. Only reply with valid JSON that matches the schema and never include code fences, explanations, or markdown.';

export const CLASSIC_STRENGTH_GUIDANCE =
  'For strength-oriented sessions, bias toward classic, broadly recognized strength movements before novelty variations: squat, hinge/deadlift, bench or push-up, overhead press, row, pull-up/chin-up, lunge, carry, and simple accessory curls/extensions. Use exotic or highly specialized exercise variants only when they clearly solve a constraint, equipment limitation, or explicit user request.';

export const GYM_STRENGTH_EQUIPMENT_GUIDANCE =
  'When Gym is available for strength work, prioritize barbell, dumbbell, cable/machine, bench/rack, and bodyweight compound movements. Use resistance-band exercises sparingly, mainly for warm-up, assistance, or prehab, not as the backbone of the session.';

export const INITIAL_GENERATION_INSTRUCTIONS = `Generate a single workout session with at least one block and one exercise per block. Use realistic exercise names and prescriptions. Prefer the planning brief when present, otherwise use the request and context as the source of truth for focus, duration, equipment, and constraints. Prefer exercises from the candidate pool when one is provided. When exerciseSlotPolicy is present, preserve stable and user-locked current assignments when they remain compatible with hard constraints, allow coach-rotatable slots to vary within eligible movement criteria, and honor slot overrideReasons instead of forcing blocked assignments. When a stage-one planner selectionIntent or candidateInstructions are present, use them to decide which candidate roles should be emphasized for this specific context; do not force every role if the planner or user context indicates a push-biased, pull-biased, accessory-biased, or constraint-limited session. ${CLASSIC_STRENGTH_GUIDANCE} ${GYM_STRENGTH_EQUIPMENT_GUIDANCE} Treat user-supplied injuries and avoid lists as hard constraints. Treat planner-generated avoidances as lower-confidence guidance that should not override the user's explicit constraints. If no focus is specified, choose the most appropriate one from the available planning data.`;

export const STAGE_ONE_PLANNER_SYSTEM_PROMPT =
  'You are an internal workout planning assistant. Return only valid JSON matching the schema. Resolve ambiguity, preserve hard constraints, and give advisory guidance for a final workout-generation model. Do not assemble the full workout.';

export const STAGE_ONE_PLANNER_INSTRUCTIONS =
  'Interpret the request and context, resolve the most likely session intent, note stressors to protect or avoid, and produce concise rerank/prompt guidance for the final workout model. If exerciseSlotPolicy is present, preserve stable or user-locked assignments that have no overrideReasons, allow coach-rotatable slots to vary for novelty or recovery, and never broaden beyond deterministic hard constraints. Choose selectionIntent contextually: use balanced_upper for general upper-body strength or hypertrophy when push and upper-back pull are both appropriate; push_biased for chest/shoulders/push-day intent or when pull is contextually undesirable; pull_biased for back/posture/pull-day intent; accessory_biased for arms/shoulders/pump emphasis; constraint_limited when equipment, injuries, avoid lists, or recent/upcoming stressors make normal role coverage inappropriate. For strength-oriented sessions, steer the final model toward classic, broadly recognized strength exercises over novelty variants. For gym strength, avoid making bands the main training tool unless the user asks for that. Treat user-supplied injuries and avoid lists as hard constraints. Keep hard constraints server-owned and treat your output as advisory.';

const MAX_PROMPT_CANDIDATE_EXERCISES = 64;

type CandidatePromptExercise = {
  id: string;
  name: string;
  requiredEquipment?: string[];
  focusTags?: string[];
  movementTags?: string[];
  loadLevel?: 'light' | 'moderate' | 'heavy';
};

export function buildCandidatePoolPromptData(
  candidatePool?: ExerciseCandidatePool
):
  | {
      libraryVersion: string;
      totalEligibleCount: number;
      searchText?: string;
      baselineExerciseIds: string[];
      exercises?: CandidatePromptExercise[];
      buckets?: Array<{
        key: string;
        title: string;
        quota: number;
        availableCount: number;
        selectedCount: number;
        shortfall: number;
        exercises: CandidatePromptExercise[];
      }>;
      instructions: string;
    }
  | undefined {
  if (!candidatePool) {
    return undefined;
  }

  const buckets = candidatePool.candidateBuckets?.length
    ? buildCandidateBucketPromptData(candidatePool)
    : undefined;
  const exercises = buckets
    ? undefined
    : candidatePool.candidateExercises
        .slice(0, MAX_PROMPT_CANDIDATE_EXERCISES)
        .map(formatCandidatePromptExercise);

  return {
    libraryVersion: candidatePool.libraryVersion,
    totalEligibleCount: candidatePool.totalEligibleCount,
    searchText: candidatePool.searchText,
    baselineExerciseIds: candidatePool.baselineExerciseIds,
    ...(exercises ? { exercises } : {}),
    buckets,
    instructions:
      'Prefer exercises from this candidate pool unless there is a strong reason not to. Treat it as a bounded high-confidence set chosen from the exercise library after applying hard constraints. Candidate buckets are available roles, and exercises are ranked within each bucket. Use the planning brief and any stage-one selectionIntent to decide which roles fit this context; buckets are not unconditional requirements. Bucket shortfalls mean that role is thin for the selected equipment or constraints. For strength work, prefer classic compound and simple accessory exercises within the relevant bucket over obscure variations. For gym strength, avoid overusing resistance-band candidates when loaded gym alternatives are available. Do not mention the candidate pool in the final response.',
  };
}

function buildCandidateBucketPromptData(candidatePool: ExerciseCandidatePool) {
  const buckets: NonNullable<
    ReturnType<typeof buildCandidatePoolPromptData>
  >['buckets'] = [];
  let remaining = MAX_PROMPT_CANDIDATE_EXERCISES;

  for (const bucket of candidatePool.candidateBuckets ?? []) {
    if (remaining <= 0) {
      break;
    }

    const exercises = bucket.candidateExercises
      .slice(0, remaining)
      .map(formatCandidatePromptExercise);

    buckets.push({
      key: bucket.key,
      title: bucket.title,
      quota: bucket.quota,
      availableCount: bucket.availableCount,
      selectedCount: exercises.length,
      shortfall: bucket.shortfall,
      exercises,
    });
    remaining -= exercises.length;
  }

  return buckets.length ? buckets : undefined;
}

function formatCandidatePromptExercise(
  candidate: ExerciseCandidatePool['candidateExercises'][number]
): CandidatePromptExercise {
  const { id, name, requiredEquipment, focusTags, movementTags, loadLevel } =
    candidate;

  return {
    id,
    name,
    ...(requiredEquipment?.length ? { requiredEquipment } : {}),
    ...(focusTags?.length ? { focusTags } : {}),
    ...(movementTags?.length ? { movementTags } : {}),
    ...(loadLevel ? { loadLevel } : {}),
  };
}

export function buildPlanningBriefPromptData(planningBrief?: PlanningBrief):
  | {
      resolvedFocus: string;
      focusMode: PlanningBrief['focusMode'];
      durationMinutes: number;
      loadCeiling: PlanningBrief['loadCeiling'];
      availableEquipment: string[];
      styleBias?: PlanningBrief['styleBias'];
      primaryGoal?: PlanningBrief['primaryGoal'];
      userConstraints: PlanningBrief['userConstraints'];
      plannerAvoidances: string[];
      recentStressorsToAvoid: string[];
      eventProtection?: PlanningBrief['eventProtection'];
      adaptivePlanIntent?: PlanningBrief['adaptivePlanIntent'];
      exerciseSlotPolicy?: PlanningBrief['exerciseSlotPolicy'];
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

  const adaptivePlanIntent = usesAdaptiveBlockIntents(planningBrief)
    ? planningBrief.adaptivePlanIntent
    : undefined;

  return {
    resolvedFocus: planningBrief.resolvedFocus,
    focusMode: planningBrief.focusMode,
    durationMinutes: planningBrief.durationMinutes,
    loadCeiling: planningBrief.loadCeiling,
    availableEquipment: planningBrief.availableEquipment,
    styleBias: planningBrief.styleBias,
    primaryGoal: planningBrief.primaryGoal,
    userConstraints: planningBrief.userConstraints,
    plannerAvoidances: planningBrief.disallowedStressors,
    recentStressorsToAvoid: planningBrief.recentStressorsToAvoid,
    eventProtection: planningBrief.eventProtection,
    adaptivePlanIntent,
    exerciseSlotPolicy: planningBrief.exerciseSlotPolicy,
    blockIntents: planningBrief.blockIntents,
    regeneration: planningBrief.regeneration,
    variationMode: planningBrief.variationMode,
    stagedPlanning: planningBrief.stagedPlanning,
    priorityNotes: planningBrief.priorityNotes,
  };
}

export function buildStageOnePlannerArtifactPromptData(
  artifact?: StageOnePlannerArtifact
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
      selectionIntent?: StageOnePlannerArtifact['selectionIntent'];
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
    selectionIntent: artifact.selectionIntent,
    rerankHints: artifact.rerankHints,
    candidateInstructions: artifact.candidateInstructions,
  };
}

export function buildStageOnePlannerRequestPayload(
  request: GenerationRequest,
  planningBrief?: PlanningBrief,
  candidatePool?: ExerciseCandidatePool
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
      adaptivePlanIntent: request.adaptivePlanIntent,
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

export function buildInitialGenerationPromptPayload(
  request: GenerationRequest,
  context: GenerationContext,
  planningBrief?: PlanningBrief,
  candidatePool?: ExerciseCandidatePool,
  stageOneArtifact?: StageOnePlannerArtifact,
  catalogSeed?: CatalogSeed
) {
  const payload = {
    planningBrief: buildPlanningBriefPromptData(planningBrief),
    stageOnePlanner: buildStageOnePlannerArtifactPromptData(stageOneArtifact),
    candidatePool: buildCandidatePoolPromptData(candidatePool),
    catalogSeed,
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
  request: GenerationRequest
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
  catalogSeed?: CatalogSeed
): string {
  const parts: string[] = [];
  const shouldForceExerciseChanges =
    Boolean(request.baselineWorkout) &&
    (Boolean(
      feedback?.some((item) =>
        ['different-exercises', 'just-try-again', 'too-hard'].includes(item)
      )
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
      `Resolved session intent: ${planningBrief.resolvedFocus}. Load ceiling: ${planningBrief.loadCeiling}.`
    );
    if (planningBrief.userConstraints.avoid.length > 0) {
      parts.push(
        `Hard user avoid list: ${planningBrief.userConstraints.avoid.join(
          ', '
        )}. Treat these as hard constraints and do not include them.`
      );
    }
    if (planningBrief.userConstraints.injuries.length > 0) {
      parts.push(
        `Hard user injury context: ${planningBrief.userConstraints.injuries.join(
          ', '
        )}. Treat these as hard constraints and keep the workout safely away from aggravating patterns.`
      );
    }
    if (planningBrief.disallowedStressors.length > 0) {
      parts.push(
        `Planner-generated avoidances: ${planningBrief.disallowedStressors.join(
          ', '
        )}. Use these as lower-confidence guidance unless they conflict with the user's explicit constraints.`
      );
    }
    if (planningBrief.eventProtection) {
      parts.push(
        `Protect freshness for ${planningBrief.eventProtection.title} on ${planningBrief.eventProtection.localDate}.`
      );
    }
    if (
      planningBrief.adaptivePlanIntent &&
      usesAdaptiveBlockIntents(planningBrief)
    ) {
      parts.push(formatAdaptivePlanIntent(planningBrief.adaptivePlanIntent));
    }
    if (planningBrief.exerciseSlotPolicy) {
      parts.push(formatExerciseSlotPolicyPromptText(planningBrief));
    }
  }

  if (stageOneArtifact) {
    parts.push(
      `Planner intent: ${stageOneArtifact.planningIntent}. Confidence: ${stageOneArtifact.confidence}.`
    );
    if (stageOneArtifact.resolvedFocus) {
      parts.push(`Planner-resolved focus: ${stageOneArtifact.resolvedFocus}.`);
    }
    if (stageOneArtifact.avoidStressors.length > 0) {
      parts.push(
        `Planner avoid stressors: ${stageOneArtifact.avoidStressors.join(
          ', '
        )}.`
      );
    }
    if (stageOneArtifact.noveltyTarget) {
      parts.push(`Novelty target: ${stageOneArtifact.noveltyTarget}.`);
    }
    if (stageOneArtifact.selectionIntent) {
      parts.push(`Selection intent: ${stageOneArtifact.selectionIntent}.`);
    }
    if (stageOneArtifact.candidateInstructions.length > 0) {
      parts.push(
        `Candidate selection guidance: ${stageOneArtifact.candidateInstructions.join(
          '; '
        )}.`
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
        'The instructions below are free form feedback from the user. Treat the instructions below as the single source of truth. Override any prior context or workout details when there is a conflict.'
      );
    } else {
      parts.push(
        'Prioritize the user instructions below over any previous context or the earlier workout. If there is a conflict, follow the new instructions.'
      );
    }
    parts.push(`User explicit instructions: ${request.notes}`);
  }

  if (!planningBrief && request.adaptivePlanIntent) {
    parts.push(formatAdaptivePlanIntent(request.adaptivePlanIntent));
    if (request.adaptivePlanIntent.exerciseSlotPolicy) {
      parts.push(
        formatExerciseSlotPolicyPromptText({
          exerciseSlotPolicy: request.adaptivePlanIntent.exerciseSlotPolicy,
        })
      );
    }
  }

  const baselineSummary = buildBaselineWorkoutSummary(request);
  if (baselineSummary) {
    parts.push(baselineSummary);
  }

  const promptData = buildCandidatePoolPromptData(candidatePool);
  if (promptData) {
    const formattedExercises = promptData.buckets?.length
      ? promptData.buckets
          .map((bucket) => {
            const shortfall =
              bucket.shortfall > 0 ? `; shortfall ${bucket.shortfall}` : '';
            return `${bucket.title} (${bucket.selectedCount}/${
              bucket.quota
            }${shortfall}): ${bucket.exercises
              .map(formatCandidateForTextPrompt)
              .join(', ')}`;
          })
          .join('; ')
      : (promptData.exercises ?? [])
          .map(formatCandidateForTextPrompt)
          .join(', ');

    parts.push(
      `Candidate pool from exercise library v${promptData.libraryVersion}: ${formattedExercises}. ${promptData.instructions}`
    );
    if (promptData.baselineExerciseIds.length > 0) {
      parts.push(
        `Avoid repeating baseline exercises already used in the prior workout unless necessary.`
      );
    }
  }

  if (catalogSeed) {
    parts.push(formatCatalogSeedPromptText(catalogSeed));
  }

  if (shouldForceExerciseChanges) {
    parts.push(
      'When viable alternatives exist, make meaningful exercise changes that are proportional to the feedback. If only one or two baseline exercises are the problem, it is acceptable to replace only those exercises and keep the rest of the workout aligned to the original intent. Do not just reshuffle the exact same full exercise list into new blocks or lightly rewrite prescriptions/details when the user is asking for a real change.'
    );
    if (promptData?.baselineExerciseIds.length) {
      parts.push(
        'Prefer unused exercises from the candidate pool before falling back to any baseline exercise.'
      );
    }
  }

  parts.push(CLASSIC_STRENGTH_GUIDANCE);
  parts.push(GYM_STRENGTH_EQUIPMENT_GUIDANCE);

  parts.push('Please generate a new workout that addresses these preferences.');

  return parts.join(' ');
}

function formatCandidateForTextPrompt(
  exercise: CandidatePromptExercise
): string {
  const details = [
    exercise.requiredEquipment?.length
      ? exercise.requiredEquipment.join(', ')
      : undefined,
    exercise.movementTags?.length
      ? `movement: ${exercise.movementTags.join('/')}`
      : undefined,
    exercise.focusTags?.length
      ? `focus: ${exercise.focusTags.join('/')}`
      : undefined,
    exercise.loadLevel ? `load: ${exercise.loadLevel}` : undefined,
  ].filter(Boolean);

  return details.length
    ? `${exercise.name} (${details.join('; ')})`
    : exercise.name;
}

function formatCatalogSeedPromptText(catalogSeed: CatalogSeed): string {
  const blockSummaries = catalogSeed.blocks
    .map((block) => {
      const exercises = block.exercises
        .map((exercise) => exercise.name)
        .join(', ');
      return `${block.title}: ${exercises}`;
    })
    .join('; ');

  return [
    `Catalog seed intent: ${catalogSeed.focus}, ${
      catalogSeed.durationMinutes
    } minutes, ${
      catalogSeed.energy
    } energy, equipment ${catalogSeed.equipment.join(', ')}.`,
    `Catalog seed blocks: ${blockSummaries}.`,
    catalogSeed.instructions,
  ].join(' ');
}

function formatAdaptivePlanIntent(
  adaptivePlanIntent: NonNullable<GenerationRequest['adaptivePlanIntent']>
): string {
  const addOns = adaptivePlanIntent.addOnBlocks.map((block) => block.label);
  const pieces = [`primary ${adaptivePlanIntent.primaryBlock.label}`];
  if (addOns.length > 0) {
    pieces.push(`add-ons ${addOns.join(', ')}`);
  }
  if (adaptivePlanIntent.rationale.length > 0) {
    pieces.push(
      `rationale ${adaptivePlanIntent.rationale
        .map((item) => item.message)
        .join(' ')}`
    );
  }

  return `Adaptive plan intent: ${pieces.join('; ')}.`;
}

function formatExerciseSlotPolicyPromptText(
  source: Pick<PlanningBrief, 'exerciseSlotPolicy'>
): string {
  const policy = source.exerciseSlotPolicy;
  if (!policy) {
    return '';
  }

  const assignmentLabelsBySlotId = new Map<string, string[]>();
  policy.currentAssignments.forEach((assignment) => {
    const label =
      assignment.exerciseName ?? assignment.exerciseId ?? 'current assignment';
    assignmentLabelsBySlotId.set(assignment.slotId, [
      ...(assignmentLabelsBySlotId.get(assignment.slotId) ?? []),
      label,
    ]);
  });
  const slotIds = new Set(policy.slots.map((slot) => slot.id));
  const overrideBySlotId = new Map(
    policy.overrideReasons.map((reason) => [reason.slotId, reason])
  );
  const slotSummaries = policy.slots.slice(0, 8).map((slot) => {
    const assignments = assignmentLabelsBySlotId.get(slot.id) ?? [];
    const assignmentText = assignments.join(', ');
    const override = overrideBySlotId.get(slot.id);
    const action =
      slot.stabilityPolicy === 'coach-rotatable'
        ? 'may rotate'
        : override
        ? `replace because ${override.code}`
        : 'preserve if viable';
    return `${slot.label} (${slot.stabilityPolicy}${
      assignmentText ? `, ${assignmentText}` : ''
    }): ${action}`;
  });

  const orphanAssignments = policy.currentAssignments
    .filter((assignment) => !slotIds.has(assignment.slotId))
    .slice(0, 4)
    .map(
      (assignment) =>
        `${assignment.slotId}: ${
          assignment.exerciseName ??
          assignment.exerciseId ??
          'current assignment'
        }`
    );

  const pieces = [
    ...slotSummaries,
    ...orphanAssignments.map((assignment) => `unmatched ${assignment}`),
  ];

  if (pieces.length === 0) {
    return 'Exercise slot policy: no active slots.';
  }

  return `Exercise slot policy: ${pieces.join('; ')}.`;
}

function usesAdaptiveBlockIntents(planningBrief: PlanningBrief): boolean {
  return planningBrief.blockIntents.some((block) =>
    block.key.startsWith('adaptive-')
  );
}
