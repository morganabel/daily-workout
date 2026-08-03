import { aiModelCall, aiUsageEvent } from './schema.js';

describe('AI usage schema', () => {
  it('stores nano-USD amounts as database integers', () => {
    expect(aiUsageEvent.accountedCostNanoUsd.getSQLType()).toBe('bigint');
    expect(aiUsageEvent.platformCostNanoUsd.getSQLType()).toBe('bigint');
    expect(aiUsageEvent.byokEstimatedCostNanoUsd.getSQLType()).toBe('bigint');
    expect(aiUsageEvent.allowanceChargeNanoUsd.getSQLType()).toBe('bigint');
    expect(aiModelCall.costAmountNanoUsd.getSQLType()).toBe('bigint');
  });
});
