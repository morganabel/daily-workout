import {
  isAutoFocus,
  normalizeEquipmentSelection,
  type GenerationContext,
} from '@workout-agent/shared';
import type { GenerationRequestWithContext } from './context';
import type {
  PlanningBlockIntent,
  PlanningBrief,
  PlanningEventProtection,
  PlanningLoadCeiling,
  PlanningStageOneActivation,
  PlanningStageOneReason,
} from '../types/planning';

const DEFAULT_DURATION_MINUTES = 30;
const DEFAULT_EQUIPMENT = ['Bodyweight'];
const EVENT_PROTECTION_WINDOW_DAYS = 2;
const RECENT_SESSION_WINDOW_DAYS = 7;
const SINGLE_SESSION_BIAS_WINDOW_DAYS = 3;

type TrainingRhythm = 'split' | 'full_body' | 'unknown';

export interface DerivePlanningBriefParams {
  request: GenerationRequestWithContext;
  context: GenerationContext;
  provider: PlanningBrief['provider'];
  previousPlan?: GenerationRequestWithContext['baselineWorkout'] | null;
}

export interface DetermineStageOnePlanningActivationParams {
  request: GenerationRequestWithContext;
  context: GenerationContext;
  planningBrief: Pick<
    PlanningBrief,
    'focusMode' | 'eventProtection' | 'recentStressorsToAvoid' | 'regeneration'
  > & {
    priorityNotes?: string;
  };
}

export function derivePlanningBrief({
  request,
  context,
  provider,
  previousPlan,
}: DerivePlanningBriefParams): PlanningBrief {
  const baselineWorkout = request.baselineWorkout ?? previousPlan ?? undefined;
  const requestedFocus = request.focus?.trim() || undefined;
  const adaptivePlanIntent = request.adaptivePlanIntent;
  const requestedFocusMatchesAdaptivePlan = Boolean(
    requestedFocus &&
      adaptivePlanIntent &&
      normalizeText(requestedFocus) ===
        normalizeText(adaptivePlanIntent.primaryBlock.label)
  );
  const focusMode = requestedFocus
    ? isAutoFocus(requestedFocus)
      ? adaptivePlanIntent
        ? 'adaptive-plan'
        : 'smart'
      : requestedFocusMatchesAdaptivePlan
      ? 'adaptive-plan'
      : 'explicit'
    : adaptivePlanIntent
    ? 'adaptive-plan'
    : 'unset';
  const availableEquipment = normalizeEquipmentSelection(
    request.equipment?.length
      ? request.equipment
      : context.environment.equipment,
    DEFAULT_EQUIPMENT
  );
  const planningDateLocal =
    request.planningDateLocal ?? formatLocalDate(new Date());
  const eventProtection = selectEventProtection(
    request.upcomingEvents ?? [],
    planningDateLocal
  );
  const trainingRhythm = detectTrainingRhythm(context);
  const recentStressorsToAvoid = deriveRecentStressorsToAvoid(
    context,
    planningDateLocal,
    trainingRhythm
  );
  const recentSessionDisallowedStressors =
    deriveRecentSessionDisallowedStressors(recentStressorsToAvoid);
  const disallowedStressors = [
    ...new Set([
      ...recentSessionDisallowedStressors,
      ...deriveInjuryStressors(context),
      ...deriveAvoidStressors(context),
      ...deriveEventStressors(eventProtection),
    ]),
  ];
  const resolvedFocus = resolveFocus({
    focusMode,
    requestedFocus,
    adaptivePlanIntent,
    context,
    recentStressorsToAvoid,
    eventProtection,
  });
  const isUsingAdaptivePlanIntent = Boolean(
    adaptivePlanIntent &&
      focusMode === 'adaptive-plan' &&
      normalizeText(resolvedFocus) ===
        normalizeText(formatAdaptivePlanFocus(adaptivePlanIntent))
  );
  const durationMinutes =
    request.timeMinutes ??
    (isUsingAdaptivePlanIntent
      ? deriveAdaptivePlanDuration(adaptivePlanIntent)
      : undefined) ??
    context.environment.timeAvailableMinutes ??
    baselineWorkout?.durationMinutes ??
    DEFAULT_DURATION_MINUTES;
  const energy = request.energy ?? context.userProfile.energyToday ?? 'unknown';
  const loadCeiling = deriveLoadCeiling(energy, eventProtection);
  const variationMode = request.feedback?.includes('different-exercises')
    ? 'different-exercises'
    : request.previousResponseId || baselineWorkout
    ? 'preserve-intent'
    : 'none';

  const brief: PlanningBrief = {
    provider,
    planningDateLocal,
    requestedFocus,
    focusMode,
    adaptivePlanIntent,
    resolvedFocus,
    durationMinutes,
    availableEquipment,
    energy,
    loadCeiling,
    styleBias: deriveStyleBias(context, resolvedFocus),
    primaryGoal: context.userProfile.primaryGoal,
    priorityNotes: request.notes ?? context.notes,
    userConstraints: {
      injuries: context.preferences.injuries ?? [],
      avoid: context.preferences.avoid ?? [],
    },
    unknowns: collectUnknowns(request, context),
    disallowedStressors,
    recentStressorsToAvoid,
    eventProtection,
    blockIntents: deriveBlockIntents({
      adaptivePlanIntent,
      context,
      durationMinutes,
      focusMode,
      resolvedFocus,
    }),
    variationMode,
    fallbackMode: 'strict-library',
    fallbackReasons: [],
    regeneration: {
      isRegeneration: Boolean(request.previousResponseId || baselineWorkout),
      mode:
        request.previousResponseId && provider === 'openai'
          ? 'stateful'
          : request.previousResponseId || baselineWorkout
          ? 'stateless'
          : 'initial',
      feedback: request.feedback ?? [],
      baselineWorkoutId: baselineWorkout?.id,
      baselineExerciseCount: countExercises(baselineWorkout),
    },
    stagedPlanning: {
      mode: 'single-pass',
      shouldRun: false,
      reasons: [],
    },
  };

  return {
    ...brief,
    stagedPlanning: determineStageOnePlanningActivation({
      request,
      context,
      planningBrief: brief,
    }),
  };
}

export function determineStageOnePlanningActivation({
  request,
  context,
  planningBrief,
}: DetermineStageOnePlanningActivationParams): PlanningStageOneActivation {
  const reasons = new Set<PlanningStageOneReason>();
  const notes = [
    ...new Set([request.notes, planningBrief.priorityNotes, context.notes]),
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(' ')
    .trim();

  if (planningBrief.focusMode === 'smart') {
    reasons.add('smart-focus');
  }

  if (
    planningBrief.eventProtection &&
    planningBrief.recentStressorsToAvoid.length > 0
  ) {
    reasons.add('recent-event-conflict');
  }

  if (isDenseFreeformNotes(notes)) {
    reasons.add('dense-notes');
  }

  if (
    planningBrief.regeneration.isRegeneration &&
    planningBrief.regeneration.feedback.length > 0
  ) {
    reasons.add('regeneration-feedback');
  }

  return {
    mode: reasons.size > 0 ? 'llm-assisted' : 'single-pass',
    shouldRun: reasons.size > 0,
    reasons: Array.from(reasons),
  };
}

function deriveLoadCeiling(
  energy: PlanningBrief['energy'],
  eventProtection?: PlanningEventProtection
): PlanningLoadCeiling {
  let loadCeiling: PlanningLoadCeiling;

  switch (energy) {
    case 'easy':
      loadCeiling = 'low';
      break;
    case 'intense':
      loadCeiling = 'high';
      break;
    case 'moderate':
      loadCeiling = 'moderate';
      break;
    default:
      loadCeiling = 'unknown';
      break;
  }

  if (eventProtection) {
    if (loadCeiling === 'high') {
      return 'moderate';
    }
    if (loadCeiling === 'moderate') {
      return 'low';
    }
  }

  return loadCeiling;
}

function deriveStyleBias(
  context: GenerationContext,
  resolvedFocus: string
): string | undefined {
  if (context.userProfile.preferredStyle) {
    return context.userProfile.preferredStyle;
  }

  const strengthClues = [
    resolvedFocus,
    context.userProfile.primaryGoal,
    ...(context.preferences.focusBias ?? []),
    context.notes,
  ]
    .filter(Boolean)
    .map((value) => normalizeText(value as string));

  if (
    strengthClues.some(
      (value) =>
        value.includes('strength') ||
        value.includes('muscle') ||
        value.includes('hypertrophy') ||
        value.includes('size') ||
        value.includes('lifting') ||
        value.includes('powerlifting') ||
        value.includes('bodybuilding')
    )
  ) {
    return 'strength';
  }

  return undefined;
}

function resolveFocus(params: {
  focusMode: PlanningBrief['focusMode'];
  requestedFocus?: string;
  adaptivePlanIntent?: PlanningBrief['adaptivePlanIntent'];
  context: GenerationContext;
  recentStressorsToAvoid: string[];
  eventProtection?: PlanningEventProtection;
}): string {
  const {
    focusMode,
    requestedFocus,
    adaptivePlanIntent,
    context,
    recentStressorsToAvoid,
    eventProtection,
  } = params;

  if (focusMode === 'adaptive-plan' && adaptivePlanIntent) {
    return resolveAdaptivePlanFocus(adaptivePlanIntent, eventProtection);
  }

  if (focusMode === 'explicit' && requestedFocus) {
    return requestedFocus;
  }

  if (eventProtection) {
    if (context.userProfile.energyToday === 'easy') {
      return 'Mobility & Recovery';
    }

    return 'Upper Body & Core';
  }

  if (
    recentStressorsToAvoid.includes('push') &&
    recentStressorsToAvoid.includes('pull')
  ) {
    return 'Lower Body';
  }

  if (recentStressorsToAvoid.includes('lower_body')) {
    return 'Upper Body';
  }
  if (recentStressorsToAvoid.includes('upper_body')) {
    return 'Lower Body';
  }
  if (recentStressorsToAvoid.includes('conditioning')) {
    return 'Strength';
  }

  const focusBias = context.preferences.focusBias?.[0]?.trim();
  if (focusBias) {
    return focusBias;
  }

  const preferredStyle = context.userProfile.preferredStyle?.toLowerCase();
  if (
    preferredStyle?.includes('mobility') ||
    preferredStyle?.includes('recovery')
  ) {
    return 'Mobility & Recovery';
  }
  if (preferredStyle?.includes('strength')) {
    return 'Strength';
  }

  const primaryGoal = context.userProfile.primaryGoal?.toLowerCase();
  if (primaryGoal?.includes('run') || primaryGoal?.includes('cardio')) {
    return 'Conditioning';
  }

  return 'Full Body';
}

function resolveAdaptivePlanFocus(
  adaptivePlanIntent: NonNullable<PlanningBrief['adaptivePlanIntent']>,
  eventProtection?: PlanningEventProtection
): string {
  const blocks = [
    adaptivePlanIntent.primaryBlock,
    ...adaptivePlanIntent.addOnBlocks,
  ];
  if (
    eventProtection &&
    blocks.some((block) => hasLowerBodyOrImpactStress(block.stressTags))
  ) {
    return 'Upper Body & Core';
  }

  return formatAdaptivePlanFocus(adaptivePlanIntent);
}

function formatAdaptivePlanFocus(
  adaptivePlanIntent: NonNullable<PlanningBrief['adaptivePlanIntent']>
): string {
  const addOnLabels = adaptivePlanIntent.addOnBlocks.map(
    (block) => block.label
  );
  return [adaptivePlanIntent.primaryBlock.label, ...addOnLabels].join(' + ');
}

function deriveAdaptivePlanDuration(
  adaptivePlanIntent?: PlanningBrief['adaptivePlanIntent']
): number | undefined {
  if (!adaptivePlanIntent) {
    return undefined;
  }

  const durations = [
    adaptivePlanIntent.primaryBlock.targetDurationMinutes,
    ...adaptivePlanIntent.addOnBlocks.map(
      (block) => block.targetDurationMinutes
    ),
  ].filter((value): value is number => typeof value === 'number');

  if (!durations.length) {
    return undefined;
  }

  return durations.reduce((total, duration) => total + duration, 0);
}

function distributeAdaptiveBlockDurations(params: {
  blocks: NonNullable<PlanningBrief['adaptivePlanIntent']>['addOnBlocks'];
  durationMinutes: number;
}): number[] {
  const { blocks, durationMinutes } = params;
  if (!blocks.length) {
    return [];
  }

  const targetDurations = blocks.map(
    (block) =>
      block.targetDurationMinutes ?? Math.round(durationMinutes / blocks.length)
  );
  const targetTotal = targetDurations.reduce(
    (total, duration) => total + duration,
    0
  );
  if (targetTotal <= 0) {
    return blocks.map(() =>
      Math.max(10, Math.round(durationMinutes / blocks.length))
    );
  }

  let remaining = durationMinutes;
  return targetDurations.map((targetDuration, index) => {
    const blocksRemaining = blocks.length - index - 1;
    if (blocksRemaining === 0) {
      return Math.max(10, remaining);
    }

    const scaledDuration = Math.max(
      10,
      Math.round((targetDuration / targetTotal) * durationMinutes)
    );
    const maxDuration = Math.max(10, remaining - blocksRemaining * 10);
    const duration = Math.min(scaledDuration, maxDuration);
    remaining -= duration;
    return duration;
  });
}

function deriveBlockIntents(params: {
  adaptivePlanIntent?: PlanningBrief['adaptivePlanIntent'];
  context: GenerationContext;
  durationMinutes: number;
  focusMode: PlanningBrief['focusMode'];
  resolvedFocus: string;
}): PlanningBlockIntent[] {
  const {
    adaptivePlanIntent,
    context,
    durationMinutes,
    focusMode,
    resolvedFocus,
  } = params;

  if (
    adaptivePlanIntent &&
    focusMode === 'adaptive-plan' &&
    normalizeText(resolvedFocus) ===
      normalizeText(formatAdaptivePlanFocus(adaptivePlanIntent))
  ) {
    const blocks = [
      adaptivePlanIntent.primaryBlock,
      ...adaptivePlanIntent.addOnBlocks,
    ];
    const durations = distributeAdaptiveBlockDurations({
      blocks,
      durationMinutes,
    });
    return blocks.map((block, index) => ({
      key: index === 0 ? 'adaptive-primary' : `adaptive-addon-${index}`,
      title: index === 0 ? 'Adaptive Primary Block' : 'Adaptive Add-on Block',
      focus: block.label,
      durationMinutes: durations[index] ?? durationMinutes,
      objective: deriveObjective(block.label),
      candidateFocusTags: [
        ...new Set(
          [
            block.category,
            block.role,
            ...block.stressTags,
            ...deriveCandidateFocusTags(
              block.label,
              context.preferences.focusBias ?? []
            ),
          ].filter((value): value is string => Boolean(value))
        ),
      ],
    }));
  }

  return [
    {
      key: 'main',
      title: 'Main Block',
      focus: resolvedFocus,
      durationMinutes,
      objective: deriveObjective(resolvedFocus),
      candidateFocusTags: deriveCandidateFocusTags(
        resolvedFocus,
        context.preferences.focusBias ?? []
      ),
    },
  ];
}

function hasLowerBodyOrImpactStress(stressTags: string[]): boolean {
  return stressTags.some((tag) => {
    const normalized = normalizeText(tag);
    return (
      normalized.includes('lower') ||
      normalized.includes('impact') ||
      normalized.includes('heavy')
    );
  });
}

function collectUnknowns(
  request: GenerationRequestWithContext,
  context: GenerationContext
): string[] {
  const unknowns = new Set<string>();

  if (request.focus === undefined && request.adaptivePlanIntent === undefined) {
    unknowns.add('focus');
  }
  if (context.preferences.injuries === undefined) {
    unknowns.add('injuries');
  }
  if (context.preferences.avoid === undefined) {
    unknowns.add('avoid');
  }
  if (!context.recentSessions.length) {
    unknowns.add('recentSessions');
  }
  if (!context.userProfile.preferredStyle) {
    unknowns.add('preferredStyle');
  }
  if (!context.userProfile.primaryGoal) {
    unknowns.add('primaryGoal');
  }

  return [...unknowns];
}

function isDenseFreeformNotes(notes?: string): boolean {
  if (!notes) {
    return false;
  }

  const trimmed = notes.trim();
  if (trimmed.length >= 120) {
    return true;
  }

  return trimmed.split(/\s+/).filter(Boolean).length >= 20;
}

function deriveRecentStressorsToAvoid(
  context: GenerationContext,
  planningDateLocal: string,
  trainingRhythm: TrainingRhythm
): string[] {
  const counts = new Map<string, number>();
  let latestSession: GenerationContext['recentSessions'][number] | undefined;

  for (const session of context.recentSessions) {
    if (!isRecentSession(session.completedAt, planningDateLocal)) {
      continue;
    }

    if (
      !latestSession ||
      new Date(session.completedAt).getTime() >
        new Date(latestSession.completedAt).getTime()
    ) {
      latestSession = session;
    }

    for (const stressor of inferStressors(session.focus)) {
      counts.set(stressor, (counts.get(stressor) ?? 0) + 1);
    }
  }

  const stressors = [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .map(([stressor]) => stressor);

  if ((counts.get('push') ?? 0) > 0 && (counts.get('pull') ?? 0) > 0) {
    stressors.push('push', 'pull');
  }

  if (
    latestSession &&
    shouldBiasAwayFromLatestSession(
      latestSession,
      planningDateLocal,
      trainingRhythm
    )
  ) {
    stressors.push(...inferStressors(latestSession.focus));
  }

  return [...new Set(stressors)];
}

function deriveRecentSessionDisallowedStressors(
  recentStressorsToAvoid: string[]
): string[] {
  const stressors = new Set<string>();

  if (recentStressorsToAvoid.includes('lower_body')) {
    stressors.add('lower_body_fatigue');
    stressors.add('axial_loading');
    stressors.add('high_bracing');
  }
  if (recentStressorsToAvoid.includes('push')) {
    stressors.add('upper_body_push_fatigue');
    stressors.add('shoulder_loading');
  }
  if (recentStressorsToAvoid.includes('pull')) {
    stressors.add('upper_body_pull_fatigue');
    stressors.add('grip_heavy');
  }

  return [...stressors];
}

function detectTrainingRhythm(context: GenerationContext): TrainingRhythm {
  const explicitClues = [
    ...(context.preferences.focusBias ?? []),
    context.userProfile.preferredStyle,
    context.notes,
  ]
    .filter(Boolean)
    .map((value) => normalizeText(value as string));
  const recentFocuses = context.recentSessions.map((session) =>
    normalizeText(session.focus)
  );

  if (
    explicitClues.some(
      (value) =>
        value.includes('push pull legs') ||
        value.includes('ppl') ||
        value.includes('upper lower') ||
        value.includes('split') ||
        value.includes('bodybuilding') ||
        value.includes('powerbuilding') ||
        value.includes('powerlifting')
    )
  ) {
    return 'split';
  }

  if (explicitClues.some((value) => value.includes('full body'))) {
    return 'full_body';
  }

  const recentSplitFocusCount = recentFocuses.filter(
    (value) =>
      value.includes('push') ||
      value.includes('pull') ||
      value.includes('upper body') ||
      value.includes('lower body') ||
      value.includes('legs')
  ).length;

  if (recentSplitFocusCount >= 2) {
    return 'split';
  }

  if (recentFocuses.some((value) => value.includes('full body'))) {
    return 'full_body';
  }

  return 'unknown';
}

function shouldBiasAwayFromLatestSession(
  session: GenerationContext['recentSessions'][number],
  planningDateLocal: string,
  trainingRhythm: TrainingRhythm
): boolean {
  if (
    !isRecentSession(
      session.completedAt,
      planningDateLocal,
      SINGLE_SESSION_BIAS_WINDOW_DAYS
    )
  ) {
    return false;
  }

  if (session.perceivedEffort === 'easy') {
    return false;
  }

  switch (trainingRhythm) {
    case 'split':
      return true;
    case 'unknown':
      return session.perceivedEffort === 'intense';
    case 'full_body':
    default:
      return false;
  }
}

function deriveInjuryStressors(context: GenerationContext): string[] {
  const stressors = new Set<string>();

  for (const injury of context.preferences.injuries ?? []) {
    const normalized = normalizeText(injury);
    if (normalized.includes('shoulder')) {
      stressors.add('overhead_pressing');
    }
    if (normalized.includes('knee')) {
      stressors.add('lower_body_overload');
      stressors.add('high_impact');
    }
    if (normalized.includes('back') || normalized.includes('lumbar')) {
      stressors.add('heavy_spinal_loading');
    }
  }

  return [...stressors];
}

function deriveAvoidStressors(context: GenerationContext): string[] {
  const stressors = new Set<string>();

  for (const avoid of context.preferences.avoid ?? []) {
    const normalized = normalizeText(avoid);
    if (normalized.includes('jump')) {
      stressors.add('high_impact');
    }
    if (normalized.includes('burpee')) {
      stressors.add('burpees');
    }
  }

  return [...stressors];
}

function selectEventProtection(
  upcomingEvents: NonNullable<GenerationRequestWithContext['upcomingEvents']>,
  planningDateLocal: string
): PlanningEventProtection | undefined {
  const planningDate = parseLocalDate(planningDateLocal);
  const candidates = upcomingEvents
    .map((event) => ({
      event,
      dayDistance: diffLocalDays(planningDate, parseLocalDate(event.localDate)),
    }))
    .filter(({ event, dayDistance }) => {
      if (dayDistance < 0 || dayDistance > EVENT_PROTECTION_WINDOW_DAYS) {
        return false;
      }

      const normalizedKind = normalizeText(event.kind);
      return (
        normalizedKind.includes('run') ||
        normalizedKind.includes('sport') ||
        normalizedKind.includes('hike')
      );
    })
    .sort((left, right) => left.dayDistance - right.dayDistance);

  const protectedEvent = candidates[0]?.event;
  if (!protectedEvent) {
    return undefined;
  }

  return {
    kind: protectedEvent.kind,
    title: protectedEvent.title,
    localDate: protectedEvent.localDate,
    intensity: protectedEvent.intensity,
    reason: 'Protect freshness for the upcoming event.',
  };
}

function deriveEventStressors(
  eventProtection?: PlanningEventProtection
): string[] {
  if (!eventProtection) {
    return [];
  }

  return ['lower_body_overload', 'high_impact', 'conditioning'];
}

function deriveCandidateFocusTags(
  resolvedFocus: string,
  focusBias: string[]
): string[] {
  const tags = new Set<string>();

  for (const value of [resolvedFocus, ...focusBias]) {
    for (const stressor of inferStressors(value)) {
      tags.add(stressor);
    }
  }

  return [...tags];
}

function deriveObjective(resolvedFocus: string): string {
  const normalized = normalizeText(resolvedFocus);
  if (normalized.includes('mobility') || normalized.includes('recovery')) {
    return 'Reduce joint stress and improve movement quality.';
  }
  if (normalized.includes('conditioning') || normalized.includes('cardio')) {
    return 'Build work capacity without drifting outside the load ceiling.';
  }
  if (normalized.includes('upper')) {
    return 'Emphasize upper-body work while protecting lower-body freshness.';
  }
  if (normalized.includes('lower')) {
    return 'Emphasize lower-body work without repeating recent overload.';
  }

  return 'Build a balanced session that matches the resolved intent.';
}

function inferStressors(value: string): string[] {
  const normalized = normalizeText(value);
  const stressors = new Set<string>();

  if (normalized.includes('push')) {
    stressors.add('push');
    stressors.add('upper_body');
  }
  if (normalized.includes('pull')) {
    stressors.add('pull');
    stressors.add('upper_body');
  }
  if (normalized.includes('upper')) {
    stressors.add('upper_body');
  }
  if (normalized.includes('lower') || normalized.includes('leg')) {
    stressors.add('lower_body');
  }
  if (normalized.includes('core') || normalized.includes('ab')) {
    stressors.add('core');
  }
  if (
    normalized.includes('conditioning') ||
    normalized.includes('cardio') ||
    normalized.includes('endurance')
  ) {
    stressors.add('conditioning');
  }
  if (normalized.includes('mobility') || normalized.includes('recovery')) {
    stressors.add('mobility');
  }

  return [...stressors];
}

function isRecentSession(
  completedAt: string,
  planningDateLocal: string,
  maxAgeDays = RECENT_SESSION_WINDOW_DAYS
): boolean {
  const sessionDate = new Date(completedAt);
  const planningDate = parseLocalDate(planningDateLocal);
  const dayDistance = diffLocalDays(
    new Date(
      sessionDate.getFullYear(),
      sessionDate.getMonth(),
      sessionDate.getDate()
    ),
    planningDate
  );

  return dayDistance >= 0 && dayDistance <= maxAgeDays;
}

function countExercises(
  baselineWorkout: GenerationRequestWithContext['baselineWorkout'] | undefined
): number {
  if (!baselineWorkout) {
    return 0;
  }

  return baselineWorkout.blocks.reduce(
    (total, block) => total + block.exercises.length,
    0
  );
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

function parseLocalDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1);
}

function diffLocalDays(left: Date, right: Date): number {
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  const leftDay = new Date(left.getFullYear(), left.getMonth(), left.getDate());
  const rightDay = new Date(
    right.getFullYear(),
    right.getMonth(),
    right.getDate()
  );

  return Math.round(
    (rightDay.getTime() - leftDay.getTime()) / millisecondsPerDay
  );
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}
