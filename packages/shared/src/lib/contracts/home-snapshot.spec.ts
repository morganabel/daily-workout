import {
  homeSnapshotSchema,
  createHomeSnapshotMock,
} from './home-snapshot';

describe('homeSnapshot contract', () => {
  it('parses the default mock without errors', () => {
    const snapshot = createHomeSnapshotMock();
    const parsed = homeSnapshotSchema.parse(snapshot);
    expect(parsed.generationStatus.state).toBe('idle');
  });

  it('allows overriding plan and offline hint for testing edge cases', () => {
    const snapshot = createHomeSnapshotMock({
      plan: null,
      offlineHint: {
        offline: true,
        requiresApiKey: true,
        message: 'BYOK required',
      },
      recentSessions: [],
      generationStatus: {
        state: 'pending',
        submittedAt: new Date().toISOString(),
        etaSeconds: 18,
      },
    });

    const parsed = homeSnapshotSchema.parse(snapshot);
    expect(parsed.plan).toBeNull();
    expect(parsed.offlineHint.offline).toBe(true);
    expect(parsed.offlineHint.requiresApiKey).toBe(true);
    expect(parsed.recentSessions).toHaveLength(0);
    expect(parsed.generationStatus.state).toBe('pending');
  });
});
