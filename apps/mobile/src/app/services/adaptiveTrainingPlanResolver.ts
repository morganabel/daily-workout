import type {
  AdaptivePlanRecommendation,
  AdaptivePlanTargetProgress,
  AdaptiveRecommendationRationale,
  AdaptiveTrainingBlock,
  AdaptiveTrainingPlan,
  UpcomingEventContext,
  WorkoutSessionSummary,
} from '@workout-agent/shared';
import { adaptivePlanRecommendationSchema } from '@workout-agent/shared';
import { parseLocalDate } from '../utils/date';

export type AdaptiveTrainingPlanResolverInput = {
  plan: AdaptiveTrainingPlan;
  planningDateLocal: string;
  recentSessions: WorkoutSessionSummary[];
  upcomingEvents?: UpcomingEventContext[];
  availableTimeMinutes?: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

const normalize = (value: string): string => value.trim().toLowerCase();

const daysBetween = (leftLocalDate: string, rightTime: number): number => {
  const left = parseLocalDate(leftLocalDate).getTime();
  return Math.floor((left - rightTime) / DAY_MS);
};

const sessionMatchesBlock = (
  session: WorkoutSessionSummary,
  block: AdaptiveTrainingBlock
): boolean => {
  const focus = normalize(session.focus);
  const name = normalize(session.name);
  const labels = [block.id, block.label, block.role, block.category].map(normalize);

  return labels.some((label) => focus.includes(label) || name.includes(label));
};

const getBlockById = (
  plan: AdaptiveTrainingPlan,
  blockId: string
): AdaptiveTrainingBlock | undefined =>
  plan.blocks.find((block) => block.id === blockId);

const getRecentBlockIds = (
  plan: AdaptiveTrainingPlan,
  recentSessions: WorkoutSessionSummary[]
): string[] =>
  recentSessions
    .map((session) => plan.blocks.find((block) => sessionMatchesBlock(session, block)))
    .filter((block): block is AdaptiveTrainingBlock => Boolean(block))
    .map((block) => block.id);

export const computeAdaptiveTargetProgress = (
  input: Pick<
    AdaptiveTrainingPlanResolverInput,
    'plan' | 'planningDateLocal' | 'recentSessions'
  >
): AdaptivePlanTargetProgress[] => {
  return input.plan.targetRanges.map((target) => {
    const count = input.recentSessions.reduce((total, session) => {
      const completedAt = Date.parse(session.completedAt);
      if (!Number.isFinite(completedAt)) {
        return total;
      }

      const ageDays = daysBetween(input.planningDateLocal, completedAt);
      if (ageDays < 0 || ageDays >= target.windowDays) {
        return total;
      }

      const matchingBlock = input.plan.blocks.find((block) => {
        if (!sessionMatchesBlock(session, block)) {
          return false;
        }
        if (target.appliesTo.blockIds.includes(block.id)) {
          return true;
        }
        if (target.appliesTo.categories.includes(block.category)) {
          return true;
        }
        return block.stressTags.some((tag) =>
          target.appliesTo.stressTags.includes(tag)
        );
      });

      if (!matchingBlock) {
        return total;
      }

      const contribution = matchingBlock.targetContributions.find(
        (item) => item.targetId === target.id
      );

      return total + (contribution?.count ?? 1);
    }, 0);

    return {
      targetId: target.id,
      label: target.label,
      count,
      minCount: target.minCount,
      maxCount: target.maxCount,
      windowDays: target.windowDays,
    };
  });
};

const eventStressesLowerBody = (event: UpcomingEventContext): boolean => {
  const searchable = [
    event.kind,
    event.title,
    event.intensity,
    event.notes,
    ...(event.tags ?? []),
  ]
    .filter((value): value is string => Boolean(value))
    .map(normalize)
    .join(' ');

  return (
    searchable.includes('hike') ||
    searchable.includes('run') ||
    searchable.includes('sport') ||
    searchable.includes('lower') ||
    searchable.includes('leg') ||
    searchable.includes('high')
  );
};

const hasProtectedLowerBodyEventSoon = (
  input: AdaptiveTrainingPlanResolverInput
): boolean => {
  const protectDays = input.plan.recommendationSettings.protectUpcomingLowerBodyDays;
  return (input.upcomingEvents ?? []).some((event) => {
    const daysUntil = daysBetween(event.localDate, parseLocalDate(input.planningDateLocal).getTime());
    return daysUntil > 0 && daysUntil <= protectDays && eventStressesLowerBody(event);
  });
};

const hasLowerBodyStress = (block: AdaptiveTrainingBlock): boolean =>
  block.stressTags.some((tag) =>
    ['lower-body', 'high-impact', 'heavy'].includes(normalize(tag))
  );

const getPreferredBlockForDate = (
  input: AdaptiveTrainingPlanResolverInput
): string | undefined => {
  const weekdayIndex = parseLocalDate(input.planningDateLocal).getDay();
  const weekday = [
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
  ][weekdayIndex];
  return input.plan.typicalWeekPreferences.find(
    (preference) => preference.dayOfWeek === weekday
  )?.preferredBlockIds[0];
};

const getNextRotationBlockId = (
  plan: AdaptiveTrainingPlan,
  recentBlockIds: string[]
): string | undefined => {
  const rotation = plan.recommendationSettings.preferredRotationBlockIds;
  if (!rotation.length) {
    return undefined;
  }

  const lastRotationBlock = recentBlockIds.find((blockId) =>
    rotation.includes(blockId)
  );
  if (!lastRotationBlock) {
    return rotation[0];
  }

  const nextIndex = (rotation.indexOf(lastRotationBlock) + 1) % rotation.length;
  return rotation[nextIndex];
};

const scoreTargetNeed = (
  block: AdaptiveTrainingBlock,
  targetProgress: AdaptivePlanTargetProgress[]
): number =>
  block.targetContributions.reduce((score, contribution) => {
    const target = targetProgress.find(
      (item) => item.targetId === contribution.targetId
    );
    if (!target) {
      return score;
    }
    if (target.count < target.minCount) {
      return Math.max(score, 50);
    }
    if (target.count < target.maxCount) {
      return Math.max(score, 15);
    }
    return Math.min(score, -35);
  }, 0);

const scorePrimaryBlock = (
  block: AdaptiveTrainingBlock,
  input: AdaptiveTrainingPlanResolverInput,
  targetProgress: AdaptivePlanTargetProgress[],
  recentBlockIds: string[]
): number => {
  let score = block.category === 'rest' ? -20 : 0;
  score += scoreTargetNeed(block, targetProgress);

  if (block.id === getNextRotationBlockId(input.plan, recentBlockIds)) {
    score += 25;
  }
  if (block.id === getPreferredBlockForDate(input)) {
    score += 12;
  }
  if (recentBlockIds[0] === block.id) {
    score -= 30;
  }
  if (hasProtectedLowerBodyEventSoon(input) && hasLowerBodyStress(block)) {
    score -= 100;
  }
  if (input.availableTimeMinutes && block.defaultDurationMinutes > input.availableTimeMinutes) {
    score -= 20;
  }

  return score;
};

const chooseAddOns = (
  primary: AdaptiveTrainingBlock,
  input: AdaptiveTrainingPlanResolverInput,
  targetProgress: AdaptivePlanTargetProgress[]
): AdaptiveTrainingBlock[] => {
  if (!input.plan.recommendationSettings.allowCompatibleAddOns) {
    return [];
  }

  const availableMinutes = input.availableTimeMinutes ?? primary.defaultDurationMinutes;
  const remainingMinutes = availableMinutes - primary.defaultDurationMinutes;
  if (remainingMinutes < 10) {
    return [];
  }

  return primary.compatibleAddOnBlockIds
    .map((blockId) => getBlockById(input.plan, blockId))
    .filter((block): block is AdaptiveTrainingBlock => Boolean(block))
    .filter((block) => !primary.conflictsWithBlockIds.includes(block.id))
    .filter((block) => !block.conflictsWithBlockIds.includes(primary.id))
    .filter((block) => block.defaultDurationMinutes <= remainingMinutes)
    .map((block) => ({ block, score: scoreTargetNeed(block, targetProgress) }))
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 1)
    .map((candidate) => candidate.block);
};

export const resolveAdaptiveTrainingRecommendation = (
  input: AdaptiveTrainingPlanResolverInput
): AdaptivePlanRecommendation => {
  const activeBlocks = input.plan.blocks.filter(
    (block) => block.category !== 'accessory'
  );
  const targetProgress = computeAdaptiveTargetProgress(input);
  const pinnedSession = input.plan.sessionPreferences.find(
    (session) =>
      session.status === 'pinned' && session.localDate === input.planningDateLocal
  );
  const pinnedPrimaryBlockId = pinnedSession?.blockIds[0];
  const pinnedPrimary = pinnedSession
    ? pinnedPrimaryBlockId
      ? getBlockById(input.plan, pinnedPrimaryBlockId)
      : undefined
    : undefined;
  if (pinnedSession && pinnedPrimary) {
    const pinnedAddOns = pinnedSession.blockIds
      .slice(1)
      .map((blockId) => getBlockById(input.plan, blockId))
      .filter((block): block is AdaptiveTrainingBlock => Boolean(block));

    return adaptivePlanRecommendationSchema.parse({
      id: `${input.plan.id}-${input.planningDateLocal}-${pinnedPrimary.id}-pinned`,
      planId: input.plan.id,
      planningDateLocal: input.planningDateLocal,
      primaryBlockId: pinnedPrimary.id,
      addOnBlockIds: pinnedAddOns.map((block) => block.id),
      alternativeBlockIds: activeBlocks
        .map((block) => block.id)
        .filter((blockId) => !pinnedSession.blockIds.includes(blockId))
        .slice(0, 3),
      targetProgress,
      rationale: [
        {
          code: 'pinned-session',
          message: `${pinnedPrimary.label} is pinned for this date.`,
        },
      ],
      coachNotes: ['Pinned sessions are preserved until you change them.'],
      projectionStatus: 'pinned',
    });
  }
  const recentBlockIds = getRecentBlockIds(input.plan, input.recentSessions);
  const scoredBlocks = activeBlocks
    .map((block) => ({
      block,
      score: scorePrimaryBlock(block, input, targetProgress, recentBlockIds),
    }))
    .sort((left, right) => right.score - left.score);
  const primary = scoredBlocks[0]?.block ?? input.plan.blocks[0];
  const addOns = chooseAddOns(primary, input, targetProgress);
  const rationale: AdaptiveRecommendationRationale[] = [
    {
      code: 'structured-plan',
      message: `Recommended ${primary.label} from your adaptive plan rhythm.`,
    },
  ];
  const coachNotes: string[] = [];

  const targetGap = targetProgress.find((target) => target.count < target.minCount);
  if (targetGap) {
    rationale.push({
      code: 'target-gap',
      message: `${targetGap.label} is below the ${targetGap.minCount}-${targetGap.maxCount} target range.`,
    });
  }

  if (hasProtectedLowerBodyEventSoon(input)) {
    coachNotes.push(
      'Adjusted away from heavy lower-body stress to protect an upcoming event.'
    );
  }

  const recommendation = {
    id: `${input.plan.id}-${input.planningDateLocal}-${primary.id}`,
    planId: input.plan.id,
    planningDateLocal: input.planningDateLocal,
    primaryBlockId: primary.id,
    addOnBlockIds: addOns.map((block) => block.id),
    alternativeBlockIds: scoredBlocks
      .map((candidate) => candidate.block.id)
      .filter((blockId) => blockId !== primary.id)
      .slice(0, 3),
    targetProgress,
    rationale,
    coachNotes,
    projectionStatus: 'projected' as const,
  };

  return adaptivePlanRecommendationSchema.parse(recommendation);
};
