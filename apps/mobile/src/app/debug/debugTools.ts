import NetInfo from '@react-native-community/netinfo';
import { Platform } from 'react-native';
import {
  MOBILE_DEBUG_MCP_PROTOCOL_VERSION,
  mobileDebugAppStateSchema,
  mobileDebugCalendarQuerySchema,
  mobileDebugCompleteWorkoutInputSchema,
  mobileDebugGenerationInputSchema,
  mobileDebugHistoryQuerySchema,
  mobileDebugQuickLogInputSchema,
  mobileDebugRegenerationInputSchema,
  mobileDebugResetInputSchema,
  mobileDebugSeedHistoryInputSchema,
  mobileDebugSeedPlannedEventsInputSchema,
  mobileDebugSetProfilePreferencesInputSchema,
  redactSecret,
} from '@workout-agent/shared';
import { getActiveDatabase, getActiveRepositories } from '../db/activeDatabase';
import { getDeviceToken } from '../storage/deviceToken';
import { getByokConfig } from '../storage/byokKey';
import { getLaunchCompleted } from '../storage/launchState';
import {
  fetchServerCapabilities,
  getSessionCookie,
  getSessionToken,
  isAuthEnabled,
} from '../services/auth-client';
import { backendDescriptor } from '../services/backendDescriptor';
import {
  buildGenerationContext,
  generateWorkout,
  quickLogWorkout,
} from '../services/api';
import { navigationRef } from '../navigation';
import { getLocalDateFromTimestamp } from '../utils/date';
import { getDebugMcpSidecarUrl } from './debugMcpConfig';
import { getDebugStateSnapshot } from './debugState';
import { registerDebugTool } from './debugToolRegistry';

let registered = false;

const countCollection = async (name: string): Promise<number> => {
  const database = getActiveDatabase();
  const records = await database.collections.get(name).query().fetch();
  return records.length;
};

const getDatabaseCounts = async () => {
  return {
    users: await countCollection('users'),
    workouts: await countCollection('workouts'),
    plannedEvents: await countCollection('planned_events'),
    exercises: await countCollection('exercises'),
    sets: await countCollection('sets'),
  };
};

const getDebugPlatform = () => {
  switch (Platform.OS) {
    case 'ios':
    case 'android':
    case 'web':
    case 'macos':
    case 'windows':
      return Platform.OS;
    default:
      return 'unknown';
  }
};

const getAppState = async () => {
  const debugState = getDebugStateSnapshot();
  const [
    network,
    capabilities,
    authEnabled,
    launchCompleted,
    byok,
    deviceToken,
  ] = await Promise.all([
    NetInfo.fetch(),
    fetchServerCapabilities(),
    isAuthEnabled(),
    getLaunchCompleted(),
    getByokConfig(),
    getDeviceToken(),
  ]);
  const sessionCookie = await getSessionCookie();
  const sessionToken = await getSessionToken();

  return mobileDebugAppStateSchema.parse({
    session: debugState.bridge.sessionId
      ? {
          sessionId: debugState.bridge.sessionId,
          protocolVersion: MOBILE_DEBUG_MCP_PROTOCOL_VERSION,
          platform: getDebugPlatform(),
        }
      : undefined,
    route: debugState.route,
    backendUrl: backendDescriptor.baseURL,
    bridge: {
      enabled: debugState.bridge.enabled,
      connected: debugState.bridge.connected,
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
  });
};

const getHomeState = async () => {
  const repositories = getActiveRepositories();
  const debugState = getDebugStateSnapshot();
  const workout = await repositories.workout.getTodayWorkout();
  const plan = workout
    ? await repositories.workout.mapWorkoutToPlan(workout)
    : null;
  const versions = await repositories.workout.listPlannedWorkoutVersionsForDate(
    Date.now()
  );
  const planVersions = await Promise.all(
    versions.map((item) => repositories.workout.mapWorkoutToPlan(item))
  );
  const recentSessions = (await repositories.workout.listRecentSessions(3)).map(
    (item) => repositories.workout.toSessionSummary(item)
  );

  return {
    snapshot: {
      plan,
      recentSessions,
      quickActions: debugState.homeUi?.quickActions,
      generationStatus: debugState.homeUi?.generationStatus,
    },
    planVersions,
    ui: debugState.homeUi,
  };
};

const listHistory = async (input: unknown) => {
  const repositories = getActiveRepositories();
  const query = mobileDebugHistoryQuerySchema.parse(input ?? {});
  const workouts =
    query.start && query.end
      ? await repositories.workout.listCompletedSessionsByDateRange(
          query.start,
          query.end,
          { includeArchived: query.includeArchived }
        )
      : await repositories.workout.listRecentSessions(query.limit ?? 50, {
          includeArchived: query.includeArchived,
        });

  return {
    sessions: workouts.map((workout) =>
      repositories.workout.toSessionSummary(workout)
    ),
  };
};

const listCalendar = async (input: unknown) => {
  const repositories = getActiveRepositories();
  const query = mobileDebugCalendarQuerySchema.parse(input);
  const [events, workouts] = await Promise.all([
    repositories.plannedEvent.listEventsByDateRange(query.start, query.end),
    repositories.workout.listCompletedSessionsByDateRange(
      query.start,
      query.end
    ),
  ]);

  return {
    events,
    sessions: workouts.map((workout) =>
      repositories.workout.toSessionSummary(workout)
    ),
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

const generateWorkoutTool = async (input: unknown) => {
  const repositories = getActiveRepositories();
  const parsed = mobileDebugGenerationInputSchema.parse(input);
  const plan = await generateWorkout(parsed.request, {
    scheduledDate: parsed.scheduledDate,
  });
  const savedWorkout = await repositories.workout.getWorkoutByPlanId(plan.id);

  return {
    plan,
    savedWorkoutId: savedWorkout?.id,
    trace: getDebugStateSnapshot().lastGenerationTrace,
  };
};

const regenerateWorkoutTool = async (input: unknown) => {
  const repositories = getActiveRepositories();
  const parsed = mobileDebugRegenerationInputSchema.parse(input);
  const baselineWorkout = await repositories.workout.getWorkoutByPlanId(
    parsed.workoutId
  );
  if (!baselineWorkout) {
    throw new Error(`No workout found for '${parsed.workoutId}'`);
  }

  const baselinePlan = await repositories.workout.mapWorkoutToPlan(
    baselineWorkout
  );
  const request = {
    ...parsed.request,
    previousResponseId:
      parsed.request.previousResponseId ?? baselinePlan.responseId,
    baselineWorkout: parsed.request.baselineWorkout ?? baselinePlan,
  };
  const plan = await generateWorkout(request, {
    scheduledDate: parsed.scheduledDate,
  });
  const versions = await repositories.workout.listPlannedWorkoutVersionsForDate(
    parsed.scheduledDate ?? Date.now()
  );
  const planVersions = await Promise.all(
    versions.map((item) => repositories.workout.mapWorkoutToPlan(item))
  );

  return {
    plan,
    planVersions,
    trace: getDebugStateSnapshot().lastGenerationTrace,
  };
};

const getLastGenerationTrace = () => ({
  trace: getDebugStateSnapshot().lastGenerationTrace,
});

const setProfilePreferences = async (input: unknown) => {
  const repositories = getActiveRepositories();
  const parsed = mobileDebugSetProfilePreferencesInputSchema.parse(input);
  await repositories.user.updatePreferences(parsed.preferences);

  return {
    preferences: await repositories.user.getPreferences(),
  };
};

const assertDebugWorkoutsPersisted = async (
  createdIds: string[]
): Promise<void> => {
  const repositories = getActiveRepositories();
  if (!createdIds.length) {
    return;
  }

  const recentWorkouts = await repositories.workout.listRecentSessions(
    Math.max(createdIds.length, 50),
    { includeArchived: true }
  );
  const persistedIds = new Set(recentWorkouts.map((workout) => workout.id));
  const missingIds = createdIds.filter((id) => !persistedIds.has(id));

  if (missingIds.length) {
    throw new Error(
      `Debug history mutation did not persist workouts: ${missingIds.join(
        ', '
      )}`
    );
  }
};

const seedHistory = async (input: unknown) => {
  const repositories = getActiveRepositories();
  const parsed = mobileDebugSeedHistoryInputSchema.parse(input);
  const sessions = [];

  for (const session of parsed.sessions) {
    const workout = await repositories.workout.quickLogManualSession(session);
    sessions.push(repositories.workout.toSessionSummary(workout));
  }

  await assertDebugWorkoutsPersisted(sessions.map((session) => session.id));

  return {
    sessions,
    database: await getDatabaseCounts(),
  };
};

const seedPlannedEvents = async (input: unknown) => {
  const repositories = getActiveRepositories();
  const parsed = mobileDebugSeedPlannedEventsInputSchema.parse(input);
  const events = [];

  for (const event of parsed.events) {
    events.push(await repositories.plannedEvent.createPlannedEvent(event));
  }

  return { events };
};

const quickLogWorkoutTool = async (input: unknown) => {
  const parsed = mobileDebugQuickLogInputSchema.parse(input);
  const session = await quickLogWorkout(parsed);
  await assertDebugWorkoutsPersisted([session.id]);

  return {
    session,
    database: await getDatabaseCounts(),
  };
};

const completeWorkout = async (input: unknown) => {
  const repositories = getActiveRepositories();
  const parsed = mobileDebugCompleteWorkoutInputSchema.parse(input);
  await repositories.workout.completeWorkoutById(
    parsed.workoutId,
    parsed.durationSeconds
  );

  return {
    session: await repositories.workout.getSessionDetailById(parsed.workoutId),
  };
};

const resetCollection = async (name: string): Promise<number> => {
  const database = getActiveDatabase();
  const collection = database.collections.get(name);
  const records = await collection.query().fetch();

  for (const record of records) {
    await record.destroyPermanently();
  }

  return records.length;
};

const resetDebugData = async (input: unknown) => {
  mobileDebugResetInputSchema.parse(input);
  const database = getActiveDatabase();

  const removed = await database.write(async () => ({
    sets: await resetCollection('sets'),
    exercises: await resetCollection('exercises'),
    workouts: await resetCollection('workouts'),
    plannedEvents: await resetCollection('planned_events'),
    users: await resetCollection('users'),
  }));

  return { removed };
};

const assertNavigationReady = () => {
  if (!navigationRef.isReady()) {
    throw new Error('Navigation is not ready');
  }
};

const openKnownRoute = (route: 'Home' | 'History' | 'Settings') => {
  assertNavigationReady();
  navigationRef.navigate(route);
  return { route };
};

const resolveSelectedPlan = async () => {
  const repositories = getActiveRepositories();
  const debugPlan = getDebugStateSnapshot().selectedPlan;
  if (debugPlan) {
    return debugPlan;
  }

  const workout = await repositories.workout.getTodayWorkout();
  return workout ? repositories.workout.mapWorkoutToPlan(workout) : null;
};

const openCurrentWorkoutPreview = async () => {
  assertNavigationReady();
  const plan = await resolveSelectedPlan();
  if (!plan) {
    throw new Error('No selected workout plan is available');
  }

  navigationRef.navigate('WorkoutPreview', { plan });
  return { route: 'WorkoutPreview', planId: plan.id };
};

const startCurrentWorkout = async () => {
  assertNavigationReady();
  const plan = await resolveSelectedPlan();
  if (!plan) {
    throw new Error('No selected workout plan is available');
  }

  navigationRef.navigate('ActiveWorkout', { plan });
  return { route: 'ActiveWorkout', planId: plan.id };
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
  registerDebugTool('generate_workout', generateWorkoutTool);
  registerDebugTool('regenerate_workout', regenerateWorkoutTool);
  registerDebugTool('get_last_generation_trace', getLastGenerationTrace);
  registerDebugTool('set_profile_preferences', setProfilePreferences);
  registerDebugTool('seed_history', seedHistory);
  registerDebugTool('seed_planned_events', seedPlannedEvents);
  registerDebugTool('quick_log_workout', quickLogWorkoutTool);
  registerDebugTool('complete_workout', completeWorkout);
  registerDebugTool('reset_debug_data', resetDebugData);
  registerDebugTool('open_home', () => openKnownRoute('Home'));
  registerDebugTool('open_history', () => openKnownRoute('History'));
  registerDebugTool('open_settings', () => openKnownRoute('Settings'));
  registerDebugTool('open_current_workout_preview', openCurrentWorkoutPreview);
  registerDebugTool('start_current_workout', startCurrentWorkout);
}
