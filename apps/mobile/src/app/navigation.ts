import type { TodayPlan } from '@workout-agent/shared';

export type RootStackParamList = {
  Home: undefined;
  WorkoutPreview: { plan?: TodayPlan } | undefined;
  ActiveWorkout: { plan: TodayPlan };
  History: undefined;
  Settings: undefined;
};
