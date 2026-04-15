import type { ExerciseCandidatePool, ModelPromptCapture } from './model-router';
import type { PlanningBrief, StageOnePlannerArtifact } from './planning';
import type {
  GenerationContext,
  GenerationRequest,
} from '@workout-agent/shared';

export interface StageOnePlanningOptions {
  apiKey?: string;
  model?: string;
  useVertexAi?: boolean;
  provider?: 'openai' | 'gemini';
  candidatePool?: ExerciseCandidatePool;
  planningBrief?: PlanningBrief;
  promptRecorder?: (capture: ModelPromptCapture) => void;
}

export interface StageOnePlanner {
  plan(
    request: GenerationRequest,
    context: GenerationContext,
    options: StageOnePlanningOptions,
  ): Promise<StageOnePlannerArtifact>;
}
