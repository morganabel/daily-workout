import { Platform } from 'react-native';

const DEFAULT_PORT = '8765';
const DEFAULT_TOKEN = 'local-debug-token';
export const DEBUG_MCP_INITIAL_RECONNECT_DELAY_MS = 2_000;
export const DEBUG_MCP_MAX_RECONNECT_DELAY_MS = 60_000;

type DebugMcpEnv = Record<string, string | undefined>;

const getDefaultHost = (): string => {
  if (Platform.OS === 'android') {
    return '10.0.2.2';
  }
  return 'localhost';
};

const getIsDev = (): boolean =>
  typeof __DEV__ !== 'undefined' ? Boolean(__DEV__) : false;

export function isDebugMcpBridgeEnabled(isDev = getIsDev()): boolean {
  return isDebugMcpBridgeEnabledForEnv(process.env, isDev);
}

export function isDebugMcpBridgeEnabledForEnv(
  env: DebugMcpEnv,
  isDev = getIsDev(),
): boolean {
  return isDev && env.EXPO_PUBLIC_ENABLE_DEBUG_MCP?.toLowerCase() !== 'false';
}

export function getDebugMcpSidecarUrl(env: DebugMcpEnv = process.env): string {
  const configured = env.EXPO_PUBLIC_DEBUG_MCP_URL?.trim();
  if (configured) {
    return configured;
  }

  const host = env.EXPO_PUBLIC_DEBUG_MCP_HOST?.trim() || getDefaultHost();
  const port = env.EXPO_PUBLIC_DEBUG_MCP_PORT?.trim() || DEFAULT_PORT;
  return `ws://${host}:${port}`;
}

export function getDebugMcpToken(env: DebugMcpEnv = process.env): string | null {
  const token = env.EXPO_PUBLIC_DEBUG_MCP_TOKEN?.trim();
  return token || DEFAULT_TOKEN;
}

export function getNextDebugMcpReconnectDelay(currentDelayMs: number): number {
  return Math.min(currentDelayMs * 2, DEBUG_MCP_MAX_RECONNECT_DELAY_MS);
}

export function createDebugMcpSessionId(): string {
  return `${Platform.OS}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
