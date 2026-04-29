import { z } from 'zod';

export const PROTOCOL_VERSION = 1;

export const toolNames = [
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

export const platformSchema = z.enum([
  'ios',
  'android',
  'web',
  'macos',
  'windows',
  'unknown',
]);

export const helloSchema = z
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
        platform: platformSchema,
        deviceName: z.string().optional(),
      })
      .strict(),
  })
  .strict();

export const appResponseSchema = z.discriminatedUnion('ok', [
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
