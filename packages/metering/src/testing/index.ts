import assert from 'node:assert/strict';
import {
  buildGenerationUsageSummary,
  type MeteringSink,
  type UsageEvent,
} from '..';

export interface MeteringContractHarness {
  sink: MeteringSink;
  list(): Promise<readonly UsageEvent[]> | readonly UsageEvent[];
}

const usageEvent = (overrides: Partial<UsageEvent> = {}): UsageEvent => ({
  userId: 'contract-user',
  operationId: 'contract-operation',
  eventId: 'generation-success',
  operation: 'generate',
  provider: 'openai',
  credentialSource: 'managed',
  byok: false,
  timestamp: '2026-08-02T12:00:00.000Z',
  result: 'success',
  modelCalls: [],
  usage: buildGenerationUsageSummary([], {
    credentialSource: 'managed',
  }),
  ...overrides,
});

export async function verifyMeteringSinkContract(
  create: () => MeteringContractHarness
): Promise<void> {
  const harness = create();
  await harness.sink.recordUsage(usageEvent());
  await harness.sink.recordUsage(usageEvent());
  assert.equal((await harness.list()).length, 1);
  await assert.rejects(
    harness.sink.recordUsage(usageEvent({ result: 'error' })),
    /metering_event_conflict/
  );
}
