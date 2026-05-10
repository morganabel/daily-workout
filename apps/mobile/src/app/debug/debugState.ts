import type {
  AdaptivePlanRecommendation,
  AdaptiveTrainingPlan,
  GenerationStatus,
  QuickActionPreset,
  TodayPlan,
} from '@workout-agent/shared';

export type DebugBridgeState = {
  enabled: boolean;
  connected: boolean;
  sidecarUrl?: string;
  sessionId?: string;
};

export type DebugHomeUiState = {
  duration: number;
  focus: string;
  intensity: string;
  equipmentOverride: string[] | null;
  quickActions: QuickActionPreset[];
  adaptivePlan: AdaptiveTrainingPlan | null;
  adaptiveRecommendation: AdaptivePlanRecommendation | null;
  generationStatus: GenerationStatus;
  generating: boolean;
  showCustomizeSheet: boolean;
  customizeForRegeneration: boolean;
  showProfileSetup: boolean;
  hasActivePlan: boolean;
};

export type DebugActiveWorkoutUiState = {
  workoutId: string | null;
  durationSeconds: number;
  loading: boolean;
  isSubmitting: boolean;
  exerciseCount: number;
  setCount: number;
  completedSetCount: number;
  expandedExerciseCount: number;
};

export type DebugGenerationTrace = {
  id: string;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  operation: 'generate' | 'regenerate';
  status: 'success' | 'error';
  provider?: string;
  request: Record<string, unknown>;
  scheduledDate?: number;
  contextSummary: {
    equipment?: string[];
    recentSessionCount: number;
    upcomingEventCount: number;
    hasNotes: boolean;
  };
  result?: {
    planId?: string;
    savedWorkoutId?: string;
    responseId?: string;
    source?: string;
  };
  error?: {
    code?: string;
    message: string;
  };
};

type DebugStateSnapshot = {
  route: string | null;
  bridge: DebugBridgeState;
  homeUi: DebugHomeUiState | null;
  activeWorkoutUi: DebugActiveWorkoutUiState | null;
  lastGenerationTrace: DebugGenerationTrace | null;
  selectedPlan: TodayPlan | null;
};

const state: DebugStateSnapshot = {
  route: null,
  bridge: {
    enabled: false,
    connected: false,
  },
  homeUi: null,
  activeWorkoutUi: null,
  lastGenerationTrace: null,
  selectedPlan: null,
};

export function setDebugCurrentRoute(route: string | null): void {
  state.route = route;
}

export function setDebugBridgeState(next: Partial<DebugBridgeState>): void {
  state.bridge = {
    ...state.bridge,
    ...next,
  };
}

export function setDebugHomeUiState(next: DebugHomeUiState | null): void {
  state.homeUi = next;
}

export function setDebugActiveWorkoutUiState(
  next: DebugActiveWorkoutUiState | null,
): void {
  state.activeWorkoutUi = next;
}

export function setDebugLastGenerationTrace(
  next: DebugGenerationTrace | null,
): void {
  state.lastGenerationTrace = next;
}

export function setDebugSelectedPlan(next: TodayPlan | null): void {
  state.selectedPlan = next;
}

export function getDebugStateSnapshot(): DebugStateSnapshot {
  return {
    route: state.route,
    bridge: { ...state.bridge },
    homeUi: state.homeUi
      ? {
          ...state.homeUi,
          quickActions: state.homeUi.quickActions.map((action) => ({
            ...action,
          })),
        }
      : null,
    activeWorkoutUi: state.activeWorkoutUi
      ? { ...state.activeWorkoutUi }
      : null,
    lastGenerationTrace: state.lastGenerationTrace
      ? { ...state.lastGenerationTrace }
      : null,
    selectedPlan: state.selectedPlan,
  };
}
