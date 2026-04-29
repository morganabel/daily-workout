#!/usr/bin/env node

import { randomUUID } from 'node:crypto';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { WebSocketServer } from 'ws';
import { z } from 'zod';
import {
  appResponseSchema,
  helloSchema,
  PROTOCOL_VERSION,
  toolNames,
} from './contracts.mjs';

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 8765;
const DEFAULT_PAIRING_TOKEN = 'local-debug-token';
const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;
const HEARTBEAT_INTERVAL_MS = 30_000;

const port = Number.parseInt(
  process.env.MOBILE_DEBUG_MCP_PORT ?? String(DEFAULT_PORT),
  10,
);
const host = process.env.MOBILE_DEBUG_MCP_HOST ?? DEFAULT_HOST;
const pairingToken = process.env.MOBILE_DEBUG_MCP_TOKEN ?? DEFAULT_PAIRING_TOKEN;
const requestTimeoutMs = Number.parseInt(
  process.env.MOBILE_DEBUG_MCP_REQUEST_TIMEOUT_MS ??
    String(DEFAULT_REQUEST_TIMEOUT_MS),
  10,
);

const sessions = new Map();

function parseJsonMessage(raw) {
  const text = typeof raw === 'string' ? raw : raw.toString('utf8');
  return JSON.parse(text);
}

function publicSession(session) {
  return {
    ...session.metadata,
    connectedAt: session.connectedAt,
  };
}

function connectedSessions() {
  return [...sessions.values()].map(publicSession);
}

function removeSession(sessionId, expectedSession) {
  const session = sessions.get(sessionId);
  if (!session) return;
  if (expectedSession && session !== expectedSession) return;

  sessions.delete(sessionId);
  session.pending.forEach(({ reject, timeout }) => {
    clearTimeout(timeout);
    reject(new Error(`Debug app session disconnected: ${sessionId}`));
  });
  session.pending.clear();
}

function registerSession(session) {
  const existingSession = sessions.get(session.id);
  if (existingSession && existingSession !== session) {
    removeSession(existingSession.id, existingSession);
    existingSession.ws.close(1012, 'Debug app session replaced by reconnect');
  }

  sessions.set(session.id, session);
}

function resolveSession(sessionId) {
  if (sessionId) {
    const session = sessions.get(sessionId);
    if (!session) {
      throw new Error(`No connected debug app session for sessionId '${sessionId}'.`);
    }
    return session;
  }

  if (sessions.size === 0) {
    throw new Error(
      'No debug app is connected. Start a debug mobile build and ensure EXPO_PUBLIC_ENABLE_DEBUG_MCP is not set to false.',
    );
  }

  if (sessions.size > 1) {
    throw new Error(
      `Multiple debug app sessions are connected. Provide sessionId. Connected sessions: ${JSON.stringify(
        connectedSessions(),
      )}`,
    );
  }

  return [...sessions.values()][0];
}

function callAppTool(tool, args) {
  const { sessionId, input } = args ?? {};
  const session = resolveSession(sessionId);
  const id = randomUUID();
  const payload = JSON.stringify({ id, tool, input });

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      session.pending.delete(id);
      reject(new Error(`Timed out waiting for '${tool}' response from ${session.id}.`));
    }, requestTimeoutMs);

    session.pending.set(id, { resolve, reject, timeout });

    try {
      session.ws.send(payload);
    } catch (error) {
      clearTimeout(timeout);
      session.pending.delete(id);
      reject(error);
    }
  });
}

function handleAppMessage(session, raw) {
  let message;
  try {
    message = parseJsonMessage(raw);
  } catch {
    console.error(`Ignoring invalid JSON app response from ${session.id}.`);
    return;
  }

  const parsed = appResponseSchema.safeParse(message);
  if (!parsed.success) {
    console.error(`Ignoring invalid app response from ${session.id}.`);
    return;
  }

  const response = parsed.data;
  const pending = session.pending.get(response.id);
  if (!pending) {
    console.error(`Ignoring response for unknown request '${response.id}'.`);
    return;
  }

  clearTimeout(pending.timeout);
  session.pending.delete(response.id);

  if (response.ok) {
    pending.resolve(response.result);
  } else {
    const error = new Error(response.error.message);
    error.code = response.error.code;
    error.details = response.error.details;
    pending.reject(error);
  }
}

const wss = new WebSocketServer({ host, port });

wss.on('connection', (ws) => {
  let registeredSession = null;
  let isAlive = true;

  ws.on('pong', () => {
    isAlive = true;
  });

  ws.once('message', (raw) => {
    try {
      const hello = helloSchema.parse(parseJsonMessage(raw));
      if (hello.token !== pairingToken) {
        ws.close(1008, 'Invalid debug MCP token');
        return;
      }

      registeredSession = {
        id: hello.session.sessionId,
        metadata: hello.session,
        connectedAt: new Date().toISOString(),
        pending: new Map(),
        ws,
      };
      registerSession(registeredSession);
      ws.send(
        JSON.stringify({
          type: 'registered',
          sessionId: registeredSession.id,
          protocolVersion: PROTOCOL_VERSION,
        }),
      );
      console.error(
        `Registered mobile debug session ${registeredSession.id} (${hello.session.platform}).`,
      );

      ws.on('message', (message) => {
        if (registeredSession) {
          handleAppMessage(registeredSession, message);
        }
      });
    } catch (error) {
      ws.close(1003, `Invalid debug MCP hello: ${error.message}`);
    }
  });

  ws.on('close', () => {
    clearInterval(heartbeat);
    if (registeredSession) {
      removeSession(registeredSession.id, registeredSession);
    }
  });

  const heartbeat = setInterval(() => {
    if (ws.readyState !== ws.OPEN) {
      clearInterval(heartbeat);
      return;
    }
    if (!isAlive) {
      ws.terminate();
      clearInterval(heartbeat);
      return;
    }
    isAlive = false;
    ws.ping();
  }, HEARTBEAT_INTERVAL_MS);
});

wss.on('listening', () => {
  console.error(
    `Mobile debug MCP sidecar listening for app sessions on ws://${host}:${port}.`,
  );
});

const server = new McpServer({
  name: 'workout-agent-mobile-debug',
  version: '0.1.0',
});

server.registerTool(
  'list_debug_sessions',
  {
    title: 'List connected debug app sessions',
    description: 'List React Native debug app sessions currently connected to the sidecar.',
    inputSchema: {},
  },
  async () => ({
    content: [
      {
        type: 'text',
        text: JSON.stringify({ sessions: connectedSessions() }, null, 2),
      },
    ],
  }),
);

toolNames.forEach((tool) => {
  server.registerTool(
    tool,
    {
      title: tool,
      description: `Relay ${tool} to a connected Workout Agent mobile debug build.`,
      inputSchema: {
        sessionId: z.string().optional(),
        input: z.unknown().optional(),
      },
    },
    async (args) => {
      const result = await callAppTool(tool, args);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result ?? null, null, 2),
          },
        ],
      };
    },
  );
});

const transport = new StdioServerTransport();
await server.connect(transport);
