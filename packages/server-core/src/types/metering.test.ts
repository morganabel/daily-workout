import {
  buildGenerationUsageSummary,
  estimateModelCallCost,
  MeteringService,
  type ModelCallUsage,
} from '@workout-agent-ce/metering';

describe('model usage accounting', () => {
  it('prices cached and uncached OpenAI input separately', () => {
    expect(
      estimateModelCallCost({
        provider: 'openai',
        model: 'gpt-5.6-luna-2026-07-01',
        tokens: {
          inputTokens: 1_000,
          cachedInputTokens: 200,
          outputTokens: 500,
          totalTokens: 1_500,
        },
      })
    ).toEqual({
      currency: 'USD',
      amountNanoUsd: '3820000',
      source: 'catalog_estimate',
      pricingSnapshotId: '2026-08-02-v1',
    });
  });

  it('keeps BYOK estimates out of platform cost and allowance charges', () => {
    const calls: ModelCallUsage[] = [
      {
        phase: 'stage-two-generation',
        provider: 'openrouter',
        requestedModel: 'example/model',
        status: 'success',
        startedAt: '2026-08-02T12:00:00.000Z',
        durationMs: 20,
        tokens: {
          inputTokens: 10,
          outputTokens: 5,
          totalTokens: 15,
        },
        cost: {
          currency: 'USD',
          amountNanoUsd: '250000',
          source: 'provider_reported',
        },
        upstreamAttemptCount: 1,
      },
    ];

    expect(
      buildGenerationUsageSummary(calls, {
        credentialSource: 'byok',
        operationSucceeded: true,
      })
    ).toEqual(
      expect.objectContaining({
        callCount: 1,
        totalTokens: 15,
        accountedCostNanoUsd: '250000',
        platformCostNanoUsd: '0',
        byokEstimatedCostNanoUsd: '250000',
        allowanceChargeNanoUsd: '0',
      })
    );
  });

  it('marks unknown prices explicitly instead of treating them as free', () => {
    const cost = estimateModelCallCost({
      provider: 'gemini',
      model: 'unpriced-model',
      tokens: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
    });
    const summary = buildGenerationUsageSummary([
      {
        phase: 'stage-one-planner',
        provider: 'gemini',
        requestedModel: 'unpriced-model',
        status: 'success',
        startedAt: '2026-08-02T12:00:00.000Z',
        durationMs: 1,
        tokens: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        cost,
        upstreamAttemptCount: 1,
      },
    ]);

    expect(cost).toEqual({ currency: 'USD', source: 'unavailable' });
    expect(summary.unknownCostCallCount).toBe(1);
    expect(summary.accountedCostNanoUsd).toBe('0');
  });

  it('retains aggregate metering compatibility for quota consumers', async () => {
    const metering = new MeteringService();
    const timestamp = new Date('2026-08-02T12:00:00.000Z');

    await metering.recordEvent({
      userId: 'user-1',
      eventType: 'api_call',
      timestamp,
    });
    await metering.recordEvent({
      userId: 'user-1',
      eventType: 'resource_usage',
      timestamp,
      metadata: { resourceUsage: 12 },
    });

    await expect(
      metering.getUsageMetrics(
        'user-1',
        new Date('2026-08-01T00:00:00.000Z'),
        new Date('2026-09-01T00:00:00.000Z')
      )
    ).resolves.toEqual(
      expect.objectContaining({ apiCalls: 1, totalResourceUsage: 12 })
    );
  });
});
