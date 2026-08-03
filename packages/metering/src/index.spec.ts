import {
  InMemoryMeteringSink,
  assertUsageEvent,
  buildGenerationUsageSummary,
  type UsageEvent,
} from '.';
import { verifyMeteringSinkContract } from './testing';

function event(overrides: Partial<UsageEvent> = {}): UsageEvent {
  return {
    userId: 'user-1',
    operationId: 'operation-1',
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
  };
}

describe('canonical metering contract', () => {
  it('passes the reusable sink contract', async () => {
    await verifyMeteringSinkContract(() => {
      const sink = new InMemoryMeteringSink();
      return { sink, list: async () => sink.list() };
    });
  });

  it('is idempotent by account, operation, and event identity', async () => {
    const sink = new InMemoryMeteringSink();
    await sink.recordUsage(event());
    await sink.recordUsage(event());
    expect(sink.list()).toHaveLength(1);
  });

  it('rejects conflicting reuse of the same event identity', async () => {
    const sink = new InMemoryMeteringSink();
    await sink.recordUsage(event());
    await expect(sink.recordUsage(event({ result: 'error' }))).rejects.toThrow(
      'metering_event_conflict'
    );
  });

  it('requires a complete zero-call summary for pre-provider outcomes', () => {
    expect(() =>
      assertUsageEvent({
        ...event(),
        modelCalls: undefined,
      } as unknown as UsageEvent)
    ).toThrow('invalid_usage_event');
    expect(() =>
      assertUsageEvent({
        ...event(),
        usage: undefined,
      } as unknown as UsageEvent)
    ).toThrow('invalid_usage_event');
  });

  it('rejects negative or inconsistent usage summaries', () => {
    expect(() =>
      assertUsageEvent(
        event({ usage: { ...event().usage, inputTokens: -1 } })
      )
    ).toThrow('invalid_usage_summary');
    expect(() =>
      assertUsageEvent(
        event({ usage: { ...event().usage, callCount: 1 } })
      )
    ).toThrow('inconsistent_usage_summary');
    expect(() =>
      assertUsageEvent(event({ credentialSource: 'byok', byok: false }))
    ).toThrow('invalid_usage_summary');
  });

  it('rejects nano-USD values outside the durable bigint range', () => {
    expect(() =>
      assertUsageEvent(
        event({
          usage: {
            ...event().usage,
            accountedCostNanoUsd: '9223372036854775808',
          },
        })
      )
    ).toThrow('invalid_usage_summary');
  });

  it('bounds identifiers, logical calls, and upstream-attempt fields', () => {
    expect(() =>
      assertUsageEvent(event({ operationId: 'x'.repeat(161) }))
    ).toThrow('invalid_operation_id');
    expect(() =>
      assertUsageEvent(event({ responseId: 'x'.repeat(161) }))
    ).toThrow('invalid_usage_event');
    expect(() =>
      assertUsageEvent(
        event({
          modelCalls: Array.from({ length: 17 }, () => ({
            phase: 'stage-two-generation' as const,
            provider: 'openai' as const,
            requestedModel: 'model',
            status: 'success' as const,
            startedAt: '2026-08-02T12:00:00.000Z',
            durationMs: 1,
            cost: { currency: 'USD' as const, source: 'unavailable' as const },
            upstreamAttemptCount: 1,
          })),
        })
      )
    ).toThrow('too_many_model_calls');
    expect(() =>
      assertUsageEvent(
        event({
          modelCalls: [
            {
              phase: 'stage-two-generation',
              provider: 'openai',
              requestedModel: 'model',
              status: 'error',
              startedAt: '2026-08-02T12:00:00.000Z',
              durationMs: 1,
              cost: { currency: 'USD', source: 'unavailable' },
              upstreamAttemptCount: -1,
            },
          ],
        })
      )
    ).toThrow('invalid_model_call');
  });
});
