import {
  generationEvaluationProviderSchema,
  type EvaluationScenarioId,
  type EvaluationScenarioTag,
  type GenerationEvaluationProvider,
  type GenerationEvaluationScenario,
} from '../contracts/generation-evaluation';
import { workoutGenerationEvaluationScenarios } from './workout-generation-scenarios';

export type PromptfooGenerationEdition = 'CE' | 'HOSTED';

export type PromptfooGenerationSelectionOptions = {
  scenarioIds?: string[];
  tags?: string[];
  limit?: number;
};

export type PromptfooGenerationTestOptions =
  PromptfooGenerationSelectionOptions & {
    providers: GenerationEvaluationProvider[];
    runs: number;
    edition: PromptfooGenerationEdition;
    variantLabel?: string;
    plannerMode?: 'default' | 'enabled' | 'disabled';
    softReview?: boolean;
  };

export type PromptfooGenerationTestCase = {
  description: string;
  metadata: {
    scenarioTitle: string;
    scenarioTags: EvaluationScenarioTag[];
    scenarioMode: GenerationEvaluationScenario['mode'];
  };
  vars: {
    scenarioId: EvaluationScenarioId;
    scenarioTitle: string;
    scenarioMode: GenerationEvaluationScenario['mode'];
    provider: GenerationEvaluationProvider;
    runIndex: number;
    edition: PromptfooGenerationEdition;
    variantLabel: string;
    plannerMode: 'default' | 'enabled' | 'disabled';
    softReview: boolean;
  };
};

export type PromptfooGenerationProviderAvailability = Partial<
  Record<Exclude<GenerationEvaluationProvider, 'fixture'>, boolean>
>;

export type PromptfooGenerationPreflightSummary = {
  selectedScenarioCount: number;
  liveProviderCount: number;
  liveAttemptCount: number;
  regenerationPrimingAttemptCount: number;
  warnings: string[];
};

export type PromptfooSecretCandidate = {
  label: string;
  value?: string;
};

const DEFAULT_LIVE_ATTEMPT_WARNING_THRESHOLD = 100;

function uniqueValues(values: string[] | undefined): string[] {
  return [
    ...new Set((values ?? []).map((value) => value.trim()).filter(Boolean)),
  ];
}

function assertPositiveInteger(value: number | undefined, name: string): void {
  if (value === undefined) {
    return;
  }
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${name} must be an integer >= 1.`);
  }
}

function assertSupportedProviders(
  providers: GenerationEvaluationProvider[]
): void {
  if (providers.length === 0) {
    throw new Error('At least one Promptfoo generation provider is required.');
  }

  providers.forEach((provider) =>
    generationEvaluationProviderSchema.parse(provider)
  );
}

export function selectPromptfooGenerationScenarios(
  options: PromptfooGenerationSelectionOptions = {}
): GenerationEvaluationScenario[] {
  const scenarioIds = uniqueValues(options.scenarioIds);
  const tags = uniqueValues(options.tags);
  assertPositiveInteger(options.limit, 'limit');

  const allScenarioIds = new Set(
    workoutGenerationEvaluationScenarios.map((scenario) => scenario.id)
  );
  const missingScenarioIds = scenarioIds.filter(
    (id) => !allScenarioIds.has(id)
  );
  if (missingScenarioIds.length > 0) {
    throw new Error(
      `Unknown generation evaluation scenario id(s): ${missingScenarioIds.join(
        ', '
      )}`
    );
  }

  let scenarios = workoutGenerationEvaluationScenarios;

  if (scenarioIds.length > 0) {
    const selected = new Set(scenarioIds);
    scenarios = scenarios.filter((scenario) => selected.has(scenario.id));
  }

  if (tags.length > 0) {
    scenarios = scenarios.filter((scenario) =>
      tags.every((tag) => scenario.tags.includes(tag))
    );
  }

  if (options.limit !== undefined) {
    scenarios = scenarios.slice(0, options.limit);
  }

  if (scenarios.length === 0) {
    throw new Error(
      'No generation evaluation scenarios matched the provided Promptfoo filters.'
    );
  }

  return scenarios;
}

export function buildPromptfooGenerationTestCases(
  options: PromptfooGenerationTestOptions
): PromptfooGenerationTestCase[] {
  assertSupportedProviders(options.providers);
  assertPositiveInteger(options.runs, 'runs');

  const scenarios = selectPromptfooGenerationScenarios(options);
  const variantLabel = options.variantLabel?.trim() || 'default';
  const plannerMode = options.plannerMode ?? 'default';

  return scenarios.flatMap((scenario) =>
    options.providers.flatMap((provider) =>
      Array.from({ length: options.runs }, (_, index) => ({
        description: `${scenario.id} / ${provider} / run ${
          index + 1
        } / ${variantLabel}`,
        metadata: {
          scenarioTitle: scenario.title,
          scenarioTags: scenario.tags,
          scenarioMode: scenario.mode,
        },
        vars: {
          scenarioId: scenario.id,
          scenarioTitle: scenario.title,
          scenarioMode: scenario.mode,
          provider,
          runIndex: index + 1,
          edition: options.edition,
          variantLabel,
          plannerMode,
          softReview: Boolean(options.softReview),
        },
      }))
    )
  );
}

export function buildPromptfooGenerationPreflightSummary(params: {
  scenarios: GenerationEvaluationScenario[];
  providers: GenerationEvaluationProvider[];
  runs: number;
  edition: PromptfooGenerationEdition;
  providerAvailability?: PromptfooGenerationProviderAvailability;
  liveAttemptWarningThreshold?: number;
}): PromptfooGenerationPreflightSummary {
  assertSupportedProviders(params.providers);
  assertPositiveInteger(params.runs, 'runs');

  const liveProviders = params.providers.filter(
    (provider) => provider !== 'fixture'
  );
  const regenerationScenarioCount = params.scenarios.filter(
    (scenario) => scenario.mode === 'regeneration'
  ).length;
  const regenerationPrimingAttemptCount =
    regenerationScenarioCount * params.runs * liveProviders.length;
  const liveAttemptCount =
    params.scenarios.length * params.runs * liveProviders.length +
    regenerationPrimingAttemptCount;
  const warnings: string[] = [];

  liveProviders.forEach((provider) => {
    const hasAccess = params.providerAvailability?.[provider];
    if (hasAccess === undefined) {
      warnings.push(
        `${provider} access was not checked; live Promptfoo runs may fail if provider credentials are unavailable.`
      );
      return;
    }
    if (params.edition === 'CE' && hasAccess === false) {
      warnings.push(
        `${provider} has no configured access in CE; matching Promptfoo runs are expected to fail with provider configuration errors unless keys are provided.`
      );
    }
    if (params.edition === 'HOSTED' && hasAccess === false) {
      warnings.push(
        `${provider} has no configured access in HOSTED mode; live Promptfoo runs should fail or be stopped before broad execution.`
      );
    }
  });

  if (
    liveAttemptCount >=
    (params.liveAttemptWarningThreshold ??
      DEFAULT_LIVE_ATTEMPT_WARNING_THRESHOLD)
  ) {
    warnings.push(
      `Promptfoo generation run is configured for ${liveAttemptCount} live-provider attempts including ${regenerationPrimingAttemptCount} regeneration priming attempts. Review provider cost and quota implications before execution.`
    );
  }

  if (params.providers.length === 1 && params.providers[0] === 'fixture') {
    warnings.push(
      'Promptfoo generation run is fixture-only. Use it for plumbing and hard-check validation, not live model-quality conclusions.'
    );
  }

  return {
    selectedScenarioCount: params.scenarios.length,
    liveProviderCount: liveProviders.length,
    liveAttemptCount,
    regenerationPrimingAttemptCount,
    warnings,
  };
}

function collectStringValues(
  value: unknown,
  path: string,
  output: Map<string, string>
): void {
  if (typeof value === 'string') {
    output.set(path, value);
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      collectStringValues(item, `${path}[${index}]`, output)
    );
    return;
  }

  if (value && typeof value === 'object') {
    Object.entries(value as Record<string, unknown>).forEach(([key, item]) =>
      collectStringValues(item, path ? `${path}.${key}` : key, output)
    );
  }
}

export function findPromptfooSecretLeaks(
  artifact: unknown,
  secrets: PromptfooSecretCandidate[]
): string[] {
  const values = new Map<string, string>();
  collectStringValues(artifact, '', values);

  return secrets.flatMap((secret) => {
    const candidate = secret.value?.trim();
    if (!candidate || candidate.length < 4) {
      return [];
    }

    return [...values.entries()]
      .filter(([, value]) => value.includes(candidate))
      .map(([path]) => `${secret.label} leaked at ${path || '<root>'}`);
  });
}

export function assertPromptfooArtifactHasNoSecrets(
  artifact: unknown,
  secrets: PromptfooSecretCandidate[]
): void {
  const leaks = findPromptfooSecretLeaks(artifact, secrets);
  if (leaks.length > 0) {
    throw new Error(
      `Promptfoo artifact contains secret values: ${leaks.join('; ')}`
    );
  }
}
