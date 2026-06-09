import type {
  GenerationRequest,
  GenerationContext,
  TodayPlan,
} from '@workout-agent/shared';
import type { WorkoutCatalogMatch } from '@workout-agent-ce/server-exercise-library';
import type { PlanningBrief, StageOnePlannerArtifact } from './planning';

export interface ExerciseCandidateReference {
  id: string;
  name: string;
  requiredEquipment?: string[];
  optionalEquipment?: string[];
  focusTags?: string[];
  movementTags?: string[];
  styleTags?: string[];
  stressorTags?: string[];
  loadLevel?: 'light' | 'moderate' | 'heavy';
}

export interface ExerciseCandidateDiagnostics {
  blockerCodes: string[];
  counts?: Record<string, number>;
}

export interface ExerciseCandidatePool {
  libraryVersion: string;
  totalEligibleCount: number;
  candidateExercises: ExerciseCandidateReference[];
  baselineExerciseIds: string[];
  searchText?: string;
  diagnostics?: ExerciseCandidateDiagnostics;
}

export interface ModelPromptCapture {
  provider: 'openai' | 'gemini';
  model?: string;
  schemaVersion?: string;
  isRegeneration: boolean;
  content: string;
  phase?: 'stage-one-planner' | 'stage-two-generation';
}

/**
 * Result from a model generation call
 */
export interface GenerationResult {
  plan: TodayPlan;
  responseId?: string;
  schemaVersion?: string;
}

/**
 * Options for model generation
 */
export interface ModelGenerationOptions {
  /**
   * API key for the provider (BYOK or server-managed)
   * IMPORTANT: Keys should be treated as secrets and never logged or persisted
   */
  apiKey?: string;

  /**
   * Model name to use (provider-specific)
   */
  model?: string;

  /**
   * Whether to use Vertex AI for Gemini (server-configured)
   */
  useVertexAi?: boolean;

  /**
   * Provider to use
   */
  provider?: 'openai' | 'gemini';

  /**
   * Internal candidate-pool summary derived from the exercise library.
   * This is available for prompt construction but must not be exposed directly in the user-facing plan.
   */
  candidatePool?: ExerciseCandidatePool;

  /**
   * Internal planning artifact derived before provider prompting.
   */
  planningBrief?: PlanningBrief;

  /**
   * Optional advisory artifact from the stage-one planner.
   */
  stageOneArtifact?: StageOnePlannerArtifact;

  /**
   * Advisory catalog match when auto mode found a usable but non-direct recipe.
   * Providers may adapt this structure, but explicit library mode never reaches this path.
   */
  catalogMatch?: WorkoutCatalogMatch;

  /**
   * Optional sink for capturing the provider prompt for debugging/evaluation.
   */
  promptRecorder?: (capture: ModelPromptCapture) => void;
}

/**
 * ModelRouter defines how the server generates workout plans using LLMs.
 * Implementations can use OpenAI/Gemini directly (OSS default), add caching,
 * proxy through a gateway, or use custom models.
 */
export interface ModelRouter {
  /**
   * Generate a workout plan using an LLM
   * @throws Error if generation fails
   */
  generate(
    request: GenerationRequest,
    context: GenerationContext,
    options: ModelGenerationOptions,
  ): Promise<GenerationResult>;

  /**
   * Check if a provider is supported
   */
  isSupportedProvider(provider: string): boolean;

  /**
   * Get the default provider name
   */
  getDefaultProvider(): string;
}
