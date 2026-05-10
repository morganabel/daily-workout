import type {
  AiProviderName,
  AdaptivePlanIntent,
  PlanningLoadCeiling,
  PlanningStageOneActivation,
} from '@workout-agent/shared';

export type {
  PlanningLoadCeiling,
  PlanningNoveltyTarget,
  PlanningStageOneActivation,
  PlanningStageOneConfidence,
  PlanningStageOneMode,
  PlanningStageOneReason,
  StageOnePlannerArtifact,
} from '@workout-agent/shared';

export type PlanningFocusMode =
  | 'explicit'
  | 'smart'
  | 'adaptive-plan'
  | 'unset';
export type PlanningVariationMode =
  | 'none'
  | 'preserve-intent'
  | 'different-exercises';
export type PlanningRegenerationMode = 'initial' | 'stateful' | 'stateless';
export type PlanningFallbackMode = 'strict-library';

export interface PlanningBlockIntent {
  key: string;
  title: string;
  focus: string;
  durationMinutes: number;
  objective: string;
  candidateFocusTags: string[];
}

export interface PlanningEventProtection {
  kind: string;
  title: string;
  localDate: string;
  intensity?: 'low' | 'moderate' | 'high';
  reason: string;
}

export interface PlanningRegenerationSummary {
  isRegeneration: boolean;
  mode: PlanningRegenerationMode;
  feedback: string[];
  baselineWorkoutId?: string;
  baselineExerciseCount: number;
}

export interface PlanningUserConstraints {
  injuries: string[];
  avoid: string[];
}

export interface PlanningBrief {
  provider: AiProviderName;
  planningDateLocal?: string;
  requestedFocus?: string;
  focusMode: PlanningFocusMode;
  adaptivePlanIntent?: AdaptivePlanIntent;
  resolvedFocus: string;
  durationMinutes: number;
  availableEquipment: string[];
  energy: 'easy' | 'moderate' | 'intense' | 'unknown';
  loadCeiling: PlanningLoadCeiling;
  styleBias?: string;
  primaryGoal?: string;
  priorityNotes?: string;
  userConstraints: PlanningUserConstraints;
  unknowns: string[];
  disallowedStressors: string[];
  recentStressorsToAvoid: string[];
  eventProtection?: PlanningEventProtection;
  blockIntents: PlanningBlockIntent[];
  variationMode: PlanningVariationMode;
  fallbackMode: PlanningFallbackMode;
  fallbackReasons: string[];
  regeneration: PlanningRegenerationSummary;
  stagedPlanning: PlanningStageOneActivation;
}
