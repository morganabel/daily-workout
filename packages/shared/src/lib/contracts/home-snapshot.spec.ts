import { homeSnapshotSchema, createHomeSnapshotMock } from './home-snapshot';

describe('homeSnapshot contract', () => {
  it('parses the default mock without errors', () => {
    const snapshot = createHomeSnapshotMock();
    expect(() => homeSnapshotSchema.parse(snapshot)).not.toThrow();
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
    });

    const parsed = homeSnapshotSchema.parse(snapshot);
    expect(parsed.plan).toBeNull();
    expect(parsed.offlineHint.offline).toBe(true);
    expect(parsed.offlineHint.requiresApiKey).toBe(true);
    expect(parsed.recentSessions).toHaveLength(0);
  });
});
