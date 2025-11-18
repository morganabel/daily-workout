import { z } from 'zod';
import {
  QuickActionPreset,
  quickActionPresetSchema,
  todayPlanSchema,
  workoutSessionSummarySchema,
  createSessionSummaryMock,
  createTodayPlanMock,
} from './workouts';

export const offlineHintSchema = z.object({
  offline: z.boolean().default(false),
  requiresApiKey: z.boolean().default(false),
  message: z.string().optional(),
});
export type OfflineHint = z.infer<typeof offlineHintSchema>;

export const generationStatusSchema = z.object({
  state: z.enum(['idle', 'pending', 'error']),
  submittedAt: z.string().nullable(),
  etaSeconds: z.number().int().positive().optional(),
  message: z.string().optional(),
});
export type GenerationStatus = z.infer<typeof generationStatusSchema>;

export const homeSnapshotSchema = z.object({
  plan: todayPlanSchema.nullable(),
  quickActions: z.array(quickActionPresetSchema).length(5),
  recentSessions: z.array(workoutSessionSummarySchema).max(3),
  offlineHint: offlineHintSchema,
  generationStatus: generationStatusSchema,
});
export type HomeSnapshot = z.infer<typeof homeSnapshotSchema>;

const defaultQuickActions: QuickActionPreset[] = [
  {
    key: 'time',
    label: 'Time',
    value: '30',
    description: '30 min',
    stagedValue: null,
  },
  {
    key: 'focus',
    label: 'Focus',
    value: 'Upper body',
    description: 'Upper body',
    stagedValue: null,
  },
  {
    key: 'equipment',
    label: 'Equipment',
    value: 'Dumbbells',
    description: 'Dumbbells',
    stagedValue: null,
  },
  {
    key: 'energy',
    label: 'Energy',
    value: 'Moderate',
    description: 'Moderate energy',
    stagedValue: null,
  },
  {
    key: 'backfill',
    label: 'Backfill',
    value: 'Today',
    description: 'Log past session',
    stagedValue: null,
  },
];

export const createHomeSnapshotMock = (
  overrides: Partial<HomeSnapshot> = {},
): HomeSnapshot => ({
  plan: createTodayPlanMock(),
  quickActions: defaultQuickActions,
  recentSessions: [
    createSessionSummaryMock({
      id: 'session-1',
      name: 'Lower Body Reset',
      focus: 'Legs',
      durationMinutes: 38,
    }),
    createSessionSummaryMock({
      id: 'session-2',
      name: 'Intervals + Core',
      focus: 'Conditioning',
      durationMinutes: 24,
    }),
  ],
  offlineHint: {
    offline: false,
    requiresApiKey: false,
    message: undefined,
  },
  generationStatus: {
    state: 'idle',
    submittedAt: null,
    etaSeconds: undefined,
    message: undefined,
  },
  ...overrides,
});
