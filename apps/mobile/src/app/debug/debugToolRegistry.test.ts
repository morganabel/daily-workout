import { clearDebugTools, dispatchDebugTool, registerDebugTool } from './debugToolRegistry';

describe('debugToolRegistry', () => {
  beforeEach(() => {
    clearDebugTools();
  });

  it('preserves plain-object error code and message', async () => {
    registerDebugTool('get_app_state', () =>
      Promise.reject({
        code: 'QUOTA_EXCEEDED',
        message: 'Try again later',
        details: { retryAfter: 60 },
      }),
    );

    await expect(
      dispatchDebugTool({ id: 'request-1', tool: 'get_app_state' }),
    ).resolves.toEqual({
      id: 'request-1',
      ok: false,
      error: {
        code: 'QUOTA_EXCEEDED',
        message: 'Try again later',
        details: { retryAfter: 60 },
      },
    });
  });
});
