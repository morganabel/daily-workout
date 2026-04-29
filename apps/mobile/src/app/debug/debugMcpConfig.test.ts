import {
  getDebugMcpSidecarUrl,
  getDebugMcpToken,
  isDebugMcpBridgeEnabledForEnv,
} from './debugMcpConfig';

describe('debugMcpConfig', () => {
  it('enables the bridge by default in dev mode', () => {
    expect(isDebugMcpBridgeEnabledForEnv({}, true)).toBe(true);
  });

  it('keeps the bridge disabled outside dev mode', () => {
    expect(isDebugMcpBridgeEnabledForEnv({}, false)).toBe(false);
  });

  it('allows the dev bridge to be explicitly disabled', () => {
    expect(
      isDebugMcpBridgeEnabledForEnv(
        { EXPO_PUBLIC_ENABLE_DEBUG_MCP: 'false' },
        true,
      ),
    ).toBe(false);
  });

  it('prefers explicit sidecar URL', () => {
    expect(
      getDebugMcpSidecarUrl({
        EXPO_PUBLIC_DEBUG_MCP_URL: 'ws://192.168.1.5:9999/app',
      }),
    ).toBe('ws://192.168.1.5:9999/app');
  });

  it('builds sidecar URL from host and port', () => {
    expect(
      getDebugMcpSidecarUrl({
        EXPO_PUBLIC_DEBUG_MCP_HOST: 'localhost',
        EXPO_PUBLIC_DEBUG_MCP_PORT: '8766',
      }),
    ).toBe('ws://localhost:8766');
  });

  it('returns the default token unless a token is configured', () => {
    expect(getDebugMcpToken({})).toBe('local-debug-token');

    expect(
      getDebugMcpToken({ EXPO_PUBLIC_DEBUG_MCP_TOKEN: 'debug-token' }),
    ).toBe('debug-token');
  });
});
