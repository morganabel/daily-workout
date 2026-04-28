#!/usr/bin/env node

import { randomUUID } from 'node:crypto';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { WebSocketServer } from 'ws';
import { z } from 'zod';

const PROTOCOL_VERSION = 1;
const DEFAULT_PORT = 8765;
const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;
const HEARTBEAT_INTERVAL_MS = 30_000;

const toolNames = [
  'get_app_state',
  'get_home_state',
  'set_profile_preferences',
  'seed_history',
  'seed_planned_events',
  'get_generation_context',
  'generate_workout',
  'regenerate_workout',
  'get_last_generation_trace',
  'list_history',
  'list_calendar',
  'quick_log_workout',
  'complete_workout',
  'reset_debug_data',
  'open_home',
  'open_history',
  'open_settings',
  'open_current_workout_preview',
  'start_current_workout',
];

const helloSchema = z
  .object({
    type: z.literal('hello'),
    token: z.string().min(1),
    session: z
      .object({
        sessionId: z.string().min(1),
        protocolVersion: z.literal(PROTOCOL_VERSION),
        appName: z.string().optional(),
        appVersion: z.string().optional(),
        bundleId: z.string().optional(),
        platform: z.string().min(1),
        deviceName: z.string().optional(),
      })
      .strict(),
  })
  .strict();

const appResponseSchema = z.discriminatedUnion('ok', [
  z
    .object({
      id: z.string().min(1),
      ok: z.literal(true),
      result: z.unknown(),
    })
    .strict(),
  z
    .object({
      id: z.string().min(1),
      ok: z.literal(false),
      error: z
        .object({
          code: z.string().min(1),
          message: z.string().min(1),
          details: z.unknown().optional(),
        })
        .strict(),
    })
    .strict(),
]);

const port = Number.parseInt(
  process.env.MOBILE_DEBUG_MCP_PORT ?? String(DEFAULT_PORT),
  10,
);
const pairingToken = process.env.MOBILE_DEBUG_MCP_TOKEN;
const requestTimeoutMs = Number.parseInt(
  process.env.MOBILE_DEBUG_MCP_REQUEST_TIMEOUT_MS ??
    String(DEFAULT_REQUEST_TIMEOUT_MS),
  10,
);

if (!pairingToken) {
  console.error(
    'MOBILE_DEBUG_MCP_TOKEN is required to start the mobile debug MCP sidecar.',
  );
  process.exit(1);
}

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

function removeSession(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return;

  sessions.delete(sessionId);
  session.pending.forEach(({ reject, timeout }) => {
    clearTimeout(timeout);
    reject(new Error(`Debug app session disconnected: ${sessionId}`));
  });
  session.pending.clear();
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
      'No debug app is connected. Start a debug mobile build with EXPO_PUBLIC_ENABLE_DEBUG_MCP=true.',
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
  const parsed = appResponseSchema.safeParse(parseJsonMessage(raw));
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

const wss = new WebSocketServer({ port });

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
      sessions.set(registeredSession.id, registeredSession);
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
    if (registeredSession) {
      removeSession(registeredSession.id);
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
  console.error(`Mobile debug MCP sidecar listening for app sessions on ws://localhost:${port}.`);
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
