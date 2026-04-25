import type {
  CandidateQuery,
  ExerciseLibrary,
  LoadLevel,
} from '@workout-agent-ce/server-exercise-library';
import {
  isAutoFocus,
  type GenerationContext,
  type TodayPlan,
} from '@workout-agent/shared';
import type { ExerciseCandidatePool } from '../types/model-router';
import type { PlanningBrief, StageOnePlannerArtifact } from '../types/planning';
import type { GenerationRequestWithContext } from './context';

const DEFAULT_CANDIDATE_LIMIT = 128;
const DEFAULT_EQUIPMENT = ['Bodyweight'];

export interface ExerciseCandidatePoolSummary extends ExerciseCandidatePool {
  query: CandidateQuery;
}

export interface BuildExerciseCandidatePoolParams {
  exerciseLibrary: ExerciseLibrary;
  request: GenerationRequestWithContext;
  context: GenerationContext;
  previousPlan?: TodayPlan | null;
  planningBrief?: PlanningBrief;
}

export function buildExerciseCandidatePool({
  exerciseLibrary,
  request,
  context,
  previousPlan,
  planningBrief,
}: BuildExerciseCandidatePoolParams): ExerciseCandidatePoolSummary {
  const baselinePlan = request.baselineWorkout ?? previousPlan ?? undefined;
  const baselineExerciseIds = baselinePlan
    ? resolvePlanExerciseIds(baselinePlan, exerciseLibrary)
    : [];
  const query = buildCandidateQuery(
    request,
    context,
    baselineExerciseIds,
    planningBrief,
  );
  const result = baselineExerciseIds.length
    ? exerciseLibrary.listVariationCandidates({
        ...query,
        baselineExerciseIds,
      })
    : exerciseLibrary.listEligibleExercises(query);

  return {
    libraryVersion: result.libraryVersion,
    totalEligibleCount: result.totalEligibleCount,
    candidateExercises: result.exercises.map(
      ({
        id,
        name,
        requiredEquipment,
        optionalEquipment,
        focusTags,
        movementTags,
        styleTags,
        stressorTags,
        loadLevel,
      }) => ({
        id,
        name,
        requiredEquipment,
        optionalEquipment,
        focusTags,
        movementTags,
        styleTags,
        stressorTags,
        loadLevel,
      }),
    ),
    baselineExerciseIds,
    searchText: query.searchText,
    diagnostics: result.diagnostics
      ? {
          blockerCodes: result.diagnostics.blockerCodes,
          counts: result.diagnostics.counts,
        }
      : undefined,
    query,
  };
}

export function rerankExerciseCandidatePool(
  candidatePool: ExerciseCandidatePoolSummary,
  stageOneArtifact: StageOnePlannerArtifact,
): ExerciseCandidatePoolSummary {
  const rescored = candidatePool.candidateExercises
    .map((candidate, index) => ({
      candidate,
      index,
      score: scoreCandidateForStageOne(candidate, stageOneArtifact),
    }))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return left.index - right.index;
    });

  const reranked = rescored.map(({ candidate }) => candidate);
  const isSameOrder = reranked.every(
    (candidate, index) =>
      candidate.id === candidatePool.candidateExercises[index]?.id,
  );

  if (isSameOrder) {
    return candidatePool;
  }

  return {
    ...candidatePool,
    candidateExercises: reranked,
  };
}

function buildCandidateQuery(
  request: GenerationRequestWithContext,
  context: GenerationContext,
  baselineExerciseIds: string[],
  planningBrief?: PlanningBrief,
): CandidateQuery {
  const noteText = collectEnvironmentText(request, context);
  const focusTags = planningBrief?.blockIntents[0]?.candidateFocusTags?.length
    ? planningBrief.blockIntents[0].candidateFocusTags
    : deriveFocusTags(request.focus, context);
  const searchText = deriveSearchText(request, context, noteText, focusTags);
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
    searchText,
    environment,
    focusTags,
    blockRole:
      planningBrief?.blockIntents[0]?.key === 'main' ? 'main' : undefined,
    disallowedStressors: planningBrief?.disallowedStressors,
    loadCeiling: normalizeLoadCeiling(planningBrief?.loadCeiling),
    styleBias:
      normalizeStyleBias(planningBrief?.styleBias) ??
      normalizeStyleBias(context.userProfile.preferredStyle),
    excludeExerciseIds: baselineExerciseIds,
    minimumMetadataCompleteness: 'planner-ready',
    limit: DEFAULT_CANDIDATE_LIMIT,
  };
}

function normalizeLoadCeiling(
  value: PlanningBrief['loadCeiling'] | undefined,
): LoadLevel | undefined {
  switch (value) {
    case 'low':
      return 'light';
    case 'moderate':
      return 'moderate';
    case 'high':
      return 'heavy';
    default:
      return undefined;
  }
}

function scoreCandidateForStageOne(
  candidate: ExerciseCandidatePool['candidateExercises'][number],
  artifact: StageOnePlannerArtifact,
): number {
  let score = 0;
  const preferredTags = derivePreferredPlannerTags(artifact);
  const candidateTags = new Set([
    ...(candidate.focusTags ?? []),
    ...(candidate.movementTags ?? []),
  ]);
  const styleTags = new Set(candidate.styleTags ?? []);
  const blockedStressors = new Set([
    ...artifact.avoidStressors.map(normalizePlannerToken),
    ...artifact.protectStressors.map(normalizePlannerToken),
  ]);

  for (const tag of preferredTags) {
    if (candidateTags.has(tag)) {
      score += 4;
    }
  }

  for (const styleBias of artifact.styleBiases) {
    if (styleTags.has(normalizePlannerToken(styleBias))) {
      score += 2;
    }
  }

  if (artifact.loadBias) {
    const desiredLoad = normalizePlannerLoadBias(artifact.loadBias);
    if (candidate.loadLevel === desiredLoad) {
      score += 1;
    }
  }

  for (const stressor of candidate.stressorTags ?? []) {
    if (blockedStressors.has(stressor)) {
      score -= 5;
    }
  }

  return score;
}

function derivePreferredPlannerTags(
  artifact: StageOnePlannerArtifact,
): Set<string> {
  const tags = new Set<string>();
  const combinedText = [
    artifact.resolvedFocus,
    artifact.planningIntent,
    ...artifact.rerankHints,
    ...artifact.candidateInstructions,
  ]
    .join(' ')
    .toLowerCase();

  if (combinedText.includes('upper body')) {
    tags.add('upper_body');
  }
  if (combinedText.includes('lower body')) {
    tags.add('lower_body');
  }
  if (combinedText.includes('full body')) {
    tags.add('full_body');
  }
  if (combinedText.includes('core')) {
    tags.add('core');
  }
  if (combinedText.includes('push')) {
    tags.add('push');
  }
  if (combinedText.includes('pull')) {
    tags.add('pull');
  }
  if (combinedText.includes('mobility')) {
    tags.add('mobility');
  }
  if (combinedText.includes('recovery')) {
    tags.add('recovery');
  }
  if (combinedText.includes('conditioning')) {
    tags.add('conditioning');
  }

  return tags;
}

function normalizePlannerToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

function normalizePlannerLoadBias(
  value: StageOnePlannerArtifact['loadBias'],
): ExerciseCandidatePool['candidateExercises'][number]['loadLevel'] {
  switch (value) {
    case 'low':
      return 'light';
    case 'high':
      return 'heavy';
    case 'moderate':
      return 'moderate';
    default:
      return undefined;
  }
}

function deriveSearchText(
  request: GenerationRequestWithContext,
  context: GenerationContext,
  noteText: string,
  focusTags: string[] | undefined,
): string | undefined {
  const tokens = new Set<string>();

  for (const tag of focusTags ?? []) {
    tokens.add(tag.replace(/_/g, ' '));
  }

  for (const style of normalizeStyleBias(context.userProfile.preferredStyle) ??
    []) {
    tokens.add(style.replace(/_/g, ' '));
  }

  if (request.focus && !isAutoFocus(request.focus)) {
    tokens.add(request.focus);
  }

  if (noteText.includes('quiet')) {
    tokens.add('quiet');
  }
  if (noteText.includes('apartment')) {
    tokens.add('apartment');
  }
  if (noteText.includes('travel') || noteText.includes('hotel')) {
    tokens.add('travel');
    tokens.add('hotel');
  }
  if (noteText.includes('low impact') || noteText.includes('low-impact')) {
    tokens.add('low impact');
  }
  if (noteText.includes('conditioning') || noteText.includes('cardio')) {
    tokens.add('conditioning');
  }

  for (const injury of context.preferences.injuries ?? []) {
    tokens.add(injury);
  }

  for (const avoid of context.preferences.avoid ?? []) {
    tokens.add(avoid);
  }

  const searchText = [...tokens]
    .map((value) => value.trim())
    .filter(Boolean)
    .join(' ')
    .trim();

  return searchText || undefined;
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
