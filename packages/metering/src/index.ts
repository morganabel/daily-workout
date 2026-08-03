/**
 * Provider-neutral LLM usage accounting.
 *
 * Money is stored as integer nano-USD and serialized as a decimal string so
 * tiny per-request costs can be summed without floating-point drift.
 */

export type ModelProvider = 'openai' | 'gemini' | 'openrouter';

export type ModelCallPhase =
  | 'stage-one-planner'
  | 'stage-two-generation'
  | 'corrective-generation';

export type ModelCredentialSource = 'managed' | 'vertex' | 'byok';

export type ModelCallCostSource =
  | 'provider_reported'
  | 'catalog_estimate'
  | 'not_billable'
  | 'unavailable';

export interface ModelTokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cachedInputTokens?: number;
  reasoningOutputTokens?: number;
}

export interface ModelCallCost {
  currency: 'USD';
  amountNanoUsd?: string;
  source: ModelCallCostSource;
  pricingSnapshotId?: string;
}

export interface ModelCallUsage {
  phase: ModelCallPhase;
  provider: ModelProvider;
  requestedModel: string;
  resolvedModel?: string;
  responseId?: string;
  status: 'success' | 'error';
  startedAt: string;
  durationMs: number;
  tokens?: ModelTokenUsage;
  cost: ModelCallCost;
  upstreamAttemptCount: number;
  errorCode?: string;
}

export type ModelCallRecorder = (usage: ModelCallUsage) => void;

export interface GenerationUsageSummary {
  callCount: number;
  successfulCallCount: number;
  failedCallCount: number;
  unknownCostCallCount: number;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  reasoningOutputTokens: number;
  totalTokens: number;
  accountedCostNanoUsd: string;
  platformCostNanoUsd: string;
  byokEstimatedCostNanoUsd: string;
  allowanceChargeNanoUsd: string;
}

export interface ModelPricing {
  provider: ModelProvider;
  model: string;
  endpoint: 'standard' | 'vertex';
  inputNanoUsdPerMillion: string;
  cachedInputNanoUsdPerMillion?: string;
  outputNanoUsdPerMillion: string;
  sourceUrl: string;
}

export const MODEL_PRICING_SNAPSHOT_ID = '2026-08-02-v1';

/** Paid standard-list pricing. Provider-reported cost always takes priority. */
export const MODEL_PRICING: readonly ModelPricing[] = [
  {
    provider: 'openai',
    model: 'gpt-5.6-luna',
    endpoint: 'standard',
    inputNanoUsdPerMillion: '1000000000',
    cachedInputNanoUsdPerMillion: '100000000',
    outputNanoUsdPerMillion: '6000000000',
    sourceUrl: 'https://developers.openai.com/api/docs/models/gpt-5.6-luna',
  },
  {
    provider: 'gemini',
    model: 'gemini-3.5-flash',
    endpoint: 'standard',
    inputNanoUsdPerMillion: '1500000000',
    cachedInputNanoUsdPerMillion: '150000000',
    outputNanoUsdPerMillion: '9000000000',
    sourceUrl: 'https://ai.google.dev/gemini-api/docs/pricing',
  },
  {
    provider: 'gemini',
    model: 'gemini-3.1-flash-lite',
    endpoint: 'standard',
    inputNanoUsdPerMillion: '250000000',
    cachedInputNanoUsdPerMillion: '25000000',
    outputNanoUsdPerMillion: '1500000000',
    sourceUrl: 'https://ai.google.dev/gemini-api/docs/pricing',
  },
];

const ONE_MILLION = 1_000_000n;

function nonnegativeInteger(value: number | undefined): number {
  return Number.isSafeInteger(value) && (value ?? -1) >= 0 ? value ?? 0 : 0;
}

function divideRounded(numerator: bigint, denominator: bigint): bigint {
  return (numerator + denominator / 2n) / denominator;
}

export function usdToNanoUsd(value: number): string | undefined {
  if (!Number.isFinite(value) || value < 0) {
    return undefined;
  }
  return BigInt(Math.round(value * 1_000_000_000)).toString();
}

export function nanoUsdToUsd(value: string): number {
  return Number(BigInt(value)) / 1_000_000_000;
}

export function formatNanoUsd(value: string): string {
  return `$${nanoUsdToUsd(value).toFixed(6)}`;
}

export function estimateModelCallCost(params: {
  provider: ModelProvider;
  model: string;
  tokens?: ModelTokenUsage;
  endpoint?: 'standard' | 'vertex';
}): ModelCallCost {
  if (!params.tokens) {
    return { currency: 'USD', source: 'unavailable' };
  }

  const endpoint = params.endpoint ?? 'standard';
  const pricing = MODEL_PRICING.find(
    (entry) =>
      entry.provider === params.provider &&
      entry.endpoint === endpoint &&
      (params.model === entry.model ||
        params.model.startsWith(`${entry.model}-`))
  );
  if (!pricing) {
    return { currency: 'USD', source: 'unavailable' };
  }

  const inputTokens = BigInt(nonnegativeInteger(params.tokens.inputTokens));
  const cachedTokens = BigInt(
    Math.min(
      nonnegativeInteger(params.tokens.cachedInputTokens),
      nonnegativeInteger(params.tokens.inputTokens)
    )
  );
  const uncachedTokens = inputTokens - cachedTokens;
  const outputTokens = BigInt(nonnegativeInteger(params.tokens.outputTokens));
  const cachedRate = BigInt(
    pricing.cachedInputNanoUsdPerMillion ?? pricing.inputNanoUsdPerMillion
  );
  const numerator =
    uncachedTokens * BigInt(pricing.inputNanoUsdPerMillion) +
    cachedTokens * cachedRate +
    outputTokens * BigInt(pricing.outputNanoUsdPerMillion);

  return {
    currency: 'USD',
    amountNanoUsd: divideRounded(numerator, ONE_MILLION).toString(),
    source: 'catalog_estimate',
    pricingSnapshotId: MODEL_PRICING_SNAPSHOT_ID,
  };
}

export function buildGenerationUsageSummary(
  calls: readonly ModelCallUsage[],
  options: {
    credentialSource?: ModelCredentialSource;
    operationSucceeded?: boolean;
  } = {}
): GenerationUsageSummary {
  const totals = calls.reduce(
    (result, call) => {
      const amount = call.cost.amountNanoUsd
        ? BigInt(call.cost.amountNanoUsd)
        : 0n;
      result.accountedCost += amount;
      if (call.cost.source === 'unavailable') {
        result.unknownCostCallCount += 1;
      }
      result.inputTokens += nonnegativeInteger(call.tokens?.inputTokens);
      result.outputTokens += nonnegativeInteger(call.tokens?.outputTokens);
      result.cachedInputTokens += nonnegativeInteger(
        call.tokens?.cachedInputTokens
      );
      result.reasoningOutputTokens += nonnegativeInteger(
        call.tokens?.reasoningOutputTokens
      );
      result.totalTokens += nonnegativeInteger(call.tokens?.totalTokens);
      if (call.status === 'success') {
        result.successfulCallCount += 1;
      } else {
        result.failedCallCount += 1;
      }
      return result;
    },
    {
      accountedCost: 0n,
      unknownCostCallCount: 0,
      inputTokens: 0,
      outputTokens: 0,
      cachedInputTokens: 0,
      reasoningOutputTokens: 0,
      totalTokens: 0,
      successfulCallCount: 0,
      failedCallCount: 0,
    }
  );
  const byok = options.credentialSource === 'byok';
  const operationSucceeded = options.operationSucceeded ?? true;

  return {
    callCount: calls.length,
    successfulCallCount: totals.successfulCallCount,
    failedCallCount: totals.failedCallCount,
    unknownCostCallCount: totals.unknownCostCallCount,
    inputTokens: totals.inputTokens,
    outputTokens: totals.outputTokens,
    cachedInputTokens: totals.cachedInputTokens,
    reasoningOutputTokens: totals.reasoningOutputTokens,
    totalTokens: totals.totalTokens,
    accountedCostNanoUsd: totals.accountedCost.toString(),
    platformCostNanoUsd: byok ? '0' : totals.accountedCost.toString(),
    byokEstimatedCostNanoUsd: byok ? totals.accountedCost.toString() : '0',
    allowanceChargeNanoUsd:
      !byok && operationSucceeded ? totals.accountedCost.toString() : '0',
  };
}

export interface UsageEvent {
  userId: string;
  operationId?: string;
  operation: 'generate' | 'regenerate';
  provider: ModelProvider;
  credentialSource?: ModelCredentialSource;
  byok: boolean;
  timestamp: string;
  durationMs?: number;
  result?: 'success' | 'error';
  modelCalls?: ModelCallUsage[];
  usage?: GenerationUsageSummary;
  metadata?: Record<string, unknown>;
}

export interface MeteringSink {
  recordUsage(event: UsageEvent): Promise<void>;
}

/**
 * Legacy aggregate usage event retained for the hosted quota package.
 * New LLM accounting should use ModelCallUsage and MeteringSink instead.
 */
export interface LegacyUsageEvent {
  userId: string;
  eventType:
    | 'api_call'
    | 'workout_generated'
    | 'workout_logged'
    | 'resource_usage';
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface UsageMetrics {
  userId: string;
  period: {
    start: Date;
    end: Date;
  };
  apiCalls: number;
  workoutsGenerated: number;
  workoutsLogged: number;
  totalResourceUsage: number;
}

/**
 * Backward-compatible in-memory aggregate meter used by QuotaService.
 * This intentionally remains separate from the durable per-model-call ledger.
 */
export class MeteringService {
  private events: LegacyUsageEvent[] = [];

  async recordEvent(event: LegacyUsageEvent): Promise<void> {
    this.events.push({ ...event });
  }

  async getUsageMetrics(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<UsageMetrics> {
    const userEvents = this.events.filter(
      (event) =>
        event.userId === userId &&
        event.timestamp >= startDate &&
        event.timestamp <= endDate
    );

    return {
      userId,
      period: { start: startDate, end: endDate },
      apiCalls: userEvents.filter((event) => event.eventType === 'api_call')
        .length,
      workoutsGenerated: userEvents.filter(
        (event) => event.eventType === 'workout_generated'
      ).length,
      workoutsLogged: userEvents.filter(
        (event) => event.eventType === 'workout_logged'
      ).length,
      totalResourceUsage: userEvents.reduce(
        (sum, event) =>
          sum +
          (typeof event.metadata?.resourceUsage === 'number'
            ? event.metadata.resourceUsage
            : 0),
        0
      ),
    };
  }

  async getCurrentPeriodUsage(userId: string): Promise<UsageMetrics> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return this.getUsageMetrics(userId, startOfMonth, now);
  }

  async countApiCalls(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    const metrics = await this.getUsageMetrics(userId, startDate, endDate);
    return metrics.apiCalls;
  }
}
