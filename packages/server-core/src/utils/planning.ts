import { isAutoFocus, type GenerationContext } from '@workout-agent/shared';
import type { GenerationRequestWithContext } from './context';
import type {
  PlanningBrief,
  PlanningEventProtection,
  PlanningLoadCeiling,
} from '../types/planning';

const DEFAULT_DURATION_MINUTES = 30;
const DEFAULT_EQUIPMENT = ['Bodyweight'];
const EVENT_PROTECTION_WINDOW_DAYS = 2;

export interface DerivePlanningBriefParams {
  request: GenerationRequestWithContext;
  context: GenerationContext;
  provider: PlanningBrief['provider'];
  previousPlan?: GenerationRequestWithContext['baselineWorkout'] | null;
}

export function derivePlanningBrief({
  request,
  context,
  provider,
  previousPlan,
}: DerivePlanningBriefParams): PlanningBrief {
  const baselineWorkout = request.baselineWorkout ?? previousPlan ?? undefined;
  const requestedFocus = request.focus?.trim() || undefined;
  const focusMode = requestedFocus
    ? isAutoFocus(requestedFocus)
      ? 'smart'
      : 'explicit'
    : 'unset';
  const availableEquipment = request.equipment?.length
    ? request.equipment
    : context.environment.equipment.length
      ? context.environment.equipment
      : DEFAULT_EQUIPMENT;
  const planningDateLocal =
    request.planningDateLocal ?? formatLocalDate(new Date());
  const eventProtection = selectEventProtection(
    request.upcomingEvents ?? [],
    planningDateLocal,
  );
  const recentStressorsToAvoid = deriveRecentStressorsToAvoid(context);
  const disallowedStressors = [
    ...new Set([
      ...deriveInjuryStressors(context),
      ...deriveAvoidStressors(context),
      ...deriveEventStressors(eventProtection),
    ]),
  ];
  const resolvedFocus = resolveFocus({
    focusMode,
    requestedFocus,
    context,
    recentStressorsToAvoid,
    eventProtection,
  });
  const durationMinutes =
    request.timeMinutes ??
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

  return {
    provider,
    planningDateLocal,
    requestedFocus,
    focusMode,
    resolvedFocus,
    durationMinutes,
    availableEquipment,
    energy,
    loadCeiling,
    styleBias: context.userProfile.preferredStyle,
    primaryGoal: context.userProfile.primaryGoal,
    priorityNotes: request.notes ?? context.notes,
    unknowns: collectUnknowns(request, context),
    disallowedStressors,
    recentStressorsToAvoid,
    eventProtection,
    blockIntents: [
      {
        key: 'main',
        title: 'Main Block',
        focus: resolvedFocus,
        durationMinutes,
        objective: deriveObjective(resolvedFocus),
        candidateFocusTags: deriveCandidateFocusTags(
          resolvedFocus,
          context.preferences.focusBias ?? [],
        ),
      },
    ],
    variationMode,
    fallbackMode: 'strict-library',
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
  };
}

function deriveLoadCeiling(
  energy: PlanningBrief['energy'],
  eventProtection?: PlanningEventProtection,
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

function resolveFocus(params: {
  focusMode: PlanningBrief['focusMode'];
  requestedFocus?: string;
  context: GenerationContext;
  recentStressorsToAvoid: string[];
  eventProtection?: PlanningEventProtection;
}): string {
  const {
    focusMode,
    requestedFocus,
    context,
    recentStressorsToAvoid,
    eventProtection,
  } = params;

  if (focusMode === 'explicit' && requestedFocus) {
    return requestedFocus;
  }

  if (eventProtection) {
    if (context.userProfile.energyToday === 'easy') {
      return 'Mobility & Recovery';
    }

    return 'Upper Body & Core';
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

function collectUnknowns(
  request: GenerationRequestWithContext,
  context: GenerationContext,
): string[] {
  const unknowns = new Set<string>();

  if (request.focus === undefined) {
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

function deriveRecentStressorsToAvoid(context: GenerationContext): string[] {
  const counts = new Map<string, number>();

  for (const session of context.recentSessions) {
    for (const stressor of inferStressors(session.focus)) {
      counts.set(stressor, (counts.get(stressor) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .map(([stressor]) => stressor);
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
  planningDateLocal: string,
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
  eventProtection?: PlanningEventProtection,
): string[] {
  if (!eventProtection) {
    return [];
  }

  return ['lower_body_overload', 'high_impact', 'conditioning'];
}

function deriveCandidateFocusTags(
  resolvedFocus: string,
  focusBias: string[],
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

function countExercises(
  baselineWorkout: GenerationRequestWithContext['baselineWorkout'] | undefined,
): number {
  if (!baselineWorkout) {
    return 0;
  }

  return baselineWorkout.blocks.reduce(
    (total, block) => total + block.exercises.length,
    0,
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
    right.getDate(),
  );

  return Math.round(
    (rightDay.getTime() - leftDay.getTime()) / millisecondsPerDay,
  );
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}
