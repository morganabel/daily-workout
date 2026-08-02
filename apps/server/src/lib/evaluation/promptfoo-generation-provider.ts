import type {
  GenerationEvaluationHardCheckResult,
  GenerationEvaluationProvider,
  GenerationEvaluationReportEntry,
} from '@workout-agent/shared';

export type PromptfooGenerationProviderVars = {
  scenarioId: string;
  provider?: GenerationEvaluationProvider;
  runIndex?: number;
  edition?: 'CE' | 'HOSTED';
  variantLabel?: string;
  plannerMode?: 'default' | 'enabled' | 'disabled';
  softReview?: boolean;
};

export type PromptfooGenerationProviderOutput = {
  scenarioId: string;
  scenarioTitle: string;
  scenarioTags: string[];
  scenarioMode: string;
  provider: GenerationEvaluationProvider;
  executionSource: string;
  status: string;
  runId: string;
  promptfooRunId: string;
  variantLabel: string;
  plannerMode: 'default' | 'enabled' | 'disabled';
  pass: boolean;
  failedHardChecks: GenerationEvaluationHardCheckResult[];
  hardChecks: GenerationEvaluationHardCheckResult[];
  latencyMs: GenerationEvaluationReportEntry['latencyMs'];
  plannerSummary: GenerationEvaluationReportEntry['plannerSummary'];
  plan?: GenerationEvaluationReportEntry['plan'];
  errorCode?: string;
  errorMessage?: string;
  warnings: string[];
};

export type PromptfooGradingResult = {
  pass: boolean;
  score: number;
  reason: string;
};

export function parsePromptfooGenerationProviderVars(
  vars: Record<string, unknown>
): PromptfooGenerationProviderVars {
  const scenarioId = vars.scenarioId;
  if (typeof scenarioId !== 'string' || scenarioId.trim().length === 0) {
    throw new Error('Promptfoo generation provider requires vars.scenarioId.');
  }

  const provider = vars.provider;
  const runIndex = Number(vars.runIndex ?? 1);
  const edition = vars.edition;
  const plannerMode = vars.plannerMode;

  if (
    provider !== undefined &&
    provider !== 'fixture' &&
    provider !== 'openai' &&
    provider !== 'gemini' &&
    provider !== 'openrouter'
  ) {
    throw new Error(
      `Unsupported Promptfoo generation provider: ${String(provider)}`
    );
  }
  if (!Number.isInteger(runIndex) || runIndex < 1) {
    throw new Error(
      'Promptfoo generation provider vars.runIndex must be an integer >= 1.'
    );
  }
  if (edition !== undefined && edition !== 'CE' && edition !== 'HOSTED') {
    throw new Error(
      `Unsupported Promptfoo generation edition: ${String(edition)}`
    );
  }
  if (
    plannerMode !== undefined &&
    plannerMode !== 'default' &&
    plannerMode !== 'enabled' &&
    plannerMode !== 'disabled'
  ) {
    throw new Error(
      `Unsupported Promptfoo generation planner mode: ${String(plannerMode)}`
    );
  }

  return {
    scenarioId: scenarioId.trim(),
    provider: provider as GenerationEvaluationProvider | undefined,
    runIndex,
    edition: edition as 'CE' | 'HOSTED' | undefined,
    variantLabel:
      typeof vars.variantLabel === 'string' &&
      vars.variantLabel.trim().length > 0
        ? vars.variantLabel.trim()
        : undefined,
    plannerMode: plannerMode as 'default' | 'enabled' | 'disabled' | undefined,
    softReview: Boolean(vars.softReview),
  };
}

export function buildPromptfooGenerationProviderOutput(params: {
  entry: GenerationEvaluationReportEntry;
  warnings?: string[];
  variantLabel?: string;
  plannerMode?: 'default' | 'enabled' | 'disabled';
  promptfooRunId?: string;
}): PromptfooGenerationProviderOutput {
  const failedHardChecks = params.entry.hardChecks.filter(
    (check) => check.status === 'fail'
  );
  const variantLabel = params.variantLabel?.trim() || 'default';
  const plannerMode = params.plannerMode ?? 'default';
  const promptfooRunId =
    params.promptfooRunId ??
    `${params.entry.scenarioId}-${params.entry.provider}-${variantLabel}-${params.entry.runId}`;

  return {
    scenarioId: params.entry.scenarioId,
    scenarioTitle: params.entry.scenarioTitle,
    scenarioTags: params.entry.scenarioTags,
    scenarioMode: params.entry.scenarioMode,
    provider: params.entry.provider,
    executionSource: params.entry.executionSource,
    status: params.entry.status,
    runId: params.entry.runId,
    promptfooRunId,
    variantLabel,
    plannerMode,
    pass: params.entry.status === 'success' && failedHardChecks.length === 0,
    failedHardChecks,
    hardChecks: params.entry.hardChecks,
    latencyMs: params.entry.latencyMs,
    plannerSummary: params.entry.plannerSummary,
    plan: params.entry.plan,
    errorCode: params.entry.errorCode,
    errorMessage: params.entry.errorMessage,
    warnings: params.warnings ?? [],
  };
}

export function gradePromptfooGenerationOutput(
  output: PromptfooGenerationProviderOutput
): PromptfooGradingResult {
  if (output.status !== 'success') {
    return {
      pass: false,
      score: 0,
      reason:
        output.errorMessage ??
        `Generation failed with status ${output.status}.`,
    };
  }

  if (output.failedHardChecks.length > 0) {
    return {
      pass: false,
      score: 0,
      reason: `Failed hard checks: ${output.failedHardChecks
        .map((check) => check.name)
        .join(', ')}.`,
    };
  }

  return {
    pass: true,
    score: 1,
    reason: 'Generation succeeded and all domain hard checks passed.',
  };
}

export function parsePromptfooGenerationOutput(
  raw: unknown
): PromptfooGenerationProviderOutput {
  if (typeof raw !== 'string') {
    return raw as PromptfooGenerationProviderOutput;
  }

  return JSON.parse(raw) as PromptfooGenerationProviderOutput;
}
