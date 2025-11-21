import type {
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
  createdAt?: number | null;
  updatedAt?: number | null;
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
  exercises: ExerciseRowLike[],
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
              `${workout.id ?? workout.remoteId ?? 'workout'}-block-${blockKey}`,
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

export const planToPersistence = (
  plan: TodayPlan,
  timestamp: number = Date.now(),
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
  exercises: ExerciseRowLike[],
): TodayPlan => {
  const parsedPlan = parseJson<TodayPlan>(workout.planJson ?? undefined);
  const equipment =
    parseJson<string[]>(workout.equipmentJson ?? undefined) ?? [];
  const durationMinutes = deriveDurationMinutes(workout);
  const fallbackBlocks = buildBlocksFromExercises(workout, exercises);

  if (parsedPlan) {
    return {
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
    };
  }

  return {
    id: workout.id ?? workout.remoteId ?? 'workout',
    focus: workout.focus ?? workout.name,
    durationMinutes,
    equipment,
    source: (workout.source as TodayPlan['source'] | undefined) ?? 'ai',
    energy: (workout.energy as TodayPlan['energy'] | undefined) ?? 'moderate',
    summary: workout.summary ?? 'Personalized workout',
    blocks: fallbackBlocks,
  };
};
