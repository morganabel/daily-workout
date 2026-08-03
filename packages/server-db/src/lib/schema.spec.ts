import { aiModelCall, aiUsageEvent } from './schema.js';

describe('database money schema', () => {
  it('stores every nano-USD amount as a PostgreSQL integer', () => {
    expect(aiUsageEvent.accountedCostNanoUsd.getSQLType()).toBe('bigint');
    expect(aiUsageEvent.platformCostNanoUsd.getSQLType()).toBe('bigint');
    expect(aiUsageEvent.byokEstimatedCostNanoUsd.getSQLType()).toBe('bigint');
    expect(aiUsageEvent.allowanceChargeNanoUsd.getSQLType()).toBe('bigint');
    expect(aiModelCall.costAmountNanoUsd.getSQLType()).toBe('bigint');
  });
});
