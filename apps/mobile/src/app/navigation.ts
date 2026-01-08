import type { TodayPlan } from '@workout-agent/shared';

export type RootStackParamList = {
  Launch: undefined;
  Home: undefined;
  WorkoutPreview: { plan?: TodayPlan } | undefined;
  ActiveWorkout: { plan: TodayPlan };
  History: undefined;
  Settings: undefined;
  // Auth screens (optional upgrade from anonymous)
  SignIn: undefined;
  SignUp: undefined;
};
