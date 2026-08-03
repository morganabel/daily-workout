import type {
  AiProviderName,
  GenerationRequest,
  GenerationContext,
  TodayPlan,
} from '@workout-agent/shared';
import type { WorkoutCatalogMatch } from '@workout-agent-ce/server-exercise-library';
import type { PlanningBrief, StageOnePlannerArtifact } from './planning';
import type { ModelCallRecorder } from './metering';

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
  buckets?: ExerciseCandidateBucketDiagnostics[];
}

export interface ExerciseCandidateBucketDiagnostics {
  key: string;
  title: string;
  quota: number;
  availableCount: number;
  selectedCount: number;
  shortfall: number;
}

export interface ExerciseCandidateBucket {
  key: string;
  title: string;
  quota: number;
  availableCount: number;
  selectedCount: number;
  shortfall: number;
  candidateExercises: ExerciseCandidateReference[];
}

export interface ExerciseCandidatePool {
  libraryVersion: string;
  totalEligibleCount: number;
  candidateExercises: ExerciseCandidateReference[];
  candidateBuckets?: ExerciseCandidateBucket[];
  baselineExerciseIds: string[];
  searchText?: string;
  diagnostics?: ExerciseCandidateDiagnostics;
}

export interface ModelPromptCapture {
  provider: AiProviderName;
  model?: string;
  schemaVersion?: string;
  isRegeneration: boolean;
  content: string;
  phase?: 'stage-one-planner' | 'stage-two-generation';
}

export interface CatalogSeed {
  focus: string;
  durationMinutes: number;
  equipment: string[];
  source: 'library';
  energy: 'easy' | 'moderate' | 'intense';
  summary: string;
  blocks: Array<{
    title: string;
    durationMinutes: number;
    focus: string;
    exercises: Array<{
      name: string;
      prescription: string;
      detail: string | null;
    }>;
  }>;
  instructions: string;
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
  provider?: AiProviderName;

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
   * Data-minimized catalog workout seed for AI adaptation. This intentionally
   * excludes recipe IDs, catalog versions, cooldown counts, completion dates,
   * and raw recent-session objects.
   */
  catalogSeed?: CatalogSeed;

  /**
   * Optional sink for capturing the provider prompt for debugging/evaluation.
   */
  promptRecorder?: (capture: ModelPromptCapture) => void;

  /** Optional request-scoped sink for provider usage and cost accounting. */
  modelCallRecorder?: ModelCallRecorder;
}

/**
 * ModelRouter defines how the server generates workout plans using LLMs.
 * Implementations can use OpenAI, Gemini, or OpenRouter directly (OSS default), add caching,
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
    options: ModelGenerationOptions
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
