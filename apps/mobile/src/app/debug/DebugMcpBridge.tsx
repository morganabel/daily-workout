import { useEffect } from 'react';
import { Platform } from 'react-native';
import { MOBILE_DEBUG_MCP_PROTOCOL_VERSION } from '@workout-agent/shared';
import {
  createDebugMcpSessionId,
  getDebugMcpSidecarUrl,
  getDebugMcpToken,
  isDebugMcpBridgeEnabled,
} from './debugMcpConfig';
import { setDebugBridgeState } from './debugState';
import { dispatchDebugTool } from './debugToolRegistry';

const RECONNECT_DELAY_MS = 2_000;

const parseMessage = (data: unknown): unknown => {
  if (typeof data === 'string') {
    return JSON.parse(data);
  }
  return JSON.parse(String(data));
};

export const DebugMcpBridge = () => {
  useEffect(() => {
    if (!isDebugMcpBridgeEnabled()) {
      return;
    }

    const token = getDebugMcpToken();
    if (!token) {
      console.warn('[debug-mcp] EXPO_PUBLIC_DEBUG_MCP_TOKEN is required.');
      return;
    }

    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;
    const sessionId = createDebugMcpSessionId();
    setDebugBridgeState({ enabled: true, connected: false, sessionId });

    const connect = () => {
      if (disposed) return;

      const sidecarUrl = getDebugMcpSidecarUrl();
      setDebugBridgeState({ sidecarUrl });
      socket = new WebSocket(sidecarUrl);

      socket.onopen = () => {
        socket?.send(
          JSON.stringify({
            type: 'hello',
            token,
            session: {
              sessionId,
              protocolVersion: MOBILE_DEBUG_MCP_PROTOCOL_VERSION,
              appName: 'Workout Agent Mobile',
              platform: Platform.OS,
            },
          }),
        );
      };

      socket.onmessage = (event) => {
        void (async () => {
          try {
            const message = parseMessage(event.data);
            if (
              message &&
              typeof message === 'object' &&
              'type' in message &&
              message.type === 'registered'
            ) {
              setDebugBridgeState({ connected: true });
              return;
            }

            const response = await dispatchDebugTool(message);
            socket?.send(JSON.stringify(response));
          } catch (error) {
            socket?.send(
              JSON.stringify({
                id: 'invalid-message',
                ok: false,
                error: {
                  code: 'INVALID_MESSAGE',
                  message:
                    error instanceof Error
                      ? error.message
                      : 'Invalid debug MCP message',
                },
              }),
            );
          }
        })();
      };

      socket.onclose = () => {
        socket = null;
        setDebugBridgeState({ connected: false });
        if (!disposed) {
          reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
        }
      };

      socket.onerror = () => {
        socket?.close();
      };
    };

    connect();

    return () => {
      disposed = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      socket?.close();
      setDebugBridgeState({ enabled: false, connected: false });
    };
  }, []);

  return null;
};
