/**
 * Builds a workout generation request from a coach-projected session.
 *
 * The coach projection (see {@link deriveCoachProjection}) produces forward
 * sessions keyed by block ids rather than the single-day recommendation shape.
 * When the user generates a concrete workout from a projected session, the
 * request must carry that session's coach intent (source block, add-on blocks,
 * projection id, and program attribution) so the generated workout stays
 * attributed to the program and the projection can repair around it.
 *
 * This is the projection-session counterpart to `buildAdaptivePlanIntent` in
 * HomeScreen, kept pure and isolated so the Home data layer can build a request
 * locally and so the logic is unit-testable without rendering the screen.
 */

import type {
  AdaptivePlanBlockIntent,
  AdaptivePlanIntent,
  AdaptiveTrainingBlock,
  AdaptiveTrainingPlan,
  CoachProjection,
  CoachProjectedSession,
  CoachSessionDisposition,
  GenerationRequest,
  WorkoutEnergy,
} from '@workout-agent/shared';

const DEFAULT_DURATION_MINUTES = 30;

const toBlockIntent = (
  block: AdaptiveTrainingBlock
): AdaptivePlanBlockIntent => ({
  blockId: block.id,
  label: block.label,
  category: block.category,
  role: block.role,
  stressTags: block.stressTags,
});

const resolveSessionDisposition = (
  session: CoachProjectedSession
): CoachSessionDisposition => {
  switch (session.status) {
    case 'pinned':
      return 'pinned';
    case 'repaired':
      return 'repaired';
    default:
      return 'projected';
  }
};

const sumBlockDurations = (blocks: AdaptiveTrainingBlock[]): number =>
  blocks.reduce((total, block) => total + block.defaultDurationMinutes, 0);

export const buildCoachProjectionAdaptiveIntent = (input: {
  plan: AdaptiveTrainingPlan;
  projection: CoachProjection;
  session: CoachProjectedSession;
  planningDateLocal: string;
}): AdaptivePlanIntent | null => {
  const { plan, projection, session, planningDateLocal } = input;

  if (!session.sourceBlockId) {
    return null;
  }

  const blocksById = new Map(
    plan.blocks.map((block) => [block.id, block] as const)
  );
  const primaryBlock = blocksById.get(session.sourceBlockId);
  if (!primaryBlock) {
    return null;
  }

  const addOnBlocks = session.addOnBlockIds
    .map((blockId) => blocksById.get(blockId))
    .filter((block): block is AdaptiveTrainingBlock => Boolean(block));

  const intentBlockIds = new Set([
    session.sourceBlockId,
    ...session.addOnBlockIds,
  ]);
  const intentSlots = plan.exerciseSlotTemplates.filter((slot) =>
    slot.sourceBlockId ? intentBlockIds.has(slot.sourceBlockId) : false
  );
  const intentSlotIds = new Set(intentSlots.map((slot) => slot.id));
  const intentSlotAssignments = plan.slotAssignments.filter((assignment) =>
    intentSlotIds.has(assignment.slotId)
  );
  const exerciseSlotPolicy =
    intentSlots.length > 0 || intentSlotAssignments.length > 0
      ? {
          slots: intentSlots,
          currentAssignments: intentSlotAssignments,
          overrideReasons: [],
        }
      : undefined;

  return {
    planId: plan.id,
    programVersion: plan.programVersion,
    scheduleStrategy: session.strategy,
    projectionId: session.id,
    planningDateLocal,
    sessionDisposition: resolveSessionDisposition(session),
    sourceTemplateId: plan.sourceTemplateId,
    primaryBlock: toBlockIntent(primaryBlock),
    addOnBlocks: addOnBlocks.map(toBlockIntent),
    targetRangeContext: projection.targetProgress,
    rationale: session.rationale,
    repairRationale: [],
    projectionStatus: session.projectionStatus,
    exerciseSlotPolicy,
  };
};

/**
 * Builds a complete {@link GenerationRequest} for a projected coach session,
 * defaulting duration to the session's planned duration (or the summed block
 * durations) and energy to a moderate session when no override is supplied.
 * Returns null when the session cannot be generated (e.g. a rest projection
 * with no source block).
 */
export const buildCoachProjectionGenerationRequest = (input: {
  plan: AdaptiveTrainingPlan;
  projection: CoachProjection;
  session: CoachProjectedSession;
  planningDateLocal: string;
  durationMinutes?: number;
  energy?: WorkoutEnergy;
  equipment?: string[];
}): GenerationRequest | null => {
  const adaptivePlanIntent = buildCoachProjectionAdaptiveIntent(input);
  if (!adaptivePlanIntent) {
    return null;
  }

  const { plan, session, durationMinutes, energy, equipment } = input;

  const blocksById = new Map(
    plan.blocks.map((block) => [block.id, block] as const)
  );
  const intentBlocks = [session.sourceBlockId, ...session.addOnBlockIds]
    .map((blockId) => (blockId ? blocksById.get(blockId) : undefined))
    .filter((block): block is AdaptiveTrainingBlock => Boolean(block));

  const resolvedDuration =
    durationMinutes ??
    session.durationMinutes ??
    (intentBlocks.length > 0
      ? sumBlockDurations(intentBlocks)
      : DEFAULT_DURATION_MINUTES);

  const request: GenerationRequest = {
    timeMinutes: resolvedDuration,
    energy: energy ?? 'moderate',
    focus: adaptivePlanIntent.primaryBlock.label,
    planningDateLocal: input.planningDateLocal,
    adaptivePlanIntent,
  };

  if (equipment && equipment.length > 0) {
    request.equipment = equipment;
  }

  return request;
};
