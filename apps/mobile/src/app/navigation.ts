import { createNavigationContainerRef } from '@react-navigation/native';
import type { TodayPlan } from '@workout-agent/shared';

export type RootStackParamList = {
  Launch: { openByok?: boolean } | undefined;
  Onboarding: undefined;
  Home: undefined;
  WorkoutPreview: { plan?: TodayPlan } | undefined;
  ActiveWorkout: { plan: TodayPlan };
  History: undefined;
  WorkoutSessionDetail: { workoutId: string };
  Settings: undefined;
  Paywall:
    | {
        source?: 'home' | 'quota' | 'settings';
      }
    | undefined;
  // Auth screens (optional upgrade from anonymous)
  SignIn: undefined;
  SignUp: undefined;
};

export const navigationRef = createNavigationContainerRef<RootStackParamList>();
