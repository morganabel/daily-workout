import type {
  AdaptivePlanRecommendation,
  AdaptivePlanTargetProgress,
  AdaptiveRecommendationRationale,
  AdaptiveTrainingBlock,
  AdaptiveTrainingPlan,
  AdaptiveTrainingTargetPriority,
  UpcomingEventContext,
  WorkoutSessionSummary,
} from '@workout-agent/shared';
import { adaptivePlanRecommendationSchema } from '@workout-agent/shared';
import { formatLocalDate, parseLocalDate } from '../utils/date';

export type AdaptiveTrainingPlanResolverInput = {
  plan: AdaptiveTrainingPlan;
  planningDateLocal: string;
  recentSessions: WorkoutSessionSummary[];
  upcomingEvents?: UpcomingEventContext[];
  availableTimeMinutes?: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const RECOVERY_STRESS_WINDOW_DAYS = 3;

const normalize = (value: string): string => value.trim().toLowerCase();

const normalizeTag = (value: string): string =>
  normalize(value).replace(/_/g, '-');

type RecentBlockContext = {
  block: AdaptiveTrainingBlock;
  ageDays: number;
};

type ScoreReason = {
  code: string;
  message: string;
};

type ScoredBlock = {
  block: AdaptiveTrainingBlock;
  score: number;
  reasons: ScoreReason[];
};

const daysBetweenLocalDates = (
  leftLocalDate: string,
  rightLocalDate: string
): number => {
  const left = parseLocalDate(leftLocalDate).getTime();
  const right = parseLocalDate(rightLocalDate).getTime();
  return Math.floor((left - right) / DAY_MS);
};

const sessionMatchesBlock = (
  session: WorkoutSessionSummary,
  block: AdaptiveTrainingBlock
): boolean => {
  const focus = normalize(session.focus);
  const name = normalize(session.name);
  const labels = [block.id, block.label, block.role].map(normalize);

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
    .filter((session) => !session.archivedAt)
    .map((session) =>
      plan.blocks.find((block) => sessionMatchesBlock(session, block))
    )
    .filter((block): block is AdaptiveTrainingBlock => Boolean(block))
    .map((block) => block.id);

const getRecentBlockContexts = (
  input: Pick<
    AdaptiveTrainingPlanResolverInput,
    'plan' | 'planningDateLocal' | 'recentSessions'
  >
): RecentBlockContext[] =>
  input.recentSessions
    .filter((session) => !session.archivedAt)
    .map((session) => {
      const completedAt = Date.parse(session.completedAt);
      if (!Number.isFinite(completedAt)) {
        return null;
      }

      const ageDays = daysBetweenLocalDates(
        input.planningDateLocal,
        formatLocalDate(new Date(completedAt))
      );
      if (ageDays < 0 || ageDays > RECOVERY_STRESS_WINDOW_DAYS) {
        return null;
      }

      const block = input.plan.blocks.find((candidate) =>
        sessionMatchesBlock(session, candidate)
      );

      return block ? { block, ageDays } : null;
    })
    .filter((context): context is RecentBlockContext => Boolean(context));

export const computeAdaptiveTargetProgress = (
  input: Pick<
    AdaptiveTrainingPlanResolverInput,
    'plan' | 'planningDateLocal' | 'recentSessions'
  >
): AdaptivePlanTargetProgress[] => {
  return input.plan.targetRanges.map((target) => {
    const count = input.recentSessions.reduce((total, session) => {
      if (session.archivedAt) {
        return total;
      }

      const completedAt = Date.parse(session.completedAt);
      if (!Number.isFinite(completedAt)) {
        return total;
      }

      const ageDays = daysBetweenLocalDates(
        input.planningDateLocal,
        formatLocalDate(new Date(completedAt))
      );
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

const getEventSearchText = (event: UpcomingEventContext): string =>
  [event.kind, event.title, event.intensity, event.notes, ...(event.tags ?? [])]
    .filter((value): value is string => Boolean(value))
    .map(normalizeTag)
    .join(' ');

const getProtectedEventStressTags = (
  input: AdaptiveTrainingPlanResolverInput
): string[] => {
  const protectDays =
    input.plan.recommendationSettings.protectUpcomingLowerBodyDays;
  const tags = new Set<string>();

  (input.upcomingEvents ?? []).forEach((event) => {
    const daysUntil = daysBetweenLocalDates(
      event.localDate,
      input.planningDateLocal
    );
    if (daysUntil < 0 || daysUntil > protectDays) {
      return;
    }

    const searchable = getEventSearchText(event);

    if (
      searchable.includes('hike') ||
      searchable.includes('run') ||
      searchable.includes('lower') ||
      searchable.includes('leg')
    ) {
      tags.add('lower-body');
      tags.add('high-impact');
    }
    if (
      searchable.includes('run') ||
      searchable.includes('hike') ||
      searchable.includes('cardio') ||
      searchable.includes('aerobic') ||
      searchable.includes('endurance')
    ) {
      tags.add('aerobic');
    }
    if (
      searchable.includes('shoulder') ||
      searchable.includes('overhead') ||
      searchable.includes('throw') ||
      searchable.includes('upper')
    ) {
      tags.add('upper-body');
      tags.add('shoulder');
    }
    if (searchable.includes('grip') || searchable.includes('climb')) {
      tags.add('grip');
    }
  });

  return [...tags];
};

const hasProtectedLowerBodyEventSoon = (
  input: AdaptiveTrainingPlanResolverInput
): boolean =>
  getProtectedEventStressTags(input).some((tag) =>
    ['lower-body', 'high-impact'].includes(tag)
  );

const getBlockStressTags = (block: AdaptiveTrainingBlock): string[] =>
  block.stressTags.map(normalizeTag);

const hasStressOverlap = (
  left: AdaptiveTrainingBlock,
  rightTags: string[]
): boolean => {
  const leftTags = getBlockStressTags(left);
  return leftTags.some((tag) => rightTags.includes(tag));
};

const isRecoveryOrRestBlock = (block: AdaptiveTrainingBlock): boolean => {
  const tags = getBlockStressTags(block);
  return (
    block.category === 'rest' ||
    block.category === 'recovery' ||
    block.category === 'mobility' ||
    tags.includes('recovery')
  );
};

const hasRecentHardStress = (recentContexts: RecentBlockContext[]): boolean =>
  recentContexts.some(
    ({ block, ageDays }) =>
      ageDays <= 2 &&
      getBlockStressTags(block).some((tag) =>
        ['heavy', 'high-impact', 'intense', 'lower-body'].includes(tag)
      )
  );

const getPriorityWeight = (
  priority: AdaptiveTrainingTargetPriority,
  phase: 'below' | 'inside' | 'over'
): number => {
  if (priority === 'primary') {
    return phase === 'below' ? 60 : phase === 'inside' ? 18 : -45;
  }
  if (priority === 'secondary') {
    return phase === 'below' ? 42 : phase === 'inside' ? 12 : -30;
  }
  return phase === 'below' ? 20 : phase === 'inside' ? 6 : -15;
};

const scoreTargetNeed = (
  block: AdaptiveTrainingBlock,
  plan: AdaptiveTrainingPlan,
  targetProgress: AdaptivePlanTargetProgress[]
): { score: number; reasons: ScoreReason[] } => {
  const reasons: ScoreReason[] = [];
  const contributionScores = block.targetContributions.map((contribution) => {
    const target = targetProgress.find(
      (item) => item.targetId === contribution.targetId
    );
    const range = plan.targetRanges.find(
      (item) => item.id === contribution.targetId
    );
    if (!target || !range) {
      return 0;
    }

    if (target.count < target.minCount) {
      reasons.push({
        code: 'target-gap',
        message: `${target.label} is due this week.`,
      });
      return getPriorityWeight(range.priority, 'below');
    }
    if (target.count < target.maxCount) {
      return getPriorityWeight(range.priority, 'inside');
    }

    return getPriorityWeight(range.priority, 'over');
  });
  const sortedScores = contributionScores.sort((left, right) => right - left);
  const score = sortedScores.reduce(
    (total, value, index) => total + (index === 0 ? value : value * 0.4),
    0
  );

  return { score, reasons };
};

const scoreRecoveryFit = (
  block: AdaptiveTrainingBlock,
  recentContexts: RecentBlockContext[]
): { score: number; reasons: ScoreReason[] } => {
  let score = 0;
  const reasons: ScoreReason[] = [];
  const blockTags = getBlockStressTags(block);

  recentContexts.forEach((context) => {
    const overlappingTags = getBlockStressTags(context.block).filter((tag) =>
      blockTags.includes(tag)
    );
    if (!overlappingTags.length) {
      return;
    }

    const hasSpecificOverlap = overlappingTags.some(
      (tag) => !['upper-body', 'lower-body', 'aerobic'].includes(tag)
    );
    const penalty = hasSpecificOverlap
      ? context.ageDays === 0
        ? 45
        : context.ageDays === 1
        ? 35
        : 18
      : context.ageDays === 0
      ? 18
      : context.ageDays === 1
      ? 10
      : 5;
    score -= penalty;
    if (context.ageDays <= 1) {
      reasons.push({
        code: 'recent-stress',
        message: `Avoiding another ${block.label} style session after recent ${context.block.label}.`,
      });
    }
  });

  if (isRecoveryOrRestBlock(block) && hasRecentHardStress(recentContexts)) {
    score += 28;
    reasons.push({
      code: 'recovery-fit',
      message: `${block.label} helps absorb recent harder training.`,
    });
  }

  return { score, reasons };
};

const scoreEventFit = (
  block: AdaptiveTrainingBlock,
  protectedStressTags: string[]
): { score: number; reasons: ScoreReason[] } => {
  if (!protectedStressTags.length) {
    return { score: 0, reasons: [] };
  }

  if (hasStressOverlap(block, protectedStressTags)) {
    return {
      score: -100,
      reasons: [
        {
          code: 'event-protection',
          message: `Moved ${block.label} down to protect an upcoming event.`,
        },
      ],
    };
  }

  if (isRecoveryOrRestBlock(block)) {
    return {
      score: 22,
      reasons: [
        {
          code: 'event-protection',
          message: `${block.label} protects freshness for an upcoming event.`,
        },
      ],
    };
  }

  return { score: 0, reasons: [] };
};

const scoreTimeFit = (
  block: AdaptiveTrainingBlock,
  availableTimeMinutes?: number
): { score: number; reasons: ScoreReason[] } => {
  if (!availableTimeMinutes) {
    return { score: 0, reasons: [] };
  }

  const gap = availableTimeMinutes - block.defaultDurationMinutes;
  if (gap >= 0) {
    return { score: gap <= 15 ? 10 : 4, reasons: [] };
  }

  return {
    score: gap < -10 ? -60 : -18,
    reasons: [
      {
        code: 'time-fit',
        message: `${block.label} is longer than today's available time.`,
      },
    ],
  };
};

const primaryTargetsAreCovered = (
  plan: AdaptiveTrainingPlan,
  targetProgress: AdaptivePlanTargetProgress[]
): boolean =>
  plan.targetRanges
    .filter((target) => target.priority !== 'optional')
    .every((target) => {
      const progress = targetProgress.find(
        (item) => item.targetId === target.id
      );
      return progress ? progress.count >= progress.minCount : true;
    });

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

const scorePrimaryBlock = (
  block: AdaptiveTrainingBlock,
  input: AdaptiveTrainingPlanResolverInput,
  targetProgress: AdaptivePlanTargetProgress[],
  recentBlockIds: string[],
  recentContexts: RecentBlockContext[],
  protectedStressTags: string[]
): ScoredBlock => {
  let score = block.category === 'rest' ? -20 : 0;
  const reasons: ScoreReason[] = [];
  const targetScore = scoreTargetNeed(block, input.plan, targetProgress);
  score += targetScore.score;
  reasons.push(...targetScore.reasons);

  if (block.id === getNextRotationBlockId(input.plan, recentBlockIds)) {
    score += 25;
    reasons.push({
      code: 'rotation-fit',
      message: `${block.label} fits your preferred training rotation.`,
    });
  }
  if (block.id === getPreferredBlockForDate(input)) {
    score += 12;
  }
  if (recentBlockIds[0] === block.id) {
    score -= 30;
  }
  if (
    block.category === 'rest' &&
    primaryTargetsAreCovered(input.plan, targetProgress)
  ) {
    score += 35;
    reasons.push({
      code: 'rest-fit',
      message: 'Your main targets are covered. Recovery keeps the plan moving.',
    });
  }
  const recoveryScore = scoreRecoveryFit(block, recentContexts);
  const eventScore = scoreEventFit(block, protectedStressTags);
  const timeScore = scoreTimeFit(block, input.availableTimeMinutes);
  score += recoveryScore.score + eventScore.score + timeScore.score;
  reasons.push(
    ...recoveryScore.reasons,
    ...eventScore.reasons,
    ...timeScore.reasons
  );

  return { block, score, reasons };
};

const chooseAddOns = (
  primary: AdaptiveTrainingBlock,
  input: AdaptiveTrainingPlanResolverInput,
  targetProgress: AdaptivePlanTargetProgress[],
  recentContexts: RecentBlockContext[],
  protectedStressTags: string[]
): AdaptiveTrainingBlock[] => {
  if (!input.plan.recommendationSettings.allowCompatibleAddOns) {
    return [];
  }

  const availableMinutes =
    input.availableTimeMinutes ?? primary.defaultDurationMinutes;
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
    .map((block) => {
      const targetScore = scoreTargetNeed(block, input.plan, targetProgress);
      const recoveryScore = scoreRecoveryFit(block, recentContexts);
      const eventScore = scoreEventFit(block, protectedStressTags);
      const timeScore = scoreTimeFit(block, remainingMinutes);
      return {
        block,
        score:
          targetScore.score +
          recoveryScore.score * 0.4 +
          eventScore.score +
          timeScore.score,
      };
    })
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
      session.status === 'pinned' &&
      session.localDate === input.planningDateLocal
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
  const recentContexts = getRecentBlockContexts(input);
  const protectedStressTags = getProtectedEventStressTags(input);
  const scoredBlocks = activeBlocks
    .map((block) =>
      scorePrimaryBlock(
        block,
        input,
        targetProgress,
        recentBlockIds,
        recentContexts,
        protectedStressTags
      )
    )
    .sort((left, right) => right.score - left.score);
  const primaryCandidate = scoredBlocks[0];
  const primary = primaryCandidate?.block ?? input.plan.blocks[0];
  const addOns = chooseAddOns(
    primary,
    input,
    targetProgress,
    recentContexts,
    protectedStressTags
  );
  const rationale: AdaptiveRecommendationRationale[] = [
    {
      code: 'structured-plan',
      message: 'This fits your current training plan.',
    },
  ];
  const coachNotes: string[] = [];

  (primaryCandidate?.reasons ?? []).forEach((reason) => {
    if (!rationale.some((item) => item.code === reason.code)) {
      rationale.push(reason);
    }
  });

  if (
    protectedStressTags.length &&
    !rationale.some((item) => item.code === 'event-protection')
  ) {
    rationale.push({
      code: 'event-protection',
      message: 'Adjusted to avoid overlapping stress with an upcoming event.',
    });
  }

  if (hasProtectedLowerBodyEventSoon(input)) {
    coachNotes.push(
      'Swapped away from heavy lower-body work to protect an upcoming event.'
    );
  }
  const recoveryReason = primaryCandidate?.reasons.find(
    (reason) => reason.code === 'recovery-fit' || reason.code === 'rest-fit'
  );
  if (recoveryReason) {
    coachNotes.push(recoveryReason.message);
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
