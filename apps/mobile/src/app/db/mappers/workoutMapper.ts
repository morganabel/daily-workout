import type {
  CoachProgramAttribution,
  TodayPlan,
  WorkoutBlock,
  WorkoutExercise,
} from '@workout-agent/shared';

export type WorkoutRowLike = {
  id?: string | null;
  name: string;
  status?: string | null;
  remoteId?: string | null;
  focus?: string | null;
  summary?: string | null;
  energy?: TodayPlan['energy'] | null;
  source?: TodayPlan['source'] | null;
  equipmentJson?: string | null;
  planJson?: string | null;
  scheduledDate?: number | null;
  completedAt?: number | null;
  durationSeconds?: number | null;
  archivedAt?: number | null;
  generationGroupId?: string | null;
  generationVersion?: number | null;
  isSelected?: boolean | null;
  parentWorkoutId?: string | null;
  generationRequestJson?: string | null;
  regenerationFeedbackJson?: string | null;
  regenerationNotes?: string | null;
  requestedChangesJson?: string | null;
  changeLabel?: string | null;
  // Provider response ID for continuity-aware regeneration.
  responseId?: string | null;
  coachProgramAttributionJson?: string | null;
  createdAt?: number | null;
  updatedAt?: number | null;
};

export type WorkoutVersionMetadata = {
  parentWorkoutId?: string;
  generationRequest?: Record<string, unknown>;
  regenerationFeedback?: string[];
  regenerationNotes?: string;
  requestedChanges?: Record<string, unknown>;
  changeLabel?: string;
  coachProgramAttribution?: CoachProgramAttribution;
};

export type TodayPlanWithVersionMetadata = TodayPlan & {
  versionMetadata?: WorkoutVersionMetadata;
};

export type ExerciseRowLike = {
  id?: string | null;
  workoutId?: string | null;
  name: string;
  muscleGroup?: string | null;
  order: number;
  blockId?: string | null;
  blockTitle?: string | null;
  blockFocus?: string | null;
  blockDuration?: number | null;
  blockOrder?: number | null;
  prescription?: string | null;
  detail?: string | null;
  createdAt?: number | null;
  updatedAt?: number | null;
};

export type PersistableWorkout = {
  workout: WorkoutRowLike;
  exercises: ExerciseRowLike[];
};

export const deriveDurationMinutes = (workout: {
  durationSeconds?: number | null;
}): number => {
  if (workout.durationSeconds) {
    return Math.max(1, Math.round(workout.durationSeconds / 60));
  }
  return 30;
};

const parseJson = <T>(json: string | null | undefined): T | null => {
  if (!json) return null;
  try {
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
};

const buildBlocksFromExercises = (
  workout: WorkoutRowLike,
  exercises: ExerciseRowLike[]
): WorkoutBlock[] => {
  if (!exercises.length) {
    return [
      {
        id: `${workout.id ?? workout.remoteId ?? 'workout'}-block`,
        title: workout.focus ?? workout.name,
        durationMinutes: deriveDurationMinutes(workout),
        focus: workout.focus ?? workout.name,
        exercises: [
          {
            id: `${workout.id ?? workout.remoteId ?? 'workout'}-exercise`,
            name: workout.name,
            prescription: 'Custom workout',
            detail: workout.summary ?? null,
          },
        ],
      },
    ];
  }

  const grouped = new Map<
    string,
    {
      block: {
        id: string;
        title?: string | null;
        focus?: string | null;
        duration?: number | null;
        order: number;
      };
      exercises: WorkoutExercise[];
    }
  >();

  exercises
    .slice()
    .sort((a, b) => {
      const blockA = a.blockOrder ?? 0;
      const blockB = b.blockOrder ?? 0;
      if (blockA === blockB) {
        return (a.order ?? 0) - (b.order ?? 0);
      }
      return blockA - blockB;
    })
    .forEach((exercise) => {
      const blockKey = exercise.blockId ?? `${exercise.blockOrder ?? 0}`;
      let group = grouped.get(blockKey);
      if (!group) {
        group = {
          block: {
            id:
              exercise.blockId ??
              `${
                workout.id ?? workout.remoteId ?? 'workout'
              }-block-${blockKey}`,
            title: exercise.blockTitle,
            focus: exercise.blockFocus,
            duration: exercise.blockDuration,
            order: exercise.blockOrder ?? 0,
          },
          exercises: [],
        };
        grouped.set(blockKey, group);
      }

      group.exercises.push({
        id: exercise.id ?? `${blockKey}-${exercise.order ?? 0}`,
        name: exercise.name,
        prescription: exercise.prescription ?? 'See notes',
        detail: exercise.detail || null,
      });
    });

  return Array.from(grouped.values())
    .sort((a, b) => a.block.order - b.block.order)
    .map<WorkoutBlock>((group) => ({
      id: group.block.id,
      title: group.block.title ?? workout.name,
      durationMinutes: group.block.duration ?? 5,
      focus: group.block.focus ?? workout.focus ?? workout.name,
      exercises: group.exercises,
    }));
};

const buildVersionMetadata = (
  workout: WorkoutRowLike
): WorkoutVersionMetadata | undefined => {
  const metadata: WorkoutVersionMetadata = {};
  const generationRequest = parseJson<Record<string, unknown>>(
    workout.generationRequestJson
  );
  const regenerationFeedback = parseJson<string[]>(
    workout.regenerationFeedbackJson
  );
  const requestedChanges = parseJson<Record<string, unknown>>(
    workout.requestedChangesJson
  );

  if (workout.parentWorkoutId)
    metadata.parentWorkoutId = workout.parentWorkoutId;
  if (generationRequest) metadata.generationRequest = generationRequest;
  if (regenerationFeedback)
    metadata.regenerationFeedback = regenerationFeedback;
  if (workout.regenerationNotes) {
    metadata.regenerationNotes = workout.regenerationNotes;
  }
  if (requestedChanges) metadata.requestedChanges = requestedChanges;
  if (workout.changeLabel) metadata.changeLabel = workout.changeLabel;

  return Object.keys(metadata).length > 0 ? metadata : undefined;
};

export const planToPersistence = (
  plan: TodayPlan,
  timestamp: number = Date.now()
): PersistableWorkout => {
  const workout: WorkoutRowLike = {
    name: plan.focus,
    status: 'planned',
    remoteId: plan.id,
    focus: plan.focus,
    summary: plan.summary,
    energy: plan.energy,
    source: plan.source,
    equipmentJson: JSON.stringify(plan.equipment),
    planJson: JSON.stringify(plan),
    scheduledDate: timestamp,
    durationSeconds: plan.durationMinutes * 60,
    archivedAt: null,
    generationGroupId: null,
    generationVersion: 1,
    isSelected: true,
    // Store provider response ID for continuity-aware regeneration.
    responseId: plan.responseId,
    coachProgramAttributionJson: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const exercises: ExerciseRowLike[] = [];
  for (const [blockIndex, block] of plan.blocks.entries()) {
    for (const [exerciseIndex, exercise] of block.exercises.entries()) {
      exercises.push({
        workoutId: workout.id ?? null,
        name: exercise.name,
        muscleGroup: block.focus,
        order: exerciseIndex,
        blockId: block.id,
        blockTitle: block.title,
        blockFocus: block.focus,
        blockDuration: block.durationMinutes,
        blockOrder: blockIndex,
        prescription: exercise.prescription,
        detail: exercise.detail ?? '',
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }
  }

  return { workout, exercises };
};

export const rowsToPlan = (
  workout: WorkoutRowLike,
  exercises: ExerciseRowLike[]
): TodayPlan => {
  const parsedPlan = parseJson<TodayPlan>(workout.planJson ?? undefined);
  const equipment =
    parseJson<string[]>(workout.equipmentJson ?? undefined) ?? [];
  const durationMinutes = deriveDurationMinutes(workout);
  const fallbackBlocks = buildBlocksFromExercises(workout, exercises);
  const versionMetadata = buildVersionMetadata(workout);

  if (parsedPlan) {
    const plan: TodayPlanWithVersionMetadata = {
      ...parsedPlan,
      id: workout.id ?? parsedPlan.id ?? workout.remoteId ?? 'workout',
      focus: parsedPlan.focus ?? workout.focus ?? workout.name,
      durationMinutes: parsedPlan.durationMinutes ?? durationMinutes,
      source:
        parsedPlan.source ??
        (workout.source as TodayPlan['source'] | undefined) ??
        'ai',
      energy:
        parsedPlan.energy ??
        (workout.energy as TodayPlan['energy'] | undefined) ??
        'moderate',
      equipment: parsedPlan.equipment ?? equipment,
      summary: parsedPlan.summary ?? workout.summary ?? '',
      blocks:
        parsedPlan.blocks && parsedPlan.blocks.length > 0
          ? parsedPlan.blocks
          : fallbackBlocks,
      // Preserve provider response ID for continuity-aware regeneration.
      responseId: parsedPlan.responseId ?? workout.responseId ?? undefined,
    };
    if (versionMetadata) plan.versionMetadata = versionMetadata;
    return plan;
  }

  const plan: TodayPlanWithVersionMetadata = {
    id: workout.id ?? workout.remoteId ?? 'workout',
    focus: workout.focus ?? workout.name,
    durationMinutes,
    equipment,
    source: (workout.source as TodayPlan['source'] | undefined) ?? 'ai',
    energy: (workout.energy as TodayPlan['energy'] | undefined) ?? 'moderate',
    summary: workout.summary ?? 'Personalized workout',
    blocks: fallbackBlocks,
    // Preserve provider response ID for continuity-aware regeneration.
    responseId: workout.responseId ?? undefined,
  };
  if (versionMetadata) plan.versionMetadata = versionMetadata;
  return plan;
};
