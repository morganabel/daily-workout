import type { TodayPlan } from '@workout-agent/shared';

export type RootStackParamList = {
  Home: undefined;
  WorkoutPreview: { plan?: TodayPlan } | undefined;
  History: undefined;
  Settings: undefined;
};
