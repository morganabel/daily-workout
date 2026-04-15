import type { AiProviderName } from '@workout-agent/shared';

export type PlanningFocusMode = 'explicit' | 'smart' | 'unset';
export type PlanningLoadCeiling = 'low' | 'moderate' | 'high' | 'unknown';
export type PlanningVariationMode =
  | 'none'
  | 'preserve-intent'
  | 'different-exercises';
export type PlanningRegenerationMode = 'initial' | 'stateful' | 'stateless';
export type PlanningFallbackMode = 'strict-library';
export type PlanningStageOneMode = 'single-pass' | 'llm-assisted';
export type PlanningStageOneReason =
  | 'smart-focus'
  | 'recent-event-conflict'
  | 'dense-notes'
  | 'regeneration-feedback';
export type PlanningStageOneConfidence = 'low' | 'medium' | 'high';
export type PlanningNoveltyTarget = 'low' | 'medium' | 'high';

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

export interface PlanningStageOneActivation {
  mode: PlanningStageOneMode;
  shouldRun: boolean;
  reasons: PlanningStageOneReason[];
}

export interface StageOnePlannerArtifact {
  mode: 'llm-assisted';
  confidence: PlanningStageOneConfidence;
  planningIntent: string;
  resolvedFocus?: string;
  protectStressors: string[];
  avoidStressors: string[];
  styleBiases: string[];
  loadBias?: PlanningLoadCeiling;
  noveltyTarget?: PlanningNoveltyTarget;
  rerankHints: string[];
  candidateInstructions: string[];
}

export interface PlanningBrief {
  provider: AiProviderName;
  planningDateLocal?: string;
  requestedFocus?: string;
  focusMode: PlanningFocusMode;
  resolvedFocus: string;
  durationMinutes: number;
  availableEquipment: string[];
  energy: 'easy' | 'moderate' | 'intense' | 'unknown';
  loadCeiling: PlanningLoadCeiling;
  styleBias?: string;
  primaryGoal?: string;
  priorityNotes?: string;
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
