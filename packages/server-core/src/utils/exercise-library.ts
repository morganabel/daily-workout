import type {
  CandidateQuery,
  ExerciseLibrary,
  ExerciseRecord,
} from '@workout-agent-ce/server-exercise-library';
import {
  isAutoFocus,
  type GenerationContext,
  type TodayPlan,
} from '@workout-agent/shared';
import type { GenerationRequestWithContext } from './context';

const DEFAULT_CANDIDATE_LIMIT = 24;
const DEFAULT_EQUIPMENT = ['Bodyweight'];

export interface ExerciseCandidatePoolSummary {
  libraryVersion: string;
  totalEligibleCount: number;
  candidateExercises: Array<Pick<ExerciseRecord, 'id' | 'name'>>;
  baselineExerciseIds: string[];
  query: CandidateQuery;
}

export interface BuildExerciseCandidatePoolParams {
  exerciseLibrary: ExerciseLibrary;
  request: GenerationRequestWithContext;
  context: GenerationContext;
  previousPlan?: TodayPlan | null;
}

export function buildExerciseCandidatePool({
  exerciseLibrary,
  request,
  context,
  previousPlan,
}: BuildExerciseCandidatePoolParams): ExerciseCandidatePoolSummary {
  const baselineExerciseIds = previousPlan
    ? resolvePlanExerciseIds(previousPlan, exerciseLibrary)
    : [];
  const query = buildCandidateQuery(request, context, baselineExerciseIds);
  const result = baselineExerciseIds.length
    ? exerciseLibrary.listVariationCandidates({
        ...query,
        baselineExerciseIds,
      })
    : exerciseLibrary.listEligibleExercises(query);

  return {
    libraryVersion: result.libraryVersion,
    totalEligibleCount: result.totalEligibleCount,
    candidateExercises: result.exercises.map(({ id, name }) => ({ id, name })),
    baselineExerciseIds,
    query,
  };
}

function buildCandidateQuery(
  request: GenerationRequestWithContext,
  context: GenerationContext,
  baselineExerciseIds: string[],
): CandidateQuery {
  const noteText = collectEnvironmentText(request, context);
  const focusTags = deriveFocusTags(request.focus, context);
  const avoidTags = new Set(
    normalizeAvoidTags(context.preferences.avoid ?? []),
  );
  const environment = deriveEnvironmentConstraints(noteText);

  if (noteText.includes('no jumping') || noteText.includes('no-jumping')) {
    avoidTags.add('jumping');
  }

  return {
    availableEquipment: selectAvailableEquipment(request, context),
    experienceLevel: context.userProfile.experienceLevel,
    contraindicationTags: normalizeContraindicationTags(
      context.preferences.injuries ?? [],
    ),
    avoidTags: [...avoidTags],
    environment,
    focusTags,
    styleBias: normalizeStyleBias(context.userProfile.preferredStyle),
    excludeExerciseIds: baselineExerciseIds,
    minimumMetadataCompleteness: 'planner-ready',
    limit: DEFAULT_CANDIDATE_LIMIT,
  };
}

function selectAvailableEquipment(
  request: GenerationRequestWithContext,
  context: GenerationContext,
): string[] {
  if (request.equipment?.length) {
    return request.equipment;
  }

  if (context.environment.equipment.length) {
    return context.environment.equipment;
  }

  return DEFAULT_EQUIPMENT;
}

function collectEnvironmentText(
  request: GenerationRequestWithContext,
  context: GenerationContext,
): string {
  return [
    request.notes,
    context.notes,
    context.environment.location,
    ...(request.upcomingEvents ?? []).flatMap((event) => [
      event.title,
      event.notes,
    ]),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function deriveEnvironmentConstraints(
  noteText: string,
): CandidateQuery['environment'] {
  const environment: NonNullable<CandidateQuery['environment']> = {};

  if (noteText.includes('quiet') || noteText.includes('apartment')) {
    environment.quietRequired = true;
    environment.maxNoise = 'quiet';
  }

  if (
    noteText.includes('low impact') ||
    noteText.includes('low-impact') ||
    noteText.includes('no jumping') ||
    noteText.includes('no-jumping')
  ) {
    environment.maxImpact = 'low';
  }

  if (
    noteText.includes('hotel') ||
    noteText.includes('travel') ||
    noteText.includes('on the road')
  ) {
    environment.travelFriendlyRequired = true;
  }

  if (noteText.includes('no floor') || noteText.includes('standing only')) {
    environment.floorAvailable = false;
  }

  return Object.keys(environment).length ? environment : undefined;
}

function deriveFocusTags(
  focus: string | undefined,
  context: GenerationContext,
): string[] | undefined {
  const candidates = [
    focus && !isAutoFocus(focus) ? focus : undefined,
    ...(context.preferences.focusBias ?? []),
  ].filter(Boolean) as string[];

  const tags = new Set<string>();
  for (const candidate of candidates) {
    const normalized = normalizeToken(candidate);

    if (normalized.includes('upper_body')) {
      tags.add('upper_body');
    }
    if (normalized.includes('lower_body') || normalized.includes('legs')) {
      tags.add('lower_body');
    }
    if (normalized.includes('core') || normalized.includes('abs')) {
      tags.add('core');
      tags.add('abdominals');
    }
    if (normalized.includes('mobility')) {
      tags.add('mobility');
    }
    if (normalized.includes('recovery')) {
      tags.add('recovery');
    }
    if (
      normalized.includes('conditioning') ||
      normalized.includes('cardio') ||
      normalized.includes('endurance')
    ) {
      tags.add('conditioning');
    }
  }

  return tags.size ? [...tags] : undefined;
}

function normalizeContraindicationTags(values: string[]): string[] {
  const tags = new Set<string>();

  for (const value of values) {
    const normalized = normalizeToken(value);
    if (normalized.includes('shoulder')) {
      tags.add('shoulder_irritation');
    }
    if (normalized.includes('back') || normalized.includes('lumbar')) {
      tags.add('lower_back_sensitivity');
    }
    if (normalized.includes('knee')) {
      tags.add('knee_sensitivity');
    }
  }

  return [...tags];
}

function normalizeAvoidTags(values: string[]): string[] {
  const tags = new Set<string>();

  for (const value of values) {
    const normalized = normalizeToken(value);
    if (normalized.includes('burpee')) {
      tags.add('burpee');
    }
    if (normalized.includes('jump')) {
      tags.add('jumping');
    }
    if (normalized.includes('overhead')) {
      tags.add('overhead_pressing');
    }
  }

  return [...tags];
}

function normalizeStyleBias(value: string | undefined): string[] | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = normalizeToken(value);
  if (normalized.includes('strength')) {
    return ['strength'];
  }
  if (normalized.includes('mobility')) {
    return ['mobility'];
  }
  if (normalized.includes('recovery')) {
    return ['recovery'];
  }
  if (normalized.includes('cardio') || normalized.includes('conditioning')) {
    return ['cardio', 'conditioning'];
  }
  if (normalized.includes('strongman')) {
    return ['strongman'];
  }

  return [normalized];
}

function resolvePlanExerciseIds(
  plan: TodayPlan,
  exerciseLibrary: ExerciseLibrary,
): string[] {
  const ids = new Set<string>();

  for (const block of plan.blocks) {
    for (const exercise of block.exercises) {
      const match = exerciseLibrary.getExerciseByAlias(exercise.name);
      if (match) {
        ids.add(match.id);
      }
    }
  }

  return [...ids];
}

function normalizeToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_');
}
