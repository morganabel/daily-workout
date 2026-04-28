import NetInfo from '@react-native-community/netinfo';
import { Platform } from 'react-native';
import {
  mobileDebugCalendarQuerySchema,
  mobileDebugGenerationInputSchema,
  mobileDebugHistoryQuerySchema,
  redactSecret,
} from '@workout-agent/shared';
import { database } from '../db';
import { plannedEventRepository } from '../db/repositories/PlannedEventRepository';
import { workoutRepository } from '../db/repositories/WorkoutRepository';
import { getDeviceToken } from '../storage/deviceToken';
import { getByokConfig } from '../storage/byokKey';
import { getLaunchCompleted } from '../storage/launchState';
import {
  fetchServerCapabilities,
  getSessionCookie,
  getSessionToken,
  isAuthEnabled,
} from '../services/auth-client';
import { buildGenerationContext } from '../services/api';
import { getLocalDateFromTimestamp } from '../utils/date';
import { getDebugMcpSidecarUrl } from './debugMcpConfig';
import { getDebugStateSnapshot } from './debugState';
import { registerDebugTool } from './debugToolRegistry';

let registered = false;

const countCollection = async (name: string): Promise<number> => {
  const records = await database.collections.get(name).query().fetch();
  return records.length;
};

const getDatabaseCounts = async () => ({
  users: await countCollection('users'),
  workouts: await countCollection('workouts'),
  plannedEvents: await countCollection('planned_events'),
  exercises: await countCollection('exercises'),
  sets: await countCollection('sets'),
});

const getAppState = async () => {
  const debugState = getDebugStateSnapshot();
  const [network, capabilities, authEnabled, launchCompleted, byok, deviceToken] =
    await Promise.all([
      NetInfo.fetch(),
      fetchServerCapabilities(),
      isAuthEnabled(),
      getLaunchCompleted(),
      getByokConfig(),
      getDeviceToken(),
    ]);
  const sessionCookie = getSessionCookie();
  const sessionToken = await getSessionToken();

  return {
    session: debugState.bridge.sessionId
      ? {
          sessionId: debugState.bridge.sessionId,
          platform: Platform.OS,
        }
      : undefined,
    route: debugState.route,
    backendUrl: process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:3000',
    bridge: {
      ...debugState.bridge,
      sidecarUrl: debugState.bridge.sidecarUrl ?? getDebugMcpSidecarUrl(),
    },
    serverCapabilities: capabilities,
    network,
    launchCompleted,
    auth: {
      enabled: authEnabled,
      sessionCookie: redactSecret(sessionCookie),
      sessionToken: redactSecret(sessionToken),
      deviceToken: redactSecret(deviceToken),
    },
    byok: byok
      ? {
          provider: byok.provider,
          apiKey: redactSecret(byok.apiKey),
        }
      : {
          apiKey: redactSecret(null),
        },
    database: await getDatabaseCounts(),
    ui: {
      home: debugState.homeUi,
      activeWorkout: debugState.activeWorkoutUi,
    },
  };
};

const getHomeState = async () => {
  const debugState = getDebugStateSnapshot();
  const workout = await workoutRepository.getTodayWorkout();
  const plan = workout ? await workoutRepository.mapWorkoutToPlan(workout) : null;
  const versions = await workoutRepository.listPlannedWorkoutVersionsForDate(
    Date.now(),
  );
  const planVersions = await Promise.all(
    versions.map((item) => workoutRepository.mapWorkoutToPlan(item)),
  );
  const recentSessions = (await workoutRepository.listRecentSessions(3)).map(
    (item) => workoutRepository.toSessionSummary(item),
  );

  return {
    snapshot: {
      plan,
      planVersions,
      recentSessions,
      quickActions: debugState.homeUi?.quickActions,
      generationStatus: debugState.homeUi?.generationStatus,
      offlineHint: {
        offline: false,
        requiresApiKey: false,
      },
    },
    ui: debugState.homeUi,
  };
};

const listHistory = async (input: unknown) => {
  const query = mobileDebugHistoryQuerySchema.parse(input ?? {});
  const workouts =
    query.start && query.end
      ? await workoutRepository.listCompletedSessionsByDateRange(
          query.start,
          query.end,
          { includeArchived: query.includeArchived },
        )
      : await workoutRepository.listRecentSessions(query.limit ?? 50, {
          includeArchived: query.includeArchived,
        });

  return {
    sessions: workouts.map((workout) => workoutRepository.toSessionSummary(workout)),
  };
};

const listCalendar = async (input: unknown) => {
  const query = mobileDebugCalendarQuerySchema.parse(input);
  const [events, workouts] = await Promise.all([
    plannedEventRepository.listEventsByDateRange(query.start, query.end),
    workoutRepository.listCompletedSessionsByDateRange(query.start, query.end),
  ]);

  return {
    events,
    sessions: workouts.map((workout) => workoutRepository.toSessionSummary(workout)),
  };
};

const getGenerationContext = async (input: unknown) => {
  const parsed = mobileDebugGenerationInputSchema.parse(input);
  const request = parsed.scheduledDate
    ? {
        ...parsed.request,
        planningDateLocal:
          parsed.request.planningDateLocal ??
          getLocalDateFromTimestamp(parsed.scheduledDate),
      }
    : parsed.request;
  const context = await buildGenerationContext(request);

  return {
    request,
    context,
    summary: {
      equipment: context.environment.equipment,
      recentSessionCount: context.recentSessions.length,
      upcomingEventCount: request.upcomingEvents?.length ?? 0,
      hasNotes: Boolean(context.notes || request.notes),
    },
  };
};

export function registerDebugTools(): void {
  if (registered) {
    return;
  }
  registered = true;

  registerDebugTool('get_app_state', getAppState);
  registerDebugTool('get_home_state', getHomeState);
  registerDebugTool('list_history', listHistory);
  registerDebugTool('list_calendar', listCalendar);
  registerDebugTool('get_generation_context', getGenerationContext);
}
