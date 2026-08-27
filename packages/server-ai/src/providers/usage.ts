import {
  estimateModelCallCost,
  usdToNanoUsd,
  type ModelCallPhase,
  type ModelCallUsage,
  type ModelProvider,
  type ModelTokenUsage,
} from '@leveza/metering';
import type { AiProviderOptions } from './types';

type CallUsageParams = {
  provider: ModelProvider;
  phase: ModelCallPhase;
  requestedModel: string;
  resolvedModel?: string;
  responseId?: string;
  startedAtMs: number;
  status: 'success' | 'error';
  tokens?: ModelTokenUsage;
  providerReportedCostUsd?: number;
  endpoint?: 'standard' | 'vertex';
  errorCode?: string;
};

export function recordModelCall(
  options: AiProviderOptions,
  params: CallUsageParams
): ModelCallUsage {
  const reportedNanoUsd =
    params.providerReportedCostUsd === undefined
      ? undefined
      : usdToNanoUsd(params.providerReportedCostUsd);
  const cost = reportedNanoUsd
    ? {
        currency: 'USD' as const,
        amountNanoUsd: reportedNanoUsd,
        source: 'provider_reported' as const,
      }
    : estimateModelCallCost({
        provider: params.provider,
        model: params.resolvedModel ?? params.requestedModel,
        tokens: params.tokens,
        endpoint: params.endpoint,
      });
  const usage: ModelCallUsage = {
    phase: params.phase,
    provider: params.provider,
    requestedModel: params.requestedModel,
    resolvedModel: params.resolvedModel,
    responseId: params.responseId,
    status: params.status,
    startedAt: new Date(params.startedAtMs).toISOString(),
    durationMs: Math.max(0, Date.now() - params.startedAtMs),
    tokens: params.tokens,
    cost,
    upstreamAttemptCount: 1,
    errorCode: params.errorCode,
  };

  try {
    options.modelCallRecorder?.(usage);
  } catch {
    // Accounting observers must never turn a successful provider call into a
    // failed workout request. Durable sinks consume the captured summary later.
  }
  return usage;
}

export function openAiTokenUsage(usage: {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  input_tokens_details?: { cached_tokens?: number };
  output_tokens_details?: { reasoning_tokens?: number };
} | null | undefined): ModelTokenUsage | undefined {
  if (!usage) return undefined;
  return {
    inputTokens: usage.input_tokens ?? 0,
    outputTokens: usage.output_tokens ?? 0,
    totalTokens:
      usage.total_tokens ??
      (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0),
    cachedInputTokens: usage.input_tokens_details?.cached_tokens,
    reasoningOutputTokens: usage.output_tokens_details?.reasoning_tokens,
  };
}

export function geminiTokenUsage(usage: {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
  cachedContentTokenCount?: number;
  thoughtsTokenCount?: number;
} | null | undefined): ModelTokenUsage | undefined {
  if (!usage) return undefined;
  const outputTokens =
    (usage.candidatesTokenCount ?? 0) + (usage.thoughtsTokenCount ?? 0);
  return {
    inputTokens: usage.promptTokenCount ?? 0,
    outputTokens,
    totalTokens:
      usage.totalTokenCount ??
      (usage.promptTokenCount ?? 0) + outputTokens,
    cachedInputTokens: usage.cachedContentTokenCount,
    reasoningOutputTokens: usage.thoughtsTokenCount,
  };
}

export function openRouterTokenUsage(usage: {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  promptTokensDetails?: { cachedTokens?: number } | null;
  completionTokensDetails?: { reasoningTokens?: number | null } | null;
} | null | undefined): ModelTokenUsage | undefined {
  if (!usage) return undefined;
  return {
    inputTokens: usage.promptTokens ?? 0,
    outputTokens: usage.completionTokens ?? 0,
    totalTokens:
      usage.totalTokens ??
      (usage.promptTokens ?? 0) + (usage.completionTokens ?? 0),
    cachedInputTokens: usage.promptTokensDetails?.cachedTokens,
    reasoningOutputTokens:
      usage.completionTokensDetails?.reasoningTokens ?? undefined,
  };
}
