import type {
  AuthProvider,
  GenerationState,
  GenerationStore,
  ModelRouter,
  StageOnePlanner,
  StageOnePlannerArtifact,
  UsagePolicy,
  MeteringSink,
  PlanningBrief,
  CatalogSeed,
} from '../types';
import { createErrorResponse } from '../utils/errors';
import {
  loadGenerationContext,
  type GenerationRequestWithContext,
} from '../utils/context';
import { derivePlanningBrief } from '../utils/planning';
import {
  buildExerciseCandidatePool,
  PROMPT_CANDIDATE_LIMIT,
  rerankExerciseCandidatePool,
} from '../utils/exercise-library';
import {
  generationRequestPayloadSchema,
  todayPlanSchema,
  type AiProviderName,
  type TodayPlan,
  type WorkoutCatalogProvenance,
  type WorkoutCreationMode,
} from '@workout-agent/shared';
import type {
  ExerciseLibrary,
  WorkoutCatalogEnergy,
  WorkoutCatalogMatch,
  WorkoutCatalogQuery,
} from '@workout-agent-ce/server-exercise-library';
import {
  attachRequestId,
  createRequestContext,
  redactSensitiveStrings,
} from '../utils/logging';

const DEFAULT_GENERATION_ETA_SECONDS = 18;
const CATALOG_RECIPE_COOLDOWN_DAYS = 7;

type ExerciseCandidatePoolSummary = ReturnType<
  typeof buildExerciseCandidatePool
>;

function promoteStageOneForCandidateOverflow(
  planningBrief: PlanningBrief,
  candidatePool?: ExerciseCandidatePoolSummary
): PlanningBrief {
  if (
    !candidatePool ||
    planningBrief.stagedPlanning.reasons.includes('candidate-overflow')
  ) {
    return planningBrief;
  }

  if (candidatePool.totalEligibleCount <= PROMPT_CANDIDATE_LIMIT) {
    return planningBrief;
  }

  const hasRoleBuckets = (candidatePool.candidateBuckets?.length ?? 0) > 1;
  const hasMultipleBlockIntents = planningBrief.blockIntents.length > 1;
  const broadFocus = isBroadCandidateSelectionFocus(planningBrief);

  if (!hasRoleBuckets && !hasMultipleBlockIntents && !broadFocus) {
    return planningBrief;
  }

  return {
    ...planningBrief,
    stagedPlanning: {
      mode: 'llm-assisted',
      shouldRun: true,
      reasons: [...planningBrief.stagedPlanning.reasons, 'candidate-overflow'],
    },
  };
}

function isBroadCandidateSelectionFocus(planningBrief: PlanningBrief): boolean {
  const text = [
    planningBrief.requestedFocus,
    planningBrief.resolvedFocus,
    ...planningBrief.blockIntents.flatMap((block) => [
      block.focus,
      block.objective,
      ...block.candidateFocusTags,
    ]),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return (
    text.includes('upper body') ||
    text.includes('upper_body') ||
    text.includes('full body') ||
    text.includes('full_body') ||
    text.includes('hypertrophy') ||
    text.includes('strength')
  );
}

/**
 * Server configuration for generation
 */
export interface GenerateHandlerConfig {
  /**
   * Edition mode (CE or HOSTED)
   */
  edition?: 'CE' | 'HOSTED';

  /**
   * Whether to use Vertex AI for Gemini (server-configured)
   */
  useVertexAi?: boolean;

  /**
   * Google Cloud project ID (for Vertex AI)
   */
  googleCloudProject?: string;

  /**
   * Google Cloud location (for Vertex AI)
   */
  googleCloudLocation?: string;

  /**
   * Default API keys (server-managed, not BYOK)
   * IMPORTANT: These should never be logged
   */
  defaultApiKeys?: {
    openai?: string;
    gemini?: string;
    openrouter?: string;
  };

  /**
   * Default provider when not specified
   */
  defaultProvider?: AiProviderName;

  /**
   * Enables the optional stage-one planner path.
   */
  enableStageOnePlanner?: boolean;

  /**
   * Allows evaluation fixture routers to run without live provider access.
   */
  allowUnconfiguredProvider?: boolean;
}

/**
 * Dependencies for the generate handler
 */
export interface GenerateHandlerDeps {
  auth: AuthProvider;
  store: GenerationStore;
  router: ModelRouter;
  planner?: StageOnePlanner;
  exerciseLibrary?: ExerciseLibrary;
  loadExerciseLibrary?: () => Promise<ExerciseLibrary | undefined>;
  policy?: UsagePolicy;
  metering?: MeteringSink;
  config: GenerateHandlerConfig;
}

/**
 * Sanitize error messages to remove any potential API key leaks
 */
function sanitizeErrorMessage(message: string): string {
  return redactSensitiveStrings(message);
}

function canUseProviderContinuity(
  request: GenerationRequestWithContext,
  provider: AiProviderName,
  previousPlan: TodayPlan | null
): boolean {
  if (!request.previousResponseId || provider !== 'openai') {
    return false;
  }

  const provenance =
    request.baselineWorkout?.generationProvenance ??
    previousPlan?.generationProvenance;

  return (
    provenance?.provider === provider &&
    provenance.responseId === request.previousResponseId
  );
}

function createProviderRequest(
  request: GenerationRequestWithContext,
  provider: AiProviderName,
  previousPlan: TodayPlan | null
): GenerationRequestWithContext {
  if (canUseProviderContinuity(request, provider, previousPlan)) {
    return request;
  }

  if (!request.previousResponseId) {
    return request;
  }

  return {
    ...request,
    previousResponseId: undefined,
    baselineWorkout: request.baselineWorkout ?? previousPlan ?? undefined,
  };
}

function shouldAttemptCatalog(creationMode: WorkoutCreationMode): boolean {
  return creationMode === 'auto' || creationMode === 'library';
}

function shouldReturnCatalogMatch(
  creationMode: WorkoutCreationMode,
  catalogMatch: WorkoutCatalogMatch | undefined,
  providerCanRun: boolean
): boolean {
  if (!catalogMatch?.plan) {
    return false;
  }

  if (creationMode === 'library') {
    return (
      catalogMatch.decision === 'direct' || catalogMatch.decision === 'adapt'
    );
  }

  if (creationMode !== 'auto') {
    return false;
  }

  if (!providerCanRun && catalogMatch.decision !== 'none') {
    return true;
  }

  if (catalogMatch.decision !== 'direct') {
    return false;
  }

  return !hasCatalogRecipeCooldown(catalogMatch);
}

function hasCatalogRecipeCooldown(
  catalogMatch: WorkoutCatalogMatch | undefined
): boolean {
  return Boolean(
    catalogMatch?.diagnostics.blockerCodes.includes('catalog_recipe_cooldown')
  );
}

function isUsableCatalogMatch(
  catalogMatch: WorkoutCatalogMatch | undefined
): boolean {
  return (
    catalogMatch?.recipe !== undefined &&
    catalogMatch.plan !== undefined &&
    (catalogMatch.decision === 'direct' || catalogMatch.decision === 'adapt')
  );
}

function buildCatalogFallbackReasons(
  catalogMatch: WorkoutCatalogMatch | undefined
): string[] {
  if (!catalogMatch?.plan) {
    return [];
  }

  const reasons: string[] = [];
  if (catalogMatch.decision === 'adapt') {
    reasons.push('catalog_adapt_match');
  }
  if (hasCatalogRecipeCooldown(catalogMatch)) {
    reasons.push('catalog_recipe_cooldown');
  }
  return reasons;
}

function buildCatalogProvenance({
  catalogMatch,
  returnedDirect,
}: {
  catalogMatch: WorkoutCatalogMatch;
  returnedDirect: boolean;
}): WorkoutCatalogProvenance | undefined {
  const recipe = catalogMatch.recipe;
  if (!recipe) {
    return undefined;
  }

  return {
    recipeId: recipe.id,
    recipeSlug: recipe.slug,
    ownership: recipe.ownership,
    catalogVersion: recipe.catalogVersion,
    matchDecision: catalogMatch.decision,
    returnedDirect,
  };
}

function buildCatalogSeed(
  catalogMatch: WorkoutCatalogMatch | undefined
): CatalogSeed | undefined {
  const plan = catalogMatch?.plan;
  if (!plan || !shouldProvideCatalogSeed(catalogMatch)) {
    return undefined;
  }
  const hasCooldown = hasCatalogRecipeCooldown(catalogMatch);

  return {
    focus: plan.focus,
    durationMinutes: plan.durationMinutes,
    equipment: plan.equipment,
    source: 'library',
    energy: plan.energy,
    summary: plan.summary,
    blocks: plan.blocks.map((block) => ({
      title: block.title,
      durationMinutes: block.durationMinutes,
      focus: block.focus,
      exercises: block.exercises.map((exercise) => ({
        name: exercise.name,
        prescription: exercise.prescription,
        detail: exercise.detail,
      })),
    })),
    instructions: hasCooldown
      ? "Preserve the catalog seed's training intent, duration, equipment fit, and safety constraints, but vary exercises or structure enough that the result does not repeat the recent catalog workout too closely."
      : "Preserve the catalog seed's training intent, duration, equipment fit, and safety constraints while adapting the exercises, structure, or prescriptions to better fit the user's request.",
  };
}

function shouldProvideCatalogSeed(
  catalogMatch: WorkoutCatalogMatch | undefined
): boolean {
  return Boolean(
    isUsableCatalogMatch(catalogMatch) &&
      (catalogMatch?.decision === 'adapt' ||
        hasCatalogRecipeCooldown(catalogMatch))
  );
}

function buildCatalogQuery({
  request,
  context,
  planningBrief,
  exerciseLibrary,
  previousPlan,
}: {
  request: GenerationRequestWithContext;
  context: Awaited<ReturnType<typeof loadGenerationContext>>;
  planningBrief: PlanningBrief;
  exerciseLibrary: ExerciseLibrary;
  previousPlan?: TodayPlan | null;
}): WorkoutCatalogQuery {
  return {
    timeMinutes: planningBrief.durationMinutes,
    focus: planningBrief.resolvedFocus,
    focusTags: planningBrief.blockIntents.flatMap(
      (intent) => intent.candidateFocusTags
    ),
    availableEquipment: planningBrief.availableEquipment,
    experienceLevel: context.userProfile.experienceLevel,
    energy: normalizeCatalogEnergy(
      request.energy ?? context.userProfile.energyToday
    ),
    contraindicationTags: normalizeContraindicationTags(
      context.preferences.injuries ?? []
    ),
    avoidTags: normalizeAvoidTags(context.preferences.avoid ?? []),
    disallowedStressors: planningBrief.disallowedStressors,
    recentExerciseIds: resolveRecentExerciseIds({
      context,
      exerciseLibrary,
      previousPlan: request.baselineWorkout ?? previousPlan,
    }),
    recentCatalogRecipeIds: resolveRecentCatalogRecipeIds({
      context,
      previousPlan: request.baselineWorkout ?? previousPlan,
      planningDateLocal: request.planningDateLocal,
    }),
    adaptivePlanIntent: request.adaptivePlanIntent
      ? {
          role: request.adaptivePlanIntent.primaryBlock.role,
          category: request.adaptivePlanIntent.primaryBlock.category,
          label: request.adaptivePlanIntent.primaryBlock.label,
          stressTags: request.adaptivePlanIntent.primaryBlock.stressTags,
        }
      : undefined,
  };
}

function resolveRecentCatalogRecipeIds({
  context,
  previousPlan,
  planningDateLocal,
}: {
  context: Awaited<ReturnType<typeof loadGenerationContext>>;
  previousPlan?: TodayPlan | null;
  planningDateLocal?: string;
}): string[] {
  const ids = new Set<string>();
  const previousRecipeId = getCatalogRecipeId(previousPlan);
  if (previousRecipeId) {
    ids.add(previousRecipeId);
  }

  const cutoffMs =
    getPlanningTimestamp(planningDateLocal) -
    CATALOG_RECIPE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;

  for (const session of context.recentSessions) {
    const completedAtMs = Date.parse(session.completedAt);
    if (!Number.isNaN(completedAtMs) && completedAtMs < cutoffMs) {
      continue;
    }
    const recipeId = session.catalogProvenance?.recipeId;
    if (recipeId) {
      ids.add(recipeId);
    }
  }

  return [...ids];
}

function getCatalogRecipeId(plan?: TodayPlan | null): string | undefined {
  if (plan?.catalogProvenance?.recipeId) {
    return plan.catalogProvenance.recipeId;
  }
  if (plan?.source === 'library' && plan.id.startsWith('library:')) {
    return `catalog:${plan.id.slice('library:'.length)}`;
  }
  return undefined;
}

function getPlanningTimestamp(planningDateLocal: string | undefined): number {
  if (!planningDateLocal) {
    return Date.now();
  }
  const parsed = Date.parse(`${planningDateLocal}T12:00:00.000Z`);
  return Number.isNaN(parsed) ? Date.now() : parsed;
}

function normalizeCatalogEnergy(
  value: string | undefined
): WorkoutCatalogEnergy | undefined {
  return value === 'easy' || value === 'moderate' || value === 'intense'
    ? value
    : undefined;
}

function resolveRecentExerciseIds({
  context,
  exerciseLibrary,
  previousPlan,
}: {
  context: Awaited<ReturnType<typeof loadGenerationContext>>;
  exerciseLibrary: ExerciseLibrary;
  previousPlan?: TodayPlan | null;
}): string[] {
  const ids = new Set<string>();

  for (const block of previousPlan?.blocks ?? []) {
    for (const exercise of block.exercises) {
      ids.add(exercise.id.split(':').slice(0, 2).join(':'));
    }
  }

  for (const name of context.recentSessions.flatMap(
    (session) => session.exerciseNames ?? []
  )) {
    const exercise = exerciseLibrary.getExerciseByAlias(name);
    if (exercise) {
      ids.add(exercise.id);
    }
  }

  return [...ids].slice(0, 30);
}

function normalizeToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

function normalizeContraindicationTags(values: string[]): string[] {
  const tags = new Set<string>();

  for (const value of values) {
    const normalized = normalizeToken(value);
    if (normalized.includes('shoulder')) {
      tags.add('shoulder_irritation');
    }
    if (normalized.includes('back') || normalized.includes('lumbar')) {
      tags.add('lower_back_sensitivity');
    }
    if (normalized.includes('knee')) {
      tags.add('knee_sensitivity');
    }
  }

  return [...tags];
}

function normalizeAvoidTags(values: string[]): string[] {
  const tags = new Set<string>();

  for (const value of values) {
    const normalized = normalizeToken(value);
    if (normalized.includes('burpee')) {
      tags.add('burpee');
    }
    if (normalized.includes('jump')) {
      tags.add('jumping');
    }
    if (normalized.includes('overhead')) {
      tags.add('overhead_pressing');
    }
  }

  return [...tags];
}

/**
 * Factory for creating the POST /api/workouts/generate handler
 *
 * Accepts quick-action parameters and generates a workout plan.
 * Returns the generated TodayPlan.
 *
 * Handles BYOK/offline rejection cases.
 */
export function createGenerateHandler(deps: GenerateHandlerDeps) {
  return async function generateHandler(request: Request): Promise<Response> {
    const { requestId, urlPath, startedAt, log } = createRequestContext(
      request,
      'workouts.generate'
    );

    const errorResponse = (
      code: Parameters<typeof createErrorResponse>[0],
      message: string,
      status: number,
      retryAfter?: number,
      upgrade?: Parameters<typeof createErrorResponse>[4]
    ): Response => {
      const response = createErrorResponse(
        code,
        message,
        status,
        retryAfter,
        upgrade
      );
      attachRequestId(response, requestId);
      log.info('request completed', {
        method: request.method,
        path: urlPath,
        status,
        durationMs: Date.now() - startedAt,
        code,
      });
      return response;
    };

    // Authenticate request
    const auth = await deps.auth.authenticate(request);
    if (!auth) {
      log.info('request unauthorized', {
        method: request.method,
        path: urlPath,
      });
      return errorResponse('UNAUTHORIZED', 'Invalid or missing session', 401);
    }

    // Parse and validate request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      log.warn('invalid json body', { method: request.method, path: urlPath });
      return errorResponse(
        'VALIDATION_ERROR',
        'Invalid JSON in request body',
        400
      );
    }

    const parseResult = generationRequestPayloadSchema.safeParse(body);
    if (!parseResult.success) {
      log.warn('request validation failed', {
        method: request.method,
        path: urlPath,
        issues: parseResult.error.issues.length,
      });
      return errorResponse(
        'VALIDATION_ERROR',
        `Invalid request: ${parseResult.error.message}`,
        400
      );
    }

    const generationRequest: GenerationRequestWithContext = parseResult.data;
    const creationMode = generationRequest.creationMode ?? 'auto';

    // Extract provider from header (defaults based on legacy header or config)
    const providerHeader = request.headers
      .get('x-ai-provider')
      ?.trim()
      .toLowerCase();
    const openaiKeyHeader = request.headers.get('x-openai-key')?.trim();
    const geminiKeyHeader = request.headers.get('x-gemini-key')?.trim();
    const genericKeyHeader = request.headers.get('x-ai-key')?.trim();

    // Determine provider: explicit header > legacy x-openai-key inference > config default
    let provider: AiProviderName;
    if (providerHeader) {
      if (
        !deps.router.isSupportedProvider(providerHeader) &&
        creationMode !== 'library'
      ) {
        return errorResponse(
          'INVALID_PROVIDER',
          `Unsupported provider: ${providerHeader}. Supported providers: openai, gemini, openrouter`,
          400
        );
      }
      provider = deps.router.isSupportedProvider(providerHeader)
        ? (providerHeader as AiProviderName)
        : ((deps.config.defaultProvider ??
            deps.router.getDefaultProvider()) as AiProviderName);
    } else if (openaiKeyHeader) {
      // Legacy: x-openai-key implies OpenAI
      provider = 'openai';
    } else {
      // Default from config or router
      const defaultProvider =
        deps.config.defaultProvider ?? deps.router.getDefaultProvider();
      provider = defaultProvider as AiProviderName;
    }

    // Determine if Vertex AI should be used
    const useVertexAi = Boolean(
      provider === 'gemini' &&
        deps.config.useVertexAi &&
        deps.config.googleCloudProject &&
        deps.config.googleCloudLocation
    );

    // Extract API key based on provider
    // Priority: BYOK header > server default key
    let apiKey: string | null = null;
    if (provider === 'openai') {
      apiKey =
        openaiKeyHeader ||
        genericKeyHeader ||
        deps.config.defaultApiKeys?.openai ||
        null;
    } else if (provider === 'gemini') {
      apiKey =
        geminiKeyHeader ||
        genericKeyHeader ||
        deps.config.defaultApiKeys?.gemini ||
        (useVertexAi ? 'vertex-env' : null);
    } else if (provider === 'openrouter') {
      apiKey =
        genericKeyHeader || deps.config.defaultApiKeys?.openrouter || null;
    }

    const isByok = Boolean(
      openaiKeyHeader || geminiKeyHeader || genericKeyHeader
    );
    const allowUnconfiguredProvider = Boolean(
      deps.config.allowUnconfiguredProvider
    );

    let quotaReservationActive = false;

    const rollbackManagedReservation = async (): Promise<void> => {
      if (!quotaReservationActive) {
        return;
      }
      quotaReservationActive = false;
      if (!deps.policy?.rollbackGenerateReservation) {
        return;
      }
      try {
        await deps.policy.rollbackGenerateReservation(
          auth.userId,
          generationRequest
        );
      } catch (error) {
        log.warn('failed to rollback managed quota reservation', {
          message: sanitizeErrorMessage((error as Error).message),
          error,
        });
      }
    };

    try {
      const context = await loadGenerationContext(
        auth.userId,
        generationRequest
      );
      const isRegeneration = Boolean(
        generationRequest.previousResponseId ||
          generationRequest.baselineWorkout
      );
      let previousState: GenerationState | null = null;

      try {
        previousState = await deps.store.getState(auth.principalId);
      } catch (error) {
        log.warn('failed to load previous generation state', {
          error,
          principalId: auth.principalId,
        });
      }
      const providerRequest = createProviderRequest(
        generationRequest,
        provider,
        previousState?.plan ?? null
      );
      const planningBrief = derivePlanningBrief({
        request: providerRequest,
        context,
        provider,
        previousPlan: previousState?.plan,
      });
      let effectivePlanningBrief = planningBrief;
      let stageOneArtifact: StageOnePlannerArtifact | undefined;
      let candidatePool:
        | ReturnType<typeof buildExerciseCandidatePool>
        | undefined;
      let exerciseLibrary: ExerciseLibrary | undefined;
      let exerciseLibraryLoadAttempted = false;
      let catalogMatch: WorkoutCatalogMatch | undefined;
      let catalogSeed: CatalogSeed | undefined;
      let catalogUnavailable = false;
      const providerCanRun = Boolean(
        apiKey || useVertexAi || allowUnconfiguredProvider
      );
      const loadAvailableExerciseLibrary = async (): Promise<
        ExerciseLibrary | undefined
      > => {
        if (exerciseLibrary) {
          return exerciseLibrary;
        }
        if (exerciseLibraryLoadAttempted) {
          return undefined;
        }

        exerciseLibraryLoadAttempted = true;
        exerciseLibrary =
          deps.exerciseLibrary ?? (await deps.loadExerciseLibrary?.());
        return exerciseLibrary;
      };

      if (shouldAttemptCatalog(creationMode)) {
        try {
          const catalogLibrary = await loadAvailableExerciseLibrary();
          if (catalogLibrary) {
            catalogMatch = catalogLibrary.matchWorkoutCatalog(
              buildCatalogQuery({
                request: providerRequest,
                context,
                planningBrief: effectivePlanningBrief,
                exerciseLibrary: catalogLibrary,
                previousPlan: previousState?.plan,
              })
            );
            log.info('workout catalog match evaluated', {
              creationMode,
              decision: catalogMatch.decision,
              selectedRecipeId: catalogMatch.diagnostics.selectedRecipeId,
              score: catalogMatch.score,
              blockerCodes: catalogMatch.diagnostics.blockerCodes,
              candidateCount: catalogMatch.diagnostics.candidateCount,
            });

            if (
              shouldReturnCatalogMatch(
                creationMode,
                catalogMatch,
                providerCanRun
              )
            ) {
              const validated = todayPlanSchema.parse({
                ...catalogMatch.plan,
                equipment: effectivePlanningBrief.availableEquipment,
                catalogProvenance: buildCatalogProvenance({
                  catalogMatch,
                  returnedDirect: true,
                }),
              });
              await deps.store.persistPlan(auth.principalId, validated, {
                schemaVersion: `catalog:${
                  catalogMatch.recipe?.catalogVersion ?? 'unknown'
                }`,
              });
              log.info('generation completed', {
                durationMs: Date.now() - startedAt,
                source: 'library',
                creationMode,
                catalogDecision: catalogMatch.decision,
                selectedRecipeId: catalogMatch.recipe?.id,
                isRegeneration,
              });

              const response = Response.json(validated);
              attachRequestId(response, requestId);
              log.info('request completed', {
                method: request.method,
                path: urlPath,
                status: 200,
                durationMs: Date.now() - startedAt,
              });
              return response;
            }
          }
        } catch (error) {
          catalogUnavailable = true;
          log.warn('workout catalog unavailable', {
            message: sanitizeErrorMessage((error as Error).message),
            creationMode,
          });
        }

        if (creationMode === 'library') {
          if (catalogUnavailable) {
            return errorResponse(
              'WORKOUT_CATALOG_UNAVAILABLE',
              'Workout catalog is temporarily unavailable',
              503
            );
          }

          return errorResponse(
            'WORKOUT_CATALOG_NO_MATCH',
            'No catalog workout matched this request',
            404
          );
        }

        const catalogFallbackReasons =
          buildCatalogFallbackReasons(catalogMatch);
        if (catalogFallbackReasons.length) {
          effectivePlanningBrief = {
            ...effectivePlanningBrief,
            fallbackReasons: [
              ...effectivePlanningBrief.fallbackReasons,
              ...catalogFallbackReasons.filter(
                (reason) =>
                  !effectivePlanningBrief.fallbackReasons.includes(reason)
              ),
            ],
          };
          catalogSeed = providerCanRun
            ? buildCatalogSeed(catalogMatch)
            : undefined;
        }
      }

      const providerCatalogMatch = isUsableCatalogMatch(catalogMatch)
        ? catalogMatch
        : undefined;

      if (
        !apiKey &&
        !useVertexAi &&
        deps.config.edition === 'HOSTED' &&
        !allowUnconfiguredProvider
      ) {
        return errorResponse(
          'BYOK_REQUIRED',
          `API key required for ${provider} provider in hosted mode`,
          402
        );
      }

      if (!apiKey && !useVertexAi && !allowUnconfiguredProvider) {
        return errorResponse(
          'AI_PROVIDER_NOT_CONFIGURED',
          `No API key or server-managed ${provider} provider configuration is available`,
          503
        );
      }

      // Check policy (quota/rate limits) for managed-key requests only.
      // BYOK requests are self-funded and bypass entitlement quotas.
      if (deps.policy && !isByok) {
        const policyResult = await deps.policy.canGenerate(
          auth.userId,
          generationRequest
        );
        if (!policyResult.allowed) {
          return errorResponse(
            'QUOTA_EXCEEDED',
            policyResult.reason ?? 'Quota exceeded',
            policyResult.statusCode ?? 429,
            undefined,
            policyResult.upgrade
          );
        }
        quotaReservationActive = true;
      }

      if (
        (deps.exerciseLibrary || deps.loadExerciseLibrary) &&
        (apiKey || useVertexAi)
      ) {
        try {
          const exerciseLibrary = await loadAvailableExerciseLibrary();

          if (exerciseLibrary) {
            candidatePool = buildExerciseCandidatePool({
              exerciseLibrary,
              request: providerRequest,
              context,
              planningBrief: effectivePlanningBrief,
              previousPlan: previousState?.plan,
            });
            if (
              candidatePool.candidateExercises.length === 0 &&
              candidatePool.diagnostics?.blockerCodes?.length
            ) {
              effectivePlanningBrief = {
                ...effectivePlanningBrief,
                fallbackReasons: candidatePool.diagnostics.blockerCodes,
              };
            }
            effectivePlanningBrief = promoteStageOneForCandidateOverflow(
              effectivePlanningBrief,
              candidatePool
            );
            log.info('exercise candidate pool prepared', {
              libraryVersion: candidatePool.libraryVersion,
              totalEligibleCount: candidatePool.totalEligibleCount,
              candidateCount: candidatePool.candidateExercises.length,
              stagedPlanningReasons:
                effectivePlanningBrief.stagedPlanning.reasons,
              baselineExerciseCount: candidatePool.baselineExerciseIds.length,
              blockerCodes: candidatePool.diagnostics?.blockerCodes,
              fallbackReasons: effectivePlanningBrief.fallbackReasons,
              isRegeneration,
            });
          }
        } catch (error) {
          log.warn('exercise candidate pool unavailable', {
            message: sanitizeErrorMessage((error as Error).message),
            isRegeneration,
          });
        }
      }

      if (
        deps.config.enableStageOnePlanner &&
        deps.planner &&
        effectivePlanningBrief.stagedPlanning.shouldRun &&
        (apiKey || useVertexAi)
      ) {
        try {
          stageOneArtifact = await deps.planner.plan(providerRequest, context, {
            apiKey: useVertexAi ? undefined : apiKey ?? undefined,
            candidatePool,
            planningBrief: effectivePlanningBrief,
            provider,
            useVertexAi,
          });
          log.info('stage-one planner completed', {
            provider,
            confidence: stageOneArtifact.confidence,
            resolvedFocus: stageOneArtifact.resolvedFocus,
            noveltyTarget: stageOneArtifact.noveltyTarget,
            rerankHintCount: stageOneArtifact.rerankHints.length,
            reasons: effectivePlanningBrief.stagedPlanning.reasons,
          });
          if (candidatePool) {
            candidatePool = rerankExerciseCandidatePool(
              candidatePool,
              stageOneArtifact
            );
          }
        } catch (error) {
          log.warn('stage-one planner unavailable', {
            provider,
            message: sanitizeErrorMessage((error as Error).message),
            reasons: effectivePlanningBrief.stagedPlanning.reasons,
          });
        }
      }

      // Log generation start (NEVER log API keys, prompts, or free-form feedback)
      log.info('generation started', {
        creationMode,
        provider,
        hasApiKey: Boolean(apiKey),
        isByok,
        catalogDecision: catalogMatch?.decision,
        catalogRecipeId: catalogMatch?.recipe?.id,
        isRegeneration: effectivePlanningBrief.regeneration.isRegeneration,
        focusMode: effectivePlanningBrief.focusMode,
        resolvedFocus: effectivePlanningBrief.resolvedFocus,
        regenerationMode: effectivePlanningBrief.regeneration.mode,
        stagedPlanningMode: effectivePlanningBrief.stagedPlanning.mode,
        stagedPlanningReasons: effectivePlanningBrief.stagedPlanning.reasons,
        fallbackReasons: effectivePlanningBrief.fallbackReasons,
        hasFeedback: (generationRequest.feedback?.length ?? 0) > 0,
        feedbackCount: generationRequest.feedback?.length ?? 0,
      });

      // Use principalId for device-scoped state (GenerationStore)
      await deps.store.markPending(
        auth.principalId,
        DEFAULT_GENERATION_ETA_SECONDS
      );

      let plan: TodayPlan;
      let responseId: string | undefined;
      let schemaVersion: string | undefined;

      try {
        const result = await deps.router.generate(providerRequest, context, {
          apiKey: useVertexAi ? undefined : apiKey ?? undefined,
          candidatePool,
          catalogMatch: providerCatalogMatch,
          catalogSeed,
          planningBrief: effectivePlanningBrief,
          stageOneArtifact,
          provider,
          useVertexAi,
        });
        plan = result.plan;
        responseId = result.responseId;
        schemaVersion = result.schemaVersion;

        const providerResponseId = plan.responseId ?? responseId;
        plan = {
          ...plan,
          responseId: providerResponseId,
          generationProvenance: {
            provider,
            ...(providerResponseId ? { responseId: providerResponseId } : {}),
          },
          catalogProvenance: providerCatalogMatch
            ? buildCatalogProvenance({
                catalogMatch: providerCatalogMatch,
                returnedDirect: false,
              })
            : undefined,
        };
      } catch (error) {
        const sanitizedMessage = sanitizeErrorMessage((error as Error).message);
        log.warn('ai generation failed', {
          provider,
          message: sanitizedMessage,
          error,
        });
        await deps.store.setError(
          auth.principalId,
          'We could not generate a workout plan. Please try again.'
        );
        await rollbackManagedReservation();
        return errorResponse('AI_GENERATION_ERROR', sanitizedMessage, 502);
      }

      plan = {
        ...plan,
        equipment: effectivePlanningBrief.availableEquipment,
      };

      const validated = todayPlanSchema.parse(plan);

      await deps.store.persistPlan(auth.principalId, validated, {
        schemaVersion,
      });
      quotaReservationActive = false;
      log.info('generation completed', {
        durationMs: Date.now() - startedAt,
        source: 'ai',
        creationMode,
        catalogDecision: catalogMatch?.decision,
        catalogRecipeId: catalogMatch?.recipe?.id,
        isRegeneration,
        responseId,
        schemaVersion,
      });

      // Record metering event
      if (deps.metering && apiKey) {
        await deps.metering.recordUsage({
          userId: auth.userId,
          operation: effectivePlanningBrief.regeneration.isRegeneration
            ? 'regenerate'
            : 'generate',
          provider,
          byok: isByok,
          timestamp: new Date().toISOString(),
          durationMs: Date.now() - startedAt,
          metadata: {
            responseId,
            schemaVersion,
          },
        });
      }

      const response = Response.json(validated);
      attachRequestId(response, requestId);
      log.info('request completed', {
        method: request.method,
        path: urlPath,
        status: 200,
        durationMs: Date.now() - startedAt,
      });
      return response;
    } catch (error) {
      await rollbackManagedReservation();
      throw error;
    }
  };
}
