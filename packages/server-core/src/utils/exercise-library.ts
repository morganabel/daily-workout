import type {
  CandidateQuery,
  CandidateResult,
  ExerciseLibrary,
  LoadLevel,
} from '@workout-agent-ce/server-exercise-library';
import {
  isAutoFocus,
  normalizeEquipmentSelection,
  type GenerationContext,
  type TodayPlan,
} from '@workout-agent/shared';
import type { ExerciseCandidatePool } from '../types/model-router';
import type { PlanningBrief, StageOnePlannerArtifact } from '../types/planning';
import type { GenerationRequestWithContext } from './context';

const DEFAULT_CANDIDATE_LIMIT = 128;
export const PROMPT_CANDIDATE_LIMIT = 64;
const DEFAULT_EQUIPMENT = ['Bodyweight'];
const UPPER_BODY_BUCKET_WEIGHTS = {
  push: 2,
  backPull: 2,
  accessory: 1,
} as const;

type ExerciseCandidateReference =
  ExerciseCandidatePool['candidateExercises'][number];
type ExerciseCandidateBucket = NonNullable<
  ExerciseCandidatePool['candidateBuckets']
>[number];

interface CandidateBucketSpec {
  key: string;
  title: string;
  weight: number;
  quota: number;
  scoreCandidate: (candidate: ExerciseCandidateReference) => number;
}

interface CandidateBucketAssignment {
  candidate: ExerciseCandidateReference;
  index: number;
  score: number;
}

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
    planningBrief
  );
  const result = baselineExerciseIds.length
    ? exerciseLibrary.listVariationCandidates({
        ...query,
        baselineExerciseIds,
      })
    : exerciseLibrary.listEligibleExercises(query);
  const candidates = result.exercises.map(mapExerciseRecordToCandidate);
  const candidateBuckets = buildCandidateBuckets(candidates, planningBrief);
  const selectedCandidates = candidateBuckets
    ? candidateBuckets.flatMap((bucket) => bucket.candidateExercises)
    : candidates;
  const bucketDiagnostics = candidateBuckets?.map(
    ({ key, title, quota, availableCount, selectedCount, shortfall }) => ({
      key,
      title,
      quota,
      availableCount,
      selectedCount,
      shortfall,
    })
  );

  return {
    libraryVersion: result.libraryVersion,
    totalEligibleCount: result.totalEligibleCount,
    candidateExercises: selectedCandidates,
    candidateBuckets,
    baselineExerciseIds,
    searchText: query.searchText,
    diagnostics:
      result.diagnostics || bucketDiagnostics?.length
        ? {
            blockerCodes: result.diagnostics?.blockerCodes ?? [],
            counts: result.diagnostics?.counts,
            buckets: bucketDiagnostics,
          }
        : undefined,
    query,
  };
}

export function rerankExerciseCandidatePool(
  candidatePool: ExerciseCandidatePoolSummary,
  stageOneArtifact: StageOnePlannerArtifact
): ExerciseCandidatePoolSummary {
  if (candidatePool.candidateBuckets?.length) {
    const rerankedBuckets = candidatePool.candidateBuckets.map((bucket) => ({
      ...bucket,
      candidateExercises: rerankCandidatesWithinList(
        bucket.candidateExercises,
        stageOneArtifact
      ),
    }));
    const reranked = rerankedBuckets.flatMap(
      (bucket) => bucket.candidateExercises
    );
    const isSameOrder = reranked.every(
      (candidate, index) =>
        candidate.id === candidatePool.candidateExercises[index]?.id
    );

    if (isSameOrder) {
      return candidatePool;
    }

    return {
      ...candidatePool,
      candidateExercises: reranked,
      candidateBuckets: rerankedBuckets,
    };
  }

  const reranked = rerankCandidatesWithinList(
    candidatePool.candidateExercises,
    stageOneArtifact
  );
  const isSameOrder = reranked.every(
    (candidate, index) =>
      candidate.id === candidatePool.candidateExercises[index]?.id
  );

  if (isSameOrder) {
    return candidatePool;
  }

  return {
    ...candidatePool,
    candidateExercises: reranked,
  };
}

function rerankCandidatesWithinList(
  candidates: ExerciseCandidateReference[],
  stageOneArtifact: StageOnePlannerArtifact
): ExerciseCandidateReference[] {
  const rescored = candidates
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

  return rescored.map(({ candidate }) => candidate);
}

function buildCandidateQuery(
  request: GenerationRequestWithContext,
  context: GenerationContext,
  baselineExerciseIds: string[],
  planningBrief?: PlanningBrief
): CandidateQuery {
  const noteText = collectEnvironmentText(request, context);
  const planningFocusTags = collectPlanningFocusTags(planningBrief);
  const focusTags = planningFocusTags?.length
    ? planningFocusTags
    : deriveFocusTags(request.focus, context);
  const searchText = deriveSearchText(request, context, noteText, focusTags);
  const avoidTags = new Set(
    normalizeAvoidTags(context.preferences.avoid ?? [])
  );
  const environment = deriveEnvironmentConstraints(noteText);

  if (noteText.includes('no jumping') || noteText.includes('no-jumping')) {
    avoidTags.add('jumping');
  }

  return {
    availableEquipment: selectAvailableEquipment(request, context),
    experienceLevel: context.userProfile.experienceLevel,
    contraindicationTags: normalizeContraindicationTags(
      context.preferences.injuries ?? []
    ),
    avoidTags: [...avoidTags],
    searchText,
    environment,
    focusTags,
    blockRole:
      planningBrief?.blockIntents.length === 1 &&
      planningBrief.blockIntents[0]?.key === 'main'
        ? 'main'
        : undefined,
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

function mapExerciseRecordToCandidate({
  id,
  name,
  requiredEquipment,
  optionalEquipment,
  focusTags,
  movementTags,
  styleTags,
  stressorTags,
  loadLevel,
}: CandidateResult['exercises'][number]): ExerciseCandidateReference {
  return {
    id,
    name,
    requiredEquipment,
    optionalEquipment,
    focusTags,
    movementTags,
    styleTags,
    stressorTags,
    loadLevel,
  };
}

function collectPlanningFocusTags(
  planningBrief?: PlanningBrief
): string[] | undefined {
  const tags = new Set(
    planningBrief?.blockIntents.flatMap(
      (intent) => intent.candidateFocusTags
    ) ?? []
  );

  return tags.size ? [...tags] : undefined;
}

function buildCandidateBuckets(
  candidates: ExerciseCandidateReference[],
  planningBrief?: PlanningBrief
): ExerciseCandidateBucket[] | undefined {
  if (!planningBrief || candidates.length === 0) {
    return undefined;
  }

  const specs = deriveBucketSpecs(planningBrief);
  if (!specs.length) {
    return undefined;
  }

  const assigned = new Map<string, CandidateBucketAssignment[]>(
    specs.map((spec) => [spec.key, []])
  );
  const usedIds = new Set<string>();

  for (const [candidateIndex, candidate] of candidates.entries()) {
    if (usedIds.has(candidate.id)) {
      continue;
    }

    const bestMatch = specs
      .map((spec, index) => ({
        spec,
        index,
        score: spec.scoreCandidate(candidate),
      }))
      .filter(({ score }) => score > 0)
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }

        return left.index - right.index;
      })[0];

    if (!bestMatch) {
      continue;
    }

    assigned.get(bestMatch.spec.key)?.push({
      candidate,
      index: candidateIndex,
      score: bestMatch.score,
    });
    usedIds.add(candidate.id);
  }

  const selectedByBucket = new Map<string, ExerciseCandidateReference[]>();
  const overflowByBucket = new Map<string, ExerciseCandidateReference[]>();
  let selectedTotal = 0;

  for (const spec of specs) {
    const bucketCandidates = (assigned.get(spec.key) ?? [])
      .slice()
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }

        return left.index - right.index;
      })
      .map(({ candidate }) => candidate);
    const selected = bucketCandidates.slice(0, spec.quota);
    selectedByBucket.set(spec.key, selected);
    overflowByBucket.set(spec.key, bucketCandidates.slice(spec.quota));
    selectedTotal += selected.length;
  }

  let remaining = PROMPT_CANDIDATE_LIMIT - selectedTotal;
  while (remaining > 0) {
    let added = false;

    for (const spec of specs) {
      if (remaining <= 0) {
        break;
      }

      const overflow = overflowByBucket.get(spec.key) ?? [];
      const next = overflow.shift();
      if (!next) {
        continue;
      }

      selectedByBucket.get(spec.key)?.push(next);
      remaining -= 1;
      added = true;
    }

    if (!added) {
      break;
    }
  }

  const buckets = specs.map((spec) => {
    const availableCount = assigned.get(spec.key)?.length ?? 0;
    const bucketCandidates = selectedByBucket.get(spec.key) ?? [];

    return {
      key: spec.key,
      title: spec.title,
      quota: spec.quota,
      availableCount,
      selectedCount: bucketCandidates.length,
      shortfall: Math.max(0, spec.quota - availableCount),
      candidateExercises: bucketCandidates,
    };
  });

  return buckets.some((bucket) => bucket.candidateExercises.length)
    ? buckets
    : undefined;
}

function deriveBucketSpecs(
  planningBrief: PlanningBrief
): CandidateBucketSpec[] {
  const weightedSpecs: Omit<CandidateBucketSpec, 'quota'>[] = [];
  const totalDuration = Math.max(
    1,
    planningBrief.blockIntents.reduce(
      (total, intent) => total + Math.max(1, intent.durationMinutes),
      0
    )
  );

  for (const intent of planningBrief.blockIntents) {
    const intentWeight =
      Math.max(1, intent.durationMinutes) / totalDuration || 1;
    const focusTags = new Set(intent.candidateFocusTags);
    const keyPrefix = normalizeToken(intent.key || intent.focus || 'block');

    if (
      focusTags.has('upper_body') &&
      !focusTags.has('push') &&
      !focusTags.has('pull')
    ) {
      weightedSpecs.push(
        {
          key: `${keyPrefix}:upper_push`,
          title: `${intent.title} - Upper Push`,
          weight: intentWeight * UPPER_BODY_BUCKET_WEIGHTS.push,
          scoreCandidate: scoreUpperPushCandidate,
        },
        {
          key: `${keyPrefix}:upper_back_pull`,
          title: `${intent.title} - Upper Back Pull`,
          weight: intentWeight * UPPER_BODY_BUCKET_WEIGHTS.backPull,
          scoreCandidate: scoreUpperBackPullCandidate,
        },
        {
          key: `${keyPrefix}:upper_accessory_or_other`,
          title: `${intent.title} - Upper Accessory/Other`,
          weight: intentWeight * UPPER_BODY_BUCKET_WEIGHTS.accessory,
          scoreCandidate: (candidate) =>
            scoreGenericFocusCandidate(candidate, intent.candidateFocusTags),
        }
      );
      continue;
    }

    weightedSpecs.push({
      key: keyPrefix,
      title: intent.title,
      weight: intentWeight,
      scoreCandidate: (candidate) =>
        scoreGenericFocusCandidate(candidate, intent.candidateFocusTags),
    });
  }

  const quotas = allocateQuotas(
    weightedSpecs.map((spec) => spec.weight),
    PROMPT_CANDIDATE_LIMIT
  );

  return weightedSpecs.map((spec, index) => ({
    ...spec,
    quota: quotas[index] ?? 0,
  }));
}

function allocateQuotas(weights: number[], total: number): number[] {
  if (!weights.length) {
    return [];
  }

  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
  if (weightTotal <= 0) {
    return weights.map(() => Math.floor(total / weights.length));
  }

  const allocations = weights.map((weight, index) => {
    const exact = (weight / weightTotal) * total;
    return {
      index,
      quota: Math.floor(exact),
      remainder: exact - Math.floor(exact),
    };
  });
  let allocatedTotal = allocations.reduce(
    (sum, allocation) => sum + allocation.quota,
    0
  );

  for (const allocation of [...allocations].sort((left, right) => {
    if (right.remainder !== left.remainder) {
      return right.remainder - left.remainder;
    }

    return left.index - right.index;
  })) {
    if (allocatedTotal >= total) {
      break;
    }

    allocation.quota += 1;
    allocatedTotal += 1;
  }

  return allocations
    .sort((left, right) => left.index - right.index)
    .map((allocation) => allocation.quota);
}

function scoreUpperPushCandidate(
  candidate: ExerciseCandidateReference
): number {
  if (isLowerBodyDominant(candidate)) {
    return 0;
  }

  const movementTags = new Set(candidate.movementTags ?? []);
  const stressorTags = new Set(candidate.stressorTags ?? []);
  const focusTags = new Set(candidate.focusTags ?? []);

  if (!focusTags.has('upper_body')) {
    return 0;
  }

  let score = 0;
  if (movementTags.has('push')) {
    score += 4;
  }
  if (movementTags.has('press')) {
    score += 3;
  }
  if (stressorTags.has('upper_body_push_fatigue')) {
    score += 3;
  }
  if (movementTags.has('compound')) {
    score += 1;
  }

  return score;
}

function scoreUpperBackPullCandidate(
  candidate: ExerciseCandidateReference
): number {
  if (isLowerBodyDominant(candidate)) {
    return 0;
  }

  const focusTags = new Set(candidate.focusTags ?? []);
  const movementTags = new Set(candidate.movementTags ?? []);
  const stressorTags = new Set(candidate.stressorTags ?? []);

  let score = 0;
  if (movementTags.has('row')) {
    score += 5;
  }
  if (focusTags.has('lats') || focusTags.has('middle_back')) {
    score += 4;
  }
  if (movementTags.has('pull')) {
    score += 2;
  }
  if (stressorTags.has('upper_body_pull_fatigue')) {
    score += 2;
  }
  if (movementTags.has('compound')) {
    score += 1;
  }

  return score >= 4 ? score : 0;
}

function scoreGenericFocusCandidate(
  candidate: ExerciseCandidateReference,
  tags: string[]
): number {
  if (!tags.length) {
    return 1;
  }

  const candidateTags = new Set([
    ...(candidate.focusTags ?? []),
    ...(candidate.movementTags ?? []),
    ...(candidate.stressorTags ?? []),
    ...(candidate.styleTags ?? []),
  ]);

  return tags.reduce(
    (score, tag) => score + (candidateTags.has(tag) ? 1 : 0),
    0
  );
}

function isLowerBodyDominant(candidate: ExerciseCandidateReference): boolean {
  const focusTags = new Set(candidate.focusTags ?? []);
  const movementTags = new Set(candidate.movementTags ?? []);
  const stressorTags = new Set(candidate.stressorTags ?? []);

  return (
    movementTags.has('squat') ||
    movementTags.has('hinge') ||
    stressorTags.has('lower_body_fatigue') ||
    (focusTags.has('lower_body') &&
      !movementTags.has('row') &&
      !focusTags.has('middle_back') &&
      !focusTags.has('lats'))
  );
}

function normalizeLoadCeiling(
  value: PlanningBrief['loadCeiling'] | undefined
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
  artifact: StageOnePlannerArtifact
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
  artifact: StageOnePlannerArtifact
): Set<string> {
  const tags = new Set<string>();
  const combinedText = [
    artifact.resolvedFocus,
    artifact.planningIntent,
    artifact.selectionIntent?.replace(/_/g, ' '),
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
  if (artifact.selectionIntent === 'balanced_upper') {
    tags.add('upper_body');
  }
  if (artifact.selectionIntent === 'balanced_full_body') {
    tags.add('full_body');
  }
  if (artifact.selectionIntent === 'lower_body_biased') {
    tags.add('lower_body');
  }
  if (artifact.selectionIntent === 'conditioning_biased') {
    tags.add('conditioning');
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
  value: StageOnePlannerArtifact['loadBias']
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
  focusTags: string[] | undefined
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
  context: GenerationContext
): string[] {
  if (request.equipment?.length) {
    return normalizeEquipmentSelection(request.equipment, DEFAULT_EQUIPMENT);
  }

  if (context.environment.equipment.length) {
    return normalizeEquipmentSelection(
      context.environment.equipment,
      DEFAULT_EQUIPMENT
    );
  }

  return DEFAULT_EQUIPMENT;
}

function collectEnvironmentText(
  request: GenerationRequestWithContext,
  context: GenerationContext
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
  noteText: string
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
  context: GenerationContext
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
  exerciseLibrary: ExerciseLibrary
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
