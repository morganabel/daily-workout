import { z } from 'zod';

import {
  generationRequestSchema,
  plannedEventInputSchema,
  todayPlanSchema,
  userPreferencesSchema,
  workoutSessionSummarySchema,
} from './workouts';
import { homeSnapshotSchema } from './home-snapshot';

export const MOBILE_DEBUG_MCP_PROTOCOL_VERSION = 1;
export const MOBILE_DEBUG_MCP_RESET_CONFIRMATION = 'reset-debug-data';
export const REDACTED_SECRET = '[REDACTED]';

// Stable tool inventory shared by the Node MCP sidecar and React Native registry.
export const mobileDebugToolNames = [
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
] as const;

export const mobileDebugToolNameSchema = z.enum(mobileDebugToolNames);
export type MobileDebugToolName = z.infer<typeof mobileDebugToolNameSchema>;

export const mobileDebugPlatformSchema = z.enum([
  'ios',
  'android',
  'web',
  'macos',
  'windows',
  'unknown',
]);
export type MobileDebugPlatform = z.infer<typeof mobileDebugPlatformSchema>;

export const mobileDebugSessionMetadataSchema = z
  .object({
    sessionId: z.string().min(1),
    protocolVersion: z.literal(MOBILE_DEBUG_MCP_PROTOCOL_VERSION),
    appName: z.string().optional(),
    appVersion: z.string().optional(),
    bundleId: z.string().optional(),
    platform: mobileDebugPlatformSchema,
    deviceName: z.string().optional(),
    connectedAt: z.string().datetime().optional(),
  })
  .strict();
export type MobileDebugSessionMetadata = z.infer<
  typeof mobileDebugSessionMetadataSchema
>;

export const mobileDebugBridgeHelloSchema = z
  .object({
    type: z.literal('hello'),
    token: z.string().min(1),
    session: mobileDebugSessionMetadataSchema.omit({ connectedAt: true }),
  })
  .strict();
export type MobileDebugBridgeHello = z.infer<
  typeof mobileDebugBridgeHelloSchema
>;

export const mobileDebugToolRequestSchema = z
  .object({
    id: z.string().min(1),
    tool: mobileDebugToolNameSchema,
    input: z.unknown().optional(),
  })
  .strict();
export type MobileDebugToolRequest = z.infer<
  typeof mobileDebugToolRequestSchema
>;

export const mobileDebugToolResponseSchema = z.discriminatedUnion('ok', [
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
export type MobileDebugToolResponse = z.infer<
  typeof mobileDebugToolResponseSchema
>;

export const mobileDebugRedactedSecretSchema = z
  .object({
    present: z.boolean(),
    preview: z.string().optional(),
  })
  .strict();
export type MobileDebugRedactedSecret = z.infer<
  typeof mobileDebugRedactedSecretSchema
>;

export const mobileDebugAppStateSchema = z
  .object({
    session: mobileDebugSessionMetadataSchema.optional(),
    route: z.string().nullable().optional(),
    backendUrl: z.string().optional(),
    bridge: z
      .object({
        enabled: z.boolean(),
        connected: z.boolean(),
        sidecarUrl: z.string().optional(),
      })
      .strict(),
    serverCapabilities: z.unknown().nullable().optional(),
    network: z.unknown().nullable().optional(),
    launchCompleted: z.boolean().optional(),
    auth: z
      .object({
        enabled: z.boolean().optional(),
        sessionCookie: mobileDebugRedactedSecretSchema.optional(),
        sessionToken: mobileDebugRedactedSecretSchema.optional(),
        deviceToken: mobileDebugRedactedSecretSchema.optional(),
      })
      .strict()
      .optional(),
    byok: z
      .object({
        provider: z.string().optional(),
        apiKey: mobileDebugRedactedSecretSchema,
      })
      .strict()
      .optional(),
    database: z.record(z.string(), z.number().int().nonnegative()).optional(),
    ui: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();
export type MobileDebugAppState = z.infer<typeof mobileDebugAppStateSchema>;

export const mobileDebugHomeStateSchema = z
  .object({
    snapshot: homeSnapshotSchema.partial().optional(),
    planVersions: z.array(todayPlanSchema).optional(),
    ui: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();
export type MobileDebugHomeState = z.infer<typeof mobileDebugHomeStateSchema>;

export const mobileDebugSeedHistoryInputSchema = z
  .object({
    sessions: z.array(
      z
        .object({
          name: z.string().min(1),
          focus: z.string().min(1),
          durationMinutes: z.number().int().positive(),
          completedAt: z.number().int().positive().optional(),
          note: z.string().optional(),
        })
        .strict(),
    ),
  })
  .strict();
export type MobileDebugSeedHistoryInput = z.infer<
  typeof mobileDebugSeedHistoryInputSchema
>;

export const mobileDebugSeedPlannedEventsInputSchema = z
  .object({
    events: z.array(plannedEventInputSchema),
  })
  .strict();
export type MobileDebugSeedPlannedEventsInput = z.infer<
  typeof mobileDebugSeedPlannedEventsInputSchema
>;

export const mobileDebugSetProfilePreferencesInputSchema = z
  .object({
    preferences: userPreferencesSchema,
  })
  .strict();
export type MobileDebugSetProfilePreferencesInput = z.infer<
  typeof mobileDebugSetProfilePreferencesInputSchema
>;

export const mobileDebugGenerationInputSchema = z
  .object({
    request: generationRequestSchema,
    scheduledDate: z.number().int().positive().optional(),
  })
  .strict();
export type MobileDebugGenerationInput = z.infer<
  typeof mobileDebugGenerationInputSchema
>;

export const mobileDebugRegenerationInputSchema = z
  .object({
    workoutId: z.string().min(1),
    request: generationRequestSchema,
    scheduledDate: z.number().int().positive().optional(),
  })
  .strict();
export type MobileDebugRegenerationInput = z.infer<
  typeof mobileDebugRegenerationInputSchema
>;

export const mobileDebugHistoryQuerySchema = z
  .object({
    limit: z.number().int().positive().max(100).optional(),
    start: z.number().int().positive().optional(),
    end: z.number().int().positive().optional(),
    includeArchived: z.boolean().optional(),
  })
  .strict();
export type MobileDebugHistoryQuery = z.infer<
  typeof mobileDebugHistoryQuerySchema
>;

export const mobileDebugCalendarQuerySchema = z
  .object({
    start: z.number().int().positive(),
    end: z.number().int().positive(),
  })
  .strict();
export type MobileDebugCalendarQuery = z.infer<
  typeof mobileDebugCalendarQuerySchema
>;

export const mobileDebugQuickLogInputSchema = z
  .object({
    name: z.string().min(1),
    focus: z.string().min(1),
    durationMinutes: z.number().int().positive(),
    completedAt: z.number().int().positive().optional(),
    note: z.string().optional(),
  })
  .strict();
export type MobileDebugQuickLogInput = z.infer<
  typeof mobileDebugQuickLogInputSchema
>;

export const mobileDebugCompleteWorkoutInputSchema = z
  .object({
    workoutId: z.string().min(1),
    durationSeconds: z.number().int().nonnegative().optional(),
  })
  .strict();
export type MobileDebugCompleteWorkoutInput = z.infer<
  typeof mobileDebugCompleteWorkoutInputSchema
>;

export const mobileDebugResetInputSchema = z
  .object({
    confirm: z.literal(MOBILE_DEBUG_MCP_RESET_CONFIRMATION),
  })
  .strict();
export type MobileDebugResetInput = z.infer<typeof mobileDebugResetInputSchema>;

export const mobileDebugGenerationTraceSchema = z
  .object({
    id: z.string().min(1),
    startedAt: z.string().datetime(),
    completedAt: z.string().datetime().optional(),
    durationMs: z.number().int().nonnegative().optional(),
    operation: z.enum(['generate', 'regenerate']),
    status: z.enum(['success', 'error']),
    provider: z.string().optional(),
    request: generationRequestSchema.partial(),
    scheduledDate: z.number().int().positive().optional(),
    contextSummary: z
      .object({
        equipment: z.array(z.string()).optional(),
        recentSessionCount: z.number().int().nonnegative(),
        upcomingEventCount: z.number().int().nonnegative(),
        hasNotes: z.boolean(),
      })
      .strict(),
    result: z
      .object({
        planId: z.string().optional(),
        savedWorkoutId: z.string().optional(),
        responseId: z.string().optional(),
        source: z.string().optional(),
      })
      .strict()
      .optional(),
    error: z
      .object({
        code: z.string().optional(),
        message: z.string(),
      })
      .strict()
      .optional(),
  })
  .strict();
export type MobileDebugGenerationTrace = z.infer<
  typeof mobileDebugGenerationTraceSchema
>;

const bearerPattern = /Bearer\s+[A-Za-z0-9._~+/-]+=*/gi;
const cookieSecretPattern = /([^=;\s]+)=([^;\s]+)/g;
const secretKeyTerms = [
  'authorization',
  'cookie',
  'token',
  'secret',
  'password',
  'apikey',
  'api_key',
  'api-key',
  'key',
] as const;

const isSecretKey = (key: string): boolean => {
  const normalized = key.toLowerCase();
  return secretKeyTerms.some((term) => normalized.includes(term));
};

export function redactSecret(value: string | null | undefined): MobileDebugRedactedSecret {
  if (!value) {
    return { present: false };
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return { present: false };
  }

  const preview =
    trimmed.length <= 4
      ? `${REDACTED_SECRET}:${trimmed.length}`
      : `${trimmed.slice(0, 2)}...${trimmed.slice(-2)}`;

  return { present: true, preview };
}

export function redactSensitiveString(value: string): string {
  return value
    .replace(bearerPattern, `Bearer ${REDACTED_SECRET}`)
    .replace(cookieSecretPattern, `$1=${REDACTED_SECRET}`);
}

export function redactDebugValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return redactSensitiveString(value);
  }

  if (Array.isArray(value)) {
    return value.map(redactDebugValue);
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      isSecretKey(key) ? REDACTED_SECRET : redactDebugValue(item),
    ]),
  );
}
