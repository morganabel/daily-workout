import { geminiTokenUsage, recordModelCall } from './usage';

describe('Gemini usage metering', () => {
  it('includes thought tokens in billable output tokens and estimated cost', () => {
    const tokens = geminiTokenUsage({
      promptTokenCount: 100,
      candidatesTokenCount: 20,
      thoughtsTokenCount: 30,
      totalTokenCount: 150,
    });

    expect(tokens).toEqual({
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 150,
      cachedInputTokens: undefined,
      reasoningOutputTokens: 30,
    });

    const usage = recordModelCall(
      {},
      {
        provider: 'gemini',
        phase: 'stage-two-generation',
        requestedModel: 'gemini-3.5-flash',
        startedAtMs: Date.now(),
        status: 'success',
        tokens,
      }
    );

    expect(usage.cost).toMatchObject({
      amountNanoUsd: '600000',
      source: 'catalog_estimate',
    });
  });
});
