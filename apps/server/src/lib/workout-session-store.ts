import type {
  WorkoutSession,
  WorkoutSessionSummary,
} from '@workout-agent/shared';

const DEFAULT_RECENT_LIMIT = 5;

type SessionState = {
  sessions: WorkoutSession[];
  summaries: WorkoutSessionSummary[];
};

const sessionsByDevice = new Map<string, SessionState>();

const cloneSession = (session: WorkoutSession): WorkoutSession => ({
  ...session,
  exercises: session.exercises?.map((exercise) => ({
    ...exercise,
    sets: exercise.sets.map((set) => ({
      ...set,
      load: set.load ? { ...set.load } : undefined,
    })),
  })) ?? [],
});

const cloneSummary = (
  summary: WorkoutSessionSummary,
): WorkoutSessionSummary => ({
  ...summary,
});

const ensureState = (deviceToken: string): SessionState => {
  const existing = sessionsByDevice.get(deviceToken);
  if (existing) return existing;
  const created: SessionState = { sessions: [], summaries: [] };
  sessionsByDevice.set(deviceToken, created);
  return created;
};

export function persistLoggedSession(
  deviceToken: string,
  summary: WorkoutSessionSummary,
  session: WorkoutSession,
  recentLimit: number = DEFAULT_RECENT_LIMIT,
) {
  const state = ensureState(deviceToken);
  state.sessions.unshift(cloneSession(session));
  state.summaries.unshift(cloneSummary(summary));

  state.sessions = state.sessions.slice(0, recentLimit);
  state.summaries = state.summaries.slice(0, recentLimit);

  return {
    recentSessions: state.summaries.map(cloneSummary),
    loggedSession: cloneSession(session),
  };
}

export function getRecentSessions(
  deviceToken: string,
  recentLimit: number = DEFAULT_RECENT_LIMIT,
) {
  const state = ensureState(deviceToken);
  return {
    recentSessions: state.summaries.slice(0, recentLimit).map(cloneSummary),
    loggedSession: state.sessions[0] ? cloneSession(state.sessions[0]) : undefined,
  };
}

export function resetWorkoutSessionStore() {
  sessionsByDevice.clear();
}
