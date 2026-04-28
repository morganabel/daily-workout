import {
  getDebugMcpSidecarUrl,
  getDebugMcpToken,
  isDebugMcpBridgeEnabledForEnv,
} from './debugMcpConfig';

describe('debugMcpConfig', () => {
  it('keeps the bridge disabled without the explicit env gate', () => {
    expect(isDebugMcpBridgeEnabledForEnv({}, true)).toBe(false);
  });

  it('keeps the bridge disabled outside dev mode even with the env gate', () => {
    expect(
      isDebugMcpBridgeEnabledForEnv(
        { EXPO_PUBLIC_ENABLE_DEBUG_MCP: 'true' },
        false,
      ),
    ).toBe(false);
  });

  it('enables the bridge only when dev mode and env gate are both present', () => {
    expect(
      isDebugMcpBridgeEnabledForEnv(
        { EXPO_PUBLIC_ENABLE_DEBUG_MCP: 'true' },
        true,
      ),
    ).toBe(true);
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

  it('returns configured token or null', () => {
    expect(getDebugMcpToken({})).toBeNull();

    expect(
      getDebugMcpToken({ EXPO_PUBLIC_DEBUG_MCP_TOKEN: 'debug-token' }),
    ).toBe('debug-token');
  });
});
