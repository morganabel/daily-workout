import type { ExerciseCandidatePool, ModelPromptCapture } from './model-router';
import type { PlanningBrief, StageOnePlannerArtifact } from './planning';
import type { ModelCallRecorder } from './metering';
import type {
  AiProviderName,
  GenerationContext,
  GenerationRequest,
} from '@leveza/shared';

export interface StageOnePlanningOptions {
  apiKey?: string;
  model?: string;
  useVertexAi?: boolean;
  provider?: AiProviderName;
  candidatePool?: ExerciseCandidatePool;
  planningBrief?: PlanningBrief;
  promptRecorder?: (capture: ModelPromptCapture) => void;
  modelCallRecorder?: ModelCallRecorder;
}

export interface StageOnePlanner {
  plan(
    request: GenerationRequest,
    context: GenerationContext,
    options: StageOnePlanningOptions
  ): Promise<StageOnePlannerArtifact>;
}
