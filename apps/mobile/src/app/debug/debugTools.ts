import NetInfo from '@react-native-community/netinfo';
import { Platform } from 'react-native';
import {
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
import { database } from '../db';
import { plannedEventRepository } from '../db/repositories/PlannedEventRepository';
import { userRepository } from '../db/repositories/UserRepository';
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
import {
  buildGenerationContext,
  generateWorkout,
  quickLogWorkout,
} from '../services/api';
import { navigationRef } from '../navigation';
import { getLocalDateFromTimestamp } from '../utils/date';
import { getDebugMcpSidecarUrl } from './debugMcpConfig';
import { getDebugStateSnapshot } from './debugState';
import { redactDebugNotesFields } from './redaction';
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
      recentSessions,
      quickActions: debugState.homeUi?.quickActions,
      generationStatus: debugState.homeUi?.generationStatus,
    },
    planVersions,
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
    request: redactDebugNotesFields(request),
    context: redactDebugNotesFields(context),
    summary: {
      equipment: context.environment.equipment,
      recentSessionCount: context.recentSessions.length,
      upcomingEventCount: request.upcomingEvents?.length ?? 0,
      hasNotes: Boolean(context.notes || request.notes),
    },
  };
};

const generateWorkoutTool = async (input: unknown) => {
  const parsed = mobileDebugGenerationInputSchema.parse(input);
  const plan = await generateWorkout(parsed.request, {
    scheduledDate: parsed.scheduledDate,
  });
  const savedWorkout = await workoutRepository.getWorkoutByPlanId(plan.id);

  return {
    plan,
    savedWorkoutId: savedWorkout?.id,
    trace: getDebugStateSnapshot().lastGenerationTrace,
  };
};

const regenerateWorkoutTool = async (input: unknown) => {
  const parsed = mobileDebugRegenerationInputSchema.parse(input);
  const baselineWorkout = await workoutRepository.getWorkoutByPlanId(
    parsed.workoutId,
  );
  if (!baselineWorkout) {
    throw new Error(`No workout found for '${parsed.workoutId}'`);
  }

  const baselinePlan = await workoutRepository.mapWorkoutToPlan(baselineWorkout);
  const request = {
    ...parsed.request,
    previousResponseId:
      parsed.request.previousResponseId ?? baselinePlan.responseId,
    baselineWorkout: parsed.request.baselineWorkout ?? baselinePlan,
  };
  const plan = await generateWorkout(request, {
    scheduledDate: parsed.scheduledDate,
  });
  const versions = await workoutRepository.listPlannedWorkoutVersionsForDate(
    parsed.scheduledDate ?? Date.now(),
  );
  const planVersions = await Promise.all(
    versions.map((item) => workoutRepository.mapWorkoutToPlan(item)),
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
  const parsed = mobileDebugSetProfilePreferencesInputSchema.parse(input);
  await userRepository.updatePreferences(parsed.preferences);

  return {
    preferences: await userRepository.getPreferences(),
  };
};

const seedHistory = async (input: unknown) => {
  const parsed = mobileDebugSeedHistoryInputSchema.parse(input);
  const sessions = [];

  for (const session of parsed.sessions) {
    const workout = await workoutRepository.quickLogManualSession(session);
    sessions.push(workoutRepository.toSessionSummary(workout));
  }

  return { sessions };
};

const seedPlannedEvents = async (input: unknown) => {
  const parsed = mobileDebugSeedPlannedEventsInputSchema.parse(input);
  const events = [];

  for (const event of parsed.events) {
    events.push(await plannedEventRepository.createPlannedEvent(event));
  }

  return { events };
};

const quickLogWorkoutTool = async (input: unknown) => {
  const parsed = mobileDebugQuickLogInputSchema.parse(input);
  const session = await quickLogWorkout(parsed);

  return { session };
};

const completeWorkout = async (input: unknown) => {
  const parsed = mobileDebugCompleteWorkoutInputSchema.parse(input);
  await workoutRepository.completeWorkoutById(
    parsed.workoutId,
    parsed.durationSeconds,
  );

  return {
    session: await workoutRepository.getSessionDetailById(parsed.workoutId),
  };
};

const resetCollection = async (name: string): Promise<number> => {
  const collection = database.collections.get(name);
  const records = await collection.query().fetch();

  for (const record of records) {
    await record.destroyPermanently();
  }

  return records.length;
};

const resetDebugData = async (input: unknown) => {
  mobileDebugResetInputSchema.parse(input);

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
  const debugPlan = getDebugStateSnapshot().selectedPlan;
  if (debugPlan) {
    return debugPlan;
  }

  const workout = await workoutRepository.getTodayWorkout();
  return workout ? workoutRepository.mapWorkoutToPlan(workout) : null;
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
