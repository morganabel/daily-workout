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
    model: 'gemini-3.5-flash',
    endpoint: 'vertex',
    inputNanoUsdPerMillion: '1650000000',
    cachedInputNanoUsdPerMillion: '165000000',
    outputNanoUsdPerMillion: '9900000000',
    sourceUrl:
      'https://cloud.google.com/gemini-enterprise-agent-platform/generative-ai/pricing',
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
  {
    provider: 'gemini',
    model: 'gemini-3.1-flash-lite',
    endpoint: 'vertex',
    inputNanoUsdPerMillion: '275000000',
    cachedInputNanoUsdPerMillion: '27500000',
    outputNanoUsdPerMillion: '1650000000',
    sourceUrl:
      'https://cloud.google.com/gemini-enterprise-agent-platform/generative-ai/pricing',
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
  operationId: string;
  eventId: string;
  operation: 'generate' | 'regenerate';
  provider: ModelProvider;
  credentialSource?: ModelCredentialSource;
  byok: boolean;
  timestamp: string;
  durationMs?: number;
  result?: 'success' | 'error';
  responseId?: string;
  schemaVersion?: string;
  errorCode?: string;
  modelCalls: ModelCallUsage[];
  usage: GenerationUsageSummary;
}

export interface MeteringSink {
  recordUsage(event: UsageEvent): Promise<void>;
}

const MAX_ID_LENGTH = 160;
const MAX_MODEL_CALLS = 16;
const MAX_MODEL_NAME_LENGTH = 200;
const MAX_CODE_LENGTH = 160;
const MAX_POSTGRES_BIGINT = 9_223_372_036_854_775_807n;

function assertBoundedId(label: string, value: string): void {
  if (!value || value.length > MAX_ID_LENGTH) {
    throw new Error(`invalid_${label}`);
  }
}

function isNonnegativeInteger(value: number | undefined): boolean {
  return value === undefined || (Number.isSafeInteger(value) && value >= 0);
}

function isBoundedOptional(
  value: string | undefined,
  maximum: number
): boolean {
  return value === undefined || (value.length > 0 && value.length <= maximum);
}

function isNanoUsd(value: string | undefined): boolean {
  if (value === undefined) return true;
  if (!/^\d+$/.test(value)) return false;
  return BigInt(value) <= MAX_POSTGRES_BIGINT;
}

const SUMMARY_INTEGER_FIELDS = [
  'callCount',
  'successfulCallCount',
  'failedCallCount',
  'unknownCostCallCount',
  'inputTokens',
  'outputTokens',
  'cachedInputTokens',
  'reasoningOutputTokens',
  'totalTokens',
] as const satisfies readonly (keyof GenerationUsageSummary)[];

const SUMMARY_MONEY_FIELDS = [
  'accountedCostNanoUsd',
  'platformCostNanoUsd',
  'byokEstimatedCostNanoUsd',
  'allowanceChargeNanoUsd',
] as const satisfies readonly (keyof GenerationUsageSummary)[];

export function assertUsageEvent(event: UsageEvent): void {
  assertBoundedId('user_id', event.userId);
  assertBoundedId('operation_id', event.operationId);
  assertBoundedId('event_id', event.eventId);
  if (
    !Number.isFinite(Date.parse(event.timestamp)) ||
    !isNonnegativeInteger(event.durationMs) ||
    !isBoundedOptional(event.responseId, MAX_ID_LENGTH) ||
    !isBoundedOptional(event.schemaVersion, MAX_CODE_LENGTH) ||
    !isBoundedOptional(event.errorCode, MAX_CODE_LENGTH) ||
    !Array.isArray(event.modelCalls) ||
    !event.usage
  ) {
    throw new Error('invalid_usage_event');
  }
  if (event.modelCalls.length > MAX_MODEL_CALLS) {
    throw new Error('too_many_model_calls');
  }
  for (const call of event.modelCalls) {
    if (
      !call.requestedModel ||
      call.requestedModel.length > MAX_MODEL_NAME_LENGTH ||
      (call.resolvedModel?.length ?? 0) > MAX_MODEL_NAME_LENGTH ||
      !isBoundedOptional(call.responseId, MAX_ID_LENGTH) ||
      !isBoundedOptional(call.errorCode, MAX_CODE_LENGTH) ||
      !isBoundedOptional(call.cost.pricingSnapshotId, MAX_ID_LENGTH) ||
      !isNanoUsd(call.cost.amountNanoUsd) ||
      !Number.isFinite(Date.parse(call.startedAt)) ||
      !isNonnegativeInteger(call.durationMs) ||
      !isNonnegativeInteger(call.upstreamAttemptCount) ||
      !isNonnegativeInteger(call.tokens?.inputTokens) ||
      !isNonnegativeInteger(call.tokens?.outputTokens) ||
      !isNonnegativeInteger(call.tokens?.totalTokens) ||
      !isNonnegativeInteger(call.tokens?.cachedInputTokens) ||
      !isNonnegativeInteger(call.tokens?.reasoningOutputTokens)
    ) {
      throw new Error('invalid_model_call');
    }
  }

  if (
    SUMMARY_INTEGER_FIELDS.some(
      (field) => !isNonnegativeInteger(event.usage[field] as number)
    ) ||
    SUMMARY_MONEY_FIELDS.some(
      (field) => !isNanoUsd(event.usage[field] as string)
    ) ||
    (event.credentialSource !== undefined &&
      event.byok !== (event.credentialSource === 'byok'))
  ) {
    throw new Error('invalid_usage_summary');
  }

  const expectedUsage = buildGenerationUsageSummary(event.modelCalls, {
    credentialSource:
      event.credentialSource ?? (event.byok ? 'byok' : 'managed'),
    operationSucceeded: event.result !== 'error',
  });
  if (
    SUMMARY_INTEGER_FIELDS.some(
      (field) => event.usage[field] !== expectedUsage[field]
    ) ||
    SUMMARY_MONEY_FIELDS.some(
      (field) => event.usage[field] !== expectedUsage[field]
    )
  ) {
    throw new Error('inconsistent_usage_summary');
  }
}

export class InMemoryMeteringSink implements MeteringSink {
  private readonly events = new Map<string, UsageEvent>();

  async recordUsage(event: UsageEvent): Promise<void> {
    assertUsageEvent(event);
    const key = `${event.userId}:${event.operationId}:${event.eventId}`;
    const existing = this.events.get(key);
    if (existing) {
      if (JSON.stringify(existing) !== JSON.stringify(event)) {
        throw new Error('metering_event_conflict');
      }
      return;
    }
    this.events.set(key, structuredClone(event));
  }

  list(): readonly UsageEvent[] {
    return [...this.events.values()].map((event) => structuredClone(event));
  }
}
