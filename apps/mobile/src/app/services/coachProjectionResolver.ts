import type {
  AdaptivePlanTargetProgress,
  AdaptiveTrainingBlock,
  AdaptiveTrainingPlan,
  CoachProjection,
  CoachProjectionConflictWarning,
  CoachProjectedSession,
  CoachScheduleStrategy,
  CoachSessionAction,
  UpcomingEventContext,
  WorkoutSessionSummary,
} from '@workout-agent/shared';
import {
  addDaysToLocalDate,
  coachProjectionSchema,
  compareLocalDates,
  daysBetweenLocalDates,
} from '@workout-agent/shared';
import { formatLocalDate } from '../utils/date';
import {
  blockContributesToTarget,
  computeAdaptiveTargetProgress,
  getBlockById,
  getProtectedEventStressTagsForDate,
  getSessionBlockAttribution,
  normalizeTag,
} from './adaptiveTrainingPlanResolver';

export type CoachProjectionResolverInput = {
  plan: AdaptiveTrainingPlan;
  planningDateLocal: string;
  recentSessions: WorkoutSessionSummary[];
  sessionActions?: CoachSessionAction[];
  upcomingEvents?: UpcomingEventContext[];
  availableTimeMinutes?: number;
  windowDays?: number;
};

type CompletedOccurrence = {
  blockIds: string[];
  completedLocalDate: string;
};

type ProjectionDraft = Omit<CoachProjectedSession, 'id'>;

type ProjectionContext = {
  input: CoachProjectionResolverInput;
  strategy: CoachScheduleStrategy;
  programVersion: number;
  cycleIndex: number;
  windowStartLocalDate: string;
  windowEndLocalDate: string;
  occupiedDates: Set<string>;
  projectedOrdinalCounts: Map<string, number>;
  repairNotes: Set<string>;
  conflictWarnings: CoachProjectionConflictWarning[];
};

const DEFAULT_WINDOW_DAYS = 14;
const MIN_WINDOW_DAYS = 7;
const MAX_WINDOW_DAYS = 14;
const SUPPORTED_STRATEGIES = new Set<CoachScheduleStrategy>([
  'ordered-rotation',
  'weekly-target-balance',
]);

const clampWindowDays = (windowDays?: number): number => {
  if (!windowDays || !Number.isFinite(windowDays)) {
    return DEFAULT_WINDOW_DAYS;
  }

  return Math.min(
    Math.max(Math.trunc(windowDays), MIN_WINDOW_DAYS),
    MAX_WINDOW_DAYS
  );
};

export const deriveCoachProjectionCycleIndex = (
  activeFromLocalDate: string,
  currentLocalDate: string
): number =>
  Math.max(
    0,
    Math.floor(daysBetweenLocalDates(currentLocalDate, activeFromLocalDate) / 7)
  );

const hashString = (value: string): string => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
};

export const buildCoachProjectionId = (input: {
  programId: string;
  programVersion: number;
  cycleIndex: number;
  strategy: CoachScheduleStrategy;
  sessionIdentityKey: string;
}): string =>
  `coachproj_${hashString(
    [
      input.programId,
      input.programVersion,
      input.cycleIndex,
      input.strategy,
      input.sessionIdentityKey,
    ].join('|')
  )}`;

const getProgramVersion = (plan: AdaptiveTrainingPlan): number =>
  plan.programVersion ?? 1;

const getStrategy = (plan: AdaptiveTrainingPlan): CoachScheduleStrategy =>
  plan.scheduleStrategy ?? 'weekly-target-balance';

const getActiveBlocks = (plan: AdaptiveTrainingPlan): AdaptiveTrainingBlock[] =>
  plan.blocks.filter((block) => block.category !== 'accessory');

const isRestLikeBlock = (block: AdaptiveTrainingBlock): boolean =>
  block.category === 'rest' ||
  block.category === 'recovery' ||
  block.category === 'mobility';

const getBlockStressTags = (block: AdaptiveTrainingBlock): string[] =>
  block.stressTags.map(normalizeTag);

const hasStressConflict = (
  block: AdaptiveTrainingBlock,
  protectedStressTags: string[]
): boolean => {
  const blockTags = getBlockStressTags(block);
  return blockTags.some((tag) => protectedStressTags.includes(tag));
};

const getPrimaryTargetId = (
  plan: AdaptiveTrainingPlan,
  block: AdaptiveTrainingBlock
): string => {
  const explicit = block.targetContributions[0]?.targetId;
  if (explicit) {
    return explicit;
  }

  return (
    plan.targetRanges.find((target) => blockContributesToTarget(block, target))
      ?.id ?? 'general'
  );
};

const getCompletedOccurrences = (
  plan: AdaptiveTrainingPlan,
  sessions: WorkoutSessionSummary[]
): CompletedOccurrence[] =>
  sessions
    .filter((session) => !session.archivedAt)
    .map((session) => {
      const completedAt = Date.parse(session.completedAt);
      if (!Number.isFinite(completedAt)) {
        return null;
      }

      const attribution = getSessionBlockAttribution(plan, session);
      if (!attribution) {
        return null;
      }

      return {
        blockIds: attribution.blocks.map((block) => block.id),
        completedLocalDate: formatLocalDate(new Date(completedAt)),
      };
    })
    .filter((item): item is CompletedOccurrence => Boolean(item));

const getCycleIndexForDate = (
  plan: AdaptiveTrainingPlan,
  localDate: string
): number => deriveCoachProjectionCycleIndex(plan.activeFrom, localDate);

const getCycleStartLocalDate = (
  plan: AdaptiveTrainingPlan,
  cycleIndex: number
): string => addDaysToLocalDate(plan.activeFrom, cycleIndex * 7);

const isWithinWindow = (
  context: ProjectionContext,
  localDate: string
): boolean =>
  compareLocalDates(localDate, context.windowStartLocalDate) >= 0 &&
  compareLocalDates(localDate, context.windowEndLocalDate) <= 0;

const makeOrdinalKey = (
  strategy: CoachScheduleStrategy,
  cycleIndex: number,
  sourceBlockId: string,
  targetId?: string
): string =>
  [strategy, cycleIndex, targetId ?? 'ordered', sourceBlockId].join('|');

const initializeOrdinalCounts = (
  plan: AdaptiveTrainingPlan,
  strategy: CoachScheduleStrategy,
  completedOccurrences: CompletedOccurrence[]
): Map<string, number> => {
  const counts = new Map<string, number>();

  const increment = (
    cycleIndex: number,
    sourceBlockId: string,
    targetId?: string
  ) => {
    const key = makeOrdinalKey(strategy, cycleIndex, sourceBlockId, targetId);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  };

  completedOccurrences.forEach((occurrence) => {
    const cycleIndex = getCycleIndexForDate(
      plan,
      occurrence.completedLocalDate
    );
    occurrence.blockIds.forEach((blockId) => {
      const block = getBlockById(plan, blockId);
      if (!block) {
        return;
      }
      increment(
        cycleIndex,
        block.id,
        strategy === 'weekly-target-balance'
          ? getPrimaryTargetId(plan, block)
          : undefined
      );
    });
  });

  return counts;
};

const previewOccurrenceOrdinal = (
  context: ProjectionContext,
  cycleIndex: number,
  sourceBlockId: string,
  targetId?: string
): number =>
  (context.projectedOrdinalCounts.get(
    makeOrdinalKey(context.strategy, cycleIndex, sourceBlockId, targetId)
  ) ?? 0) + 1;

const commitOccurrenceOrdinal = (
  context: ProjectionContext,
  cycleIndex: number,
  sourceBlockId: string,
  ordinal: number,
  targetId?: string
): void => {
  context.projectedOrdinalCounts.set(
    makeOrdinalKey(context.strategy, cycleIndex, sourceBlockId, targetId),
    ordinal
  );
};

const nextOccurrenceOrdinal = (
  context: ProjectionContext,
  cycleIndex: number,
  sourceBlockId: string,
  targetId?: string
): number => {
  const next = previewOccurrenceOrdinal(
    context,
    cycleIndex,
    sourceBlockId,
    targetId
  );
  commitOccurrenceOrdinal(context, cycleIndex, sourceBlockId, next, targetId);
  return next;
};

const getActionByIdentity = (
  actions: CoachSessionAction[]
): Map<string, CoachSessionAction> => {
  const map = new Map<string, CoachSessionAction>();
  actions.forEach((action) => {
    map.set(
      [
        action.programId,
        action.strategy,
        action.programVersion,
        action.cycleIndex,
        action.sessionIdentityKey,
      ].join('|'),
      action
    );
    map.set(
      [
        action.programId,
        action.strategy,
        action.cycleIndex,
        action.sessionIdentityKey,
      ].join('|'),
      action
    );
  });
  return map;
};

const findActionForSessionIdentity = (
  actionByIdentity: Map<string, CoachSessionAction>,
  input: {
    programId: string;
    strategy: CoachScheduleStrategy;
    programVersion: number;
    cycleIndex: number;
    sessionIdentityKey: string;
  }
): CoachSessionAction | undefined =>
  actionByIdentity.get(
    [
      input.programId,
      input.strategy,
      input.programVersion,
      input.cycleIndex,
      input.sessionIdentityKey,
    ].join('|')
  ) ??
  actionByIdentity.get(
    [
      input.programId,
      input.strategy,
      input.cycleIndex,
      input.sessionIdentityKey,
    ].join('|')
  );

const getUniqueSessionActions = (
  actions: Iterable<CoachSessionAction>
): CoachSessionAction[] => {
  const uniqueActions = new Map<string, CoachSessionAction>();
  [...actions].forEach((action) => {
    uniqueActions.set(
      action.id ??
        [
          action.programId,
          action.programVersion,
          action.cycleIndex,
          action.sessionIdentityKey,
        ].join('|'),
      action
    );
  });
  return [...uniqueActions.values()];
};

const getActionsByProjectedDate = (
  actions: CoachSessionAction[]
): Map<string, CoachSessionAction[]> => {
  const map = new Map<string, CoachSessionAction[]>();
  actions.forEach((action) => {
    const items = map.get(action.projectedLocalDate) ?? [];
    items.push(action);
    map.set(action.projectedLocalDate, items);
  });
  return map;
};

const parsePositiveOrdinal = (value: string): number | undefined => {
  const ordinal = Number.parseInt(value, 10);
  return Number.isInteger(ordinal) && ordinal > 0 ? ordinal : undefined;
};

const getActionOrdinalKey = (
  strategy: CoachScheduleStrategy,
  action: CoachSessionAction
):
  | { sourceBlockId: string; ordinal: number; targetId?: string }
  | undefined => {
  const { sourceBlockId, sessionIdentityKey } = action;
  if (!sourceBlockId) {
    return undefined;
  }

  if (strategy === 'ordered-rotation') {
    const prefix = `ordered:${sourceBlockId}:`;
    if (!sessionIdentityKey.startsWith(prefix)) {
      return undefined;
    }
    const ordinal = parsePositiveOrdinal(
      sessionIdentityKey.slice(prefix.length)
    );
    return ordinal ? { sourceBlockId, ordinal } : undefined;
  }

  if (strategy === 'weekly-target-balance') {
    const prefix = 'target:';
    if (!sessionIdentityKey.startsWith(prefix)) {
      return undefined;
    }

    const remainder = sessionIdentityKey.slice(prefix.length);
    const ordinalSeparator = remainder.lastIndexOf(':');
    if (ordinalSeparator < 0) {
      return undefined;
    }

    const ordinal = parsePositiveOrdinal(remainder.slice(ordinalSeparator + 1));
    const targetAndBlock = remainder.slice(0, ordinalSeparator);
    const blockSuffix = `:${sourceBlockId}`;
    if (!ordinal || !targetAndBlock.endsWith(blockSuffix)) {
      return undefined;
    }

    return {
      sourceBlockId,
      ordinal,
      targetId: targetAndBlock.slice(0, -blockSuffix.length),
    };
  }

  return undefined;
};

const commitActionOrdinal = (
  context: ProjectionContext,
  action: CoachSessionAction
): void => {
  const key = getActionOrdinalKey(context.strategy, action);
  if (!key) {
    return;
  }

  const countKey = makeOrdinalKey(
    context.strategy,
    action.cycleIndex,
    key.sourceBlockId,
    key.targetId
  );
  context.projectedOrdinalCounts.set(
    countKey,
    Math.max(context.projectedOrdinalCounts.get(countKey) ?? 0, key.ordinal)
  );
};

const consumeActionsProjectedForDate = (
  context: ProjectionContext,
  actionsByProjectedDate: Map<string, CoachSessionAction[]>,
  localDate: string
): void => {
  actionsByProjectedDate
    .get(localDate)
    ?.forEach((action) => commitActionOrdinal(context, action));
};

const getActiveSessionActions = (
  plan: AdaptiveTrainingPlan,
  strategy: CoachScheduleStrategy,
  actions: CoachSessionAction[]
): CoachSessionAction[] =>
  actions.filter(
    (action) =>
      action.actionKind === 'skip' &&
      action.programId === plan.id &&
      action.strategy === strategy
  );

const getPinnedPreferencesForDate = (
  plan: AdaptiveTrainingPlan,
  localDate: string
) =>
  plan.sessionPreferences.filter(
    (preference) =>
      preference.status === 'pinned' && preference.localDate === localDate
  );

const HARD_CONSTRAINT_EVENT_KINDS = new Set([
  'travel',
  'flight',
  'medical',
  'appointment',
  'sport',
  'race',
  'competition',
  'tournament',
]);

const HARD_CONSTRAINT_TERMS = [
  'airport',
  "can't train",
  'cannot train',
  'cant train',
  'competition',
  'conference',
  'doctor',
  'flight',
  'fresh for',
  'game',
  'keep fresh',
  'long drive',
  'medical',
  'moving',
  'must be fresh',
  'no gym',
  'no training',
  'no workout',
  'offsite',
  'protect',
  'race',
  'tournament',
  'travel',
  'wedding',
];

const normalizeConstraintText = (value: string): string =>
  normalizeTag(value).replace(/\s+/g, ' ').trim();

const getEventConstraintText = (event: UpcomingEventContext): string =>
  [
    event.kind,
    event.title,
    event.intensity,
    event.notes,
    ...(event.tags ?? []),
  ]
    .filter((value): value is string => Boolean(value))
    .map(normalizeConstraintText)
    .join(' ');

const isHardConstraintEvent = (event: UpcomingEventContext): boolean => {
  const kind = normalizeConstraintText(event.kind);
  if (kind === 'rest') {
    return false;
  }

  if (event.allDay) {
    return true;
  }

  if (HARD_CONSTRAINT_EVENT_KINDS.has(kind)) {
    return true;
  }

  if (event.intensity === 'high') {
    return true;
  }

  if ((event.durationMinutes ?? 0) >= 240) {
    return true;
  }

  const constraintText = getEventConstraintText(event);
  return HARD_CONSTRAINT_TERMS.some((term) => constraintText.includes(term));
};

const getConflictingEvents = (
  localDate: string,
  events: UpcomingEventContext[]
): UpcomingEventContext[] =>
  events.filter(
    (event) => event.localDate === localDate && isHardConstraintEvent(event)
  );

const createPinnedConflictWarning = (
  projectionId: string,
  localDate: string,
  blockLabel: string,
  event: UpcomingEventContext
): CoachProjectionConflictWarning => ({
  id: `${projectionId}:conflict:${hashString(
    [event.kind, event.title, event.localDate].join('|')
  )}`,
  projectionId,
  localDate,
  kind: 'planned-event-conflict',
  message: `${blockLabel} on ${formatProjectionDate(
    localDate
  )} overlaps ${event.title}.`,
  eventTitle: event.title,
  eventLocalDate: event.localDate,
  actions: ['keep-pinned', 'move', 'unpin'],
});

const formatProjectionDate = (localDate: string): string => {
  const [year, month, day] = localDate.split('-').map(Number);
  if (!year || !month || !day) {
    return localDate;
  }
  return new Date(year, month - 1, day).toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
};

const finalizeDraft = (draft: ProjectionDraft): CoachProjectedSession => ({
  ...draft,
  id: buildCoachProjectionId({
    programId: draft.planId,
    programVersion: draft.programVersion,
    cycleIndex: draft.cycleIndex,
    strategy: draft.strategy,
    sessionIdentityKey: draft.sessionIdentityKey,
  }),
});

const createPinnedSessions = (
  context: ProjectionContext,
  localDate: string
): CoachProjectedSession[] => {
  const pinned = getPinnedPreferencesForDate(context.input.plan, localDate);

  return pinned.flatMap((preference) => {
    const primaryBlockId = preference.blockIds[0];
    const primaryBlock = primaryBlockId
      ? getBlockById(context.input.plan, primaryBlockId)
      : undefined;
    if (!primaryBlock) {
      return [];
    }

    const cycleIndex = getCycleIndexForDate(context.input.plan, localDate);
    const draft = finalizeDraft({
      planId: context.input.plan.id,
      programVersion: context.programVersion,
      cycleIndex,
      strategy: context.strategy,
      sessionIdentityKey: `pin:${preference.id}`,
      localDate,
      sourceBlockId: primaryBlock.id,
      addOnBlockIds: preference.blockIds.slice(1),
      targetIds: primaryBlock.targetContributions.map((item) => item.targetId),
      status: 'pinned',
      projectionStatus: 'pinned',
      blockLabel: primaryBlock.label,
      durationMinutes: primaryBlock.defaultDurationMinutes,
      workoutId: undefined,
      rationale: [
        {
          code: 'pinned-session',
          message: `${primaryBlock.label} is pinned for this date.`,
        },
      ],
      coachNotes: ['Pinned sessions are preserved until you change them.'],
      conflictWarningIds: [],
      availableActions: isRestLikeBlock(primaryBlock)
        ? ['unpin', 'move']
        : ['unpin', 'move', 'generate'],
    });

    const conflicts = isRestLikeBlock(primaryBlock)
      ? []
      : getConflictingEvents(localDate, context.input.upcomingEvents ?? []);
    if (!conflicts.length) {
      return [draft];
    }

    const warnings = conflicts.map((event) =>
      createPinnedConflictWarning(draft.id, localDate, primaryBlock.label, event)
    );
    context.conflictWarnings.push(...warnings);
    context.repairNotes.add(
      'Some pinned workouts overlap hard calendar constraints.'
    );

    return [
      {
        ...draft,
        status: 'conflict' as const,
        conflictWarningIds: warnings.map((warning) => warning.id),
        availableActions: ['keep-pinned', 'move', 'unpin'],
      },
    ];
  });
};

const findRepairDate = (
  context: ProjectionContext,
  sourceDate: string,
  block: AdaptiveTrainingBlock
): string | undefined => {
  for (let offset = 1; offset <= 3; offset += 1) {
    const candidateDate = addDaysToLocalDate(sourceDate, offset);
    if (
      compareLocalDates(candidateDate, context.windowEndLocalDate) > 0 ||
      context.occupiedDates.has(candidateDate)
    ) {
      continue;
    }

    const protectedTags = getProtectedEventStressTagsForDate(
      candidateDate,
      context.input.upcomingEvents ?? [],
      context.input.plan.recommendationSettings.protectUpcomingLowerBodyDays
    );
    if (!hasStressConflict(block, protectedTags)) {
      return candidateDate;
    }
  }

  return undefined;
};

const repairEventConflict = (
  context: ProjectionContext,
  localDate: string,
  block: AdaptiveTrainingBlock
): { localDate: string; status: CoachProjectedSession['status'] } => {
  const protectedTags = getProtectedEventStressTagsForDate(
    localDate,
    context.input.upcomingEvents ?? [],
    context.input.plan.recommendationSettings.protectUpcomingLowerBodyDays
  );
  if (!hasStressConflict(block, protectedTags)) {
    return { localDate, status: 'projected' };
  }

  const repairDate = findRepairDate(context, localDate, block);
  if (!repairDate) {
    context.repairNotes.add(
      `${block.label} overlaps upcoming event stress; review before training.`
    );
    return { localDate, status: 'conflict' };
  }

  context.repairNotes.add(`${block.label} moved to protect an upcoming event.`);
  return { localDate: repairDate, status: 'repaired' };
};

const addProjectedSession = (
  context: ProjectionContext,
  sessions: CoachProjectedSession[],
  draft: ProjectionDraft
) => {
  const session = finalizeDraft(draft);
  sessions.push(session);
  context.occupiedDates.add(session.localDate);
};

const countTargetProgress = (
  progress: AdaptivePlanTargetProgress[]
): Map<string, number> => {
  const counts = new Map<string, number>();
  progress.forEach((target) => counts.set(target.targetId, target.count));
  return counts;
};

const applyProjectedTargetCounts = (
  counts: Map<string, number>,
  block: AdaptiveTrainingBlock
) => {
  block.targetContributions.forEach((contribution) => {
    counts.set(
      contribution.targetId,
      (counts.get(contribution.targetId) ?? 0) + contribution.count
    );
  });
};

const createSkippedSessions = (
  context: ProjectionContext,
  actionByIdentity: Map<string, CoachSessionAction>
): CoachProjectedSession[] => {
  return getUniqueSessionActions(actionByIdentity.values())
    .filter(
      (action) =>
        action.programId === context.input.plan.id &&
        action.strategy === context.strategy &&
        compareLocalDates(
          action.projectedLocalDate,
          context.windowStartLocalDate
        ) >= 0 &&
        compareLocalDates(
          action.projectedLocalDate,
          context.windowEndLocalDate
        ) <= 0
    )
    .map((action) => {
      const block = action.sourceBlockId
        ? getBlockById(context.input.plan, action.sourceBlockId)
        : undefined;
      return finalizeDraft({
        planId: context.input.plan.id,
        programVersion: context.programVersion,
        cycleIndex: action.cycleIndex,
        strategy: context.strategy,
        sessionIdentityKey: action.sessionIdentityKey,
        localDate: action.projectedLocalDate,
        sourceBlockId: action.sourceBlockId,
        addOnBlockIds: [],
        targetIds:
          block?.targetContributions.map((item) => item.targetId) ?? [],
        status: 'skipped',
        projectionStatus: 'projected',
        blockLabel: block?.label,
        durationMinutes: block?.defaultDurationMinutes,
        workoutId: action.workoutId,
        rationale: [
          {
            code: 'skipped-session',
            message: `${block?.label ?? 'Session'} was skipped.`,
          },
        ],
        coachNotes: [],
        conflictWarningIds: [],
        availableActions: [],
      });
    });
};

// Shared per-day machinery for the strategy loops: both walk the same date
// range from the cycle start and emit pinned/projected sessions identically;
// only block selection and ordinal bookkeeping differ per strategy.
const listCycleDates = (
  context: ProjectionContext
): Array<{ sourceDate: string; withinWindow: boolean }> => {
  const iterationStart = getCycleStartLocalDate(
    context.input.plan,
    context.cycleIndex
  );
  const totalDays = daysBetweenLocalDates(
    context.windowEndLocalDate,
    iterationStart
  );
  const days: Array<{ sourceDate: string; withinWindow: boolean }> = [];
  for (let offset = 0; offset <= totalDays; offset += 1) {
    const sourceDate = addDaysToLocalDate(iterationStart, offset);
    days.push({
      sourceDate,
      withinWindow: isWithinWindow(context, sourceDate),
    });
  }
  return days;
};

const emitPinnedSessionsForDate = (
  context: ProjectionContext,
  sessions: CoachProjectedSession[],
  sourceDate: string,
  withinWindow: boolean
): void => {
  const pinnedSessions = withinWindow
    ? createPinnedSessions(context, sourceDate)
    : [];
  pinnedSessions.forEach((session) => {
    sessions.push(session);
    context.occupiedDates.add(session.localDate);
  });
};

const emitProjectedSession = (
  context: ProjectionContext,
  sessions: CoachProjectedSession[],
  draft: {
    block: AdaptiveTrainingBlock;
    cycleIndex: number;
    sessionIdentityKey: string;
    sourceDate: string;
    workoutId?: string;
    rationale: { code: string; message: string };
  }
): void => {
  const repaired = repairEventConflict(context, draft.sourceDate, draft.block);
  addProjectedSession(context, sessions, {
    planId: context.input.plan.id,
    programVersion: context.programVersion,
    cycleIndex: draft.cycleIndex,
    strategy: context.strategy,
    sessionIdentityKey: draft.sessionIdentityKey,
    localDate: repaired.localDate,
    sourceBlockId: draft.block.id,
    addOnBlockIds: [],
    targetIds: draft.block.targetContributions.map((item) => item.targetId),
    status: repaired.status,
    projectionStatus: 'projected',
    blockLabel: draft.block.label,
    durationMinutes: draft.block.defaultDurationMinutes,
    workoutId: draft.workoutId,
    rationale: [draft.rationale],
    coachNotes: [],
    conflictWarningIds: [],
    availableActions: ['skip', 'pin', 'move', 'generate'],
  });
};

const getRotationBlockIds = (plan: AdaptiveTrainingPlan): string[] => {
  const configured = plan.recommendationSettings.preferredRotationBlockIds;
  if (configured.length) {
    return configured.filter((blockId) => Boolean(getBlockById(plan, blockId)));
  }

  return getActiveBlocks(plan)
    .filter((block) => !isRestLikeBlock(block))
    .map((block) => block.id);
};

const deriveOrderedRotationSessions = (
  context: ProjectionContext,
  actionByIdentity: Map<string, CoachSessionAction>,
  actionsByProjectedDate: Map<string, CoachSessionAction[]>,
  completedOccurrences: CompletedOccurrence[]
): CoachProjectedSession[] => {
  const sessions: CoachProjectedSession[] = [];
  const rotationBlockIds = getRotationBlockIds(context.input.plan);
  if (!rotationBlockIds.length) {
    return sessions;
  }

  const completedRotationBlockByDate = new Map<string, string>();
  completedOccurrences.forEach((occurrence) => {
    const blockId = occurrence.blockIds.find((item) =>
      rotationBlockIds.includes(item)
    );
    if (blockId) {
      completedRotationBlockByDate.set(occurrence.completedLocalDate, blockId);
    }
  });
  let rotationIndex = 0;

  for (const { sourceDate, withinWindow } of listCycleDates(context)) {
    const completedBlockId = completedRotationBlockByDate.get(sourceDate);
    if (completedBlockId) {
      rotationIndex =
        (rotationBlockIds.indexOf(completedBlockId) + 1) %
        rotationBlockIds.length;
      continue;
    }

    const pinnedPreferences = getPinnedPreferencesForDate(
      context.input.plan,
      sourceDate
    );
    if (pinnedPreferences.length) {
      consumeActionsProjectedForDate(
        context,
        actionsByProjectedDate,
        sourceDate
      );
      emitPinnedSessionsForDate(context, sessions, sourceDate, withinWindow);
      const pinnedBlockId = pinnedPreferences[0]?.blockIds[0];
      if (pinnedBlockId && rotationBlockIds.includes(pinnedBlockId)) {
        rotationIndex =
          (rotationBlockIds.indexOf(pinnedBlockId) + 1) %
          rotationBlockIds.length;
      }
      continue;
    }

    const blockId = rotationBlockIds[rotationIndex];
    const block = getBlockById(context.input.plan, blockId);
    if (!block) {
      rotationIndex = (rotationIndex + 1) % rotationBlockIds.length;
      continue;
    }

    const cycleIndex = getCycleIndexForDate(context.input.plan, sourceDate);
    const isOccupiedSourceDate =
      withinWindow && context.occupiedDates.has(sourceDate);
    const ordinal = isOccupiedSourceDate
      ? previewOccurrenceOrdinal(context, cycleIndex, block.id)
      : nextOccurrenceOrdinal(context, cycleIndex, block.id);
    const sessionIdentityKey = `ordered:${block.id}:${ordinal}`;
    const action = findActionForSessionIdentity(actionByIdentity, {
      programId: context.input.plan.id,
      strategy: context.strategy,
      programVersion: context.programVersion,
      cycleIndex,
      sessionIdentityKey,
    });

    if (isOccupiedSourceDate) {
      if (
        action?.projectedLocalDate === sourceDate &&
        action.sourceBlockId === block.id
      ) {
        commitOccurrenceOrdinal(context, cycleIndex, block.id, ordinal);
        if (action.substitutionBlockId || action.substitutionWorkoutId) {
          rotationIndex = (rotationIndex + 1) % rotationBlockIds.length;
        }
      }
      continue;
    }

    if (action?.substitutionBlockId || action?.substitutionWorkoutId) {
      rotationIndex = (rotationIndex + 1) % rotationBlockIds.length;
      continue;
    }

    if (withinWindow) {
      emitProjectedSession(context, sessions, {
        block,
        cycleIndex,
        sessionIdentityKey,
        sourceDate,
        workoutId: action?.workoutId,
        rationale: {
          code: 'ordered-rotation',
          message: `${block.label} is next in the rotation.`,
        },
      });
    }

    if (!action) {
      rotationIndex = (rotationIndex + 1) % rotationBlockIds.length;
    }
  }

  return sessions;
};

const getBestWeeklyBalanceBlock = (
  context: ProjectionContext,
  localDate: string,
  targetCounts: Map<string, number>
): AdaptiveTrainingBlock | undefined => {
  const activeBlocks = getActiveBlocks(context.input.plan);
  const restBlock = activeBlocks.find((block) => block.category === 'rest');
  const protectedTags = getProtectedEventStressTagsForDate(
    localDate,
    context.input.upcomingEvents ?? [],
    context.input.plan.recommendationSettings.protectUpcomingLowerBodyDays
  );

  const scored = activeBlocks
    .filter((block) => block.category !== 'accessory')
    .map((block) => {
      let score = block.category === 'rest' ? -15 : 0;
      context.input.plan.targetRanges.forEach((target) => {
        if (!blockContributesToTarget(block, target)) {
          return;
        }
        const count = targetCounts.get(target.id) ?? 0;
        if (count < target.minCount) {
          score += target.priority === 'primary' ? 80 : 50;
        } else if (count < (target.idealCount ?? target.maxCount)) {
          score += target.priority === 'primary' ? 24 : 14;
        } else if (count >= target.maxCount) {
          score -= target.priority === 'primary' ? 70 : 35;
        }
      });
      if (hasStressConflict(block, protectedTags)) {
        score -= 100;
      }
      if (
        context.input.availableTimeMinutes &&
        block.defaultDurationMinutes > context.input.availableTimeMinutes
      ) {
        score -= 35;
      }
      return { block, score };
    })
    .sort((left, right) => right.score - left.score);

  const best = scored[0];
  if (!best) {
    return undefined;
  }

  const primaryTargetsCovered = context.input.plan.targetRanges
    .filter((target) => target.priority !== 'optional')
    .every((target) => (targetCounts.get(target.id) ?? 0) >= target.minCount);
  if (primaryTargetsCovered && restBlock) {
    return restBlock;
  }

  return best.block;
};

const deriveWeeklyBalanceSessions = (
  context: ProjectionContext,
  targetProgress: AdaptivePlanTargetProgress[],
  actionByIdentity: Map<string, CoachSessionAction>,
  actionsByProjectedDate: Map<string, CoachSessionAction[]>
): CoachProjectedSession[] => {
  const sessions: CoachProjectedSession[] = [];
  const targetCounts = countTargetProgress(targetProgress);

  for (const { sourceDate, withinWindow } of listCycleDates(context)) {
    const pinnedPreferences = getPinnedPreferencesForDate(
      context.input.plan,
      sourceDate
    );
    if (pinnedPreferences.length) {
      consumeActionsProjectedForDate(
        context,
        actionsByProjectedDate,
        sourceDate
      );
      emitPinnedSessionsForDate(context, sessions, sourceDate, withinWindow);
      const pinnedBlock = pinnedPreferences[0]?.blockIds[0]
        ? getBlockById(context.input.plan, pinnedPreferences[0].blockIds[0])
        : undefined;
      if (pinnedBlock) {
        applyProjectedTargetCounts(targetCounts, pinnedBlock);
      }
      continue;
    }

    const block = getBestWeeklyBalanceBlock(context, sourceDate, targetCounts);
    if (!block) {
      continue;
    }

    const cycleIndex = getCycleIndexForDate(context.input.plan, sourceDate);
    const targetId = getPrimaryTargetId(context.input.plan, block);
    const isOccupiedSourceDate =
      withinWindow && context.occupiedDates.has(sourceDate);
    const ordinal = isOccupiedSourceDate
      ? previewOccurrenceOrdinal(context, cycleIndex, block.id, targetId)
      : nextOccurrenceOrdinal(context, cycleIndex, block.id, targetId);
    const sessionIdentityKey = `target:${targetId}:${block.id}:${ordinal}`;
    const action = findActionForSessionIdentity(actionByIdentity, {
      programId: context.input.plan.id,
      strategy: context.strategy,
      programVersion: context.programVersion,
      cycleIndex,
      sessionIdentityKey,
    });
    const actionMatchesSourceDate =
      action?.projectedLocalDate === sourceDate &&
      action.sourceBlockId === block.id;

    if (isOccupiedSourceDate) {
      if (actionMatchesSourceDate) {
        commitOccurrenceOrdinal(
          context,
          cycleIndex,
          block.id,
          ordinal,
          targetId
        );
      }
      continue;
    }

    if (actionMatchesSourceDate) {
      continue;
    }

    if (withinWindow) {
      emitProjectedSession(context, sessions, {
        block,
        cycleIndex,
        sessionIdentityKey,
        sourceDate,
        workoutId: undefined,
        rationale: {
          code: 'weekly-target-balance',
          message: `${block.label} fits the current target balance.`,
        },
      });
    }

    applyProjectedTargetCounts(targetCounts, block);
  }

  return sessions;
};

const sortSessions = (
  sessions: CoachProjectedSession[]
): CoachProjectedSession[] =>
  [...sessions].sort((left, right) => {
    const dateCompare = compareLocalDates(left.localDate, right.localDate);
    if (dateCompare !== 0) {
      return dateCompare;
    }
    return left.id.localeCompare(right.id);
  });

export const deriveCoachProjection = (
  input: CoachProjectionResolverInput
): CoachProjection => {
  const programVersion = getProgramVersion(input.plan);
  const strategy = getStrategy(input.plan);
  const windowDays = clampWindowDays(input.windowDays);
  const windowStartLocalDate = input.planningDateLocal;
  const windowEndLocalDate = addDaysToLocalDate(
    windowStartLocalDate,
    windowDays - 1
  );
  const cycleIndex = getCycleIndexForDate(input.plan, input.planningDateLocal);
  const targetProgress = computeAdaptiveTargetProgress({
    plan: input.plan,
    planningDateLocal: input.planningDateLocal,
    recentSessions: input.recentSessions,
  });

  if (!SUPPORTED_STRATEGIES.has(strategy)) {
    return coachProjectionSchema.parse({
      planId: input.plan.id,
      programVersion,
      strategy,
      strategyStatus: 'unsupported',
      cycleIndex,
      windowStartLocalDate,
      windowEndLocalDate,
      sessions: [],
      repairNotes: [`${strategy} projection is not implemented yet.`],
      conflictWarnings: [],
      targetProgress,
    });
  }

  const completedOccurrences = getCompletedOccurrences(
    input.plan,
    input.recentSessions
  );
  const activeSessionActions = getActiveSessionActions(
    input.plan,
    strategy,
    input.sessionActions ?? []
  );
  const context: ProjectionContext = {
    input,
    strategy,
    programVersion,
    cycleIndex,
    windowStartLocalDate,
    windowEndLocalDate,
    occupiedDates: new Set<string>(),
    projectedOrdinalCounts: initializeOrdinalCounts(
      input.plan,
      strategy,
      completedOccurrences
    ),
    repairNotes: new Set<string>(),
    conflictWarnings: [],
  };
  const actionByIdentity = getActionByIdentity(activeSessionActions);
  const actionsByProjectedDate = getActionsByProjectedDate(
    getUniqueSessionActions(activeSessionActions)
  );
  const skippedSessions = createSkippedSessions(context, actionByIdentity);
  skippedSessions.forEach((session) => {
    context.occupiedDates.add(session.localDate);
  });

  const projectedSessions =
    strategy === 'ordered-rotation'
      ? deriveOrderedRotationSessions(
          context,
          actionByIdentity,
          actionsByProjectedDate,
          completedOccurrences
        )
      : deriveWeeklyBalanceSessions(
          context,
          targetProgress,
          actionByIdentity,
          actionsByProjectedDate
        );

  const sessions = sortSessions([...skippedSessions, ...projectedSessions]);
  const todaySessionId = sessions.find(
    (session) => session.localDate === input.planningDateLocal
  )?.id;

  return coachProjectionSchema.parse({
    planId: input.plan.id,
    programVersion,
    strategy,
    strategyStatus: 'ready',
    cycleIndex,
    windowStartLocalDate,
    windowEndLocalDate,
    todaySessionId,
    sessions,
    repairNotes: [...context.repairNotes].sort(),
    conflictWarnings: [...context.conflictWarnings].sort((left, right) =>
      left.id.localeCompare(right.id)
    ),
    targetProgress,
  });
};
