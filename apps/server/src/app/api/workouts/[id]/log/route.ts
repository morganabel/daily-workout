import { authenticateRequest } from '@/lib/auth';
import { createErrorResponse } from '@/lib/errors';
import {
  logWorkoutRequestSchema,
  logWorkoutResponseSchema,
  workoutSessionSchema,
  workoutSessionSummarySchema,
  type LogWorkoutRequest,
  type WorkoutSession,
  type WorkoutSessionSummary,
  workoutSourceSchema,
} from '@workout-agent/shared';
import { NextResponse } from 'next/server';
import { clearStoredPlan, getGenerationState } from '@/lib/generation-store';
import { persistLoggedSession } from '@/lib/workout-session-store';

/**
 * POST /api/workouts/:id/log
 * 
 * Marks a workout plan as completed and returns the updated session summary.
 * 
 * TODO: Also support quick-log without a plan ID (separate endpoint or query param)
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } },
): Promise<Response> {
  // Authenticate request
  const auth = await authenticateRequest(request);
  if (!auth) {
    return createErrorResponse(
      'UNAUTHORIZED',
      'Invalid or missing DeviceToken',
      401,
    );
  }

  // Handle both Promise and direct params (Next.js version compatibility)
  const resolvedParams = 'then' in params ? await params : params;
  const planId = resolvedParams.id;
  const body = await request.json().catch(() => ({} as unknown));
  const parsedPayload = logWorkoutRequestSchema.safeParse(body);

  if (!parsedPayload.success) {
    return createErrorResponse(
      'INVALID_REQUEST',
      `Invalid workout log payload: ${parsedPayload.error.message}`,
      422,
    );
  }

  const payload: LogWorkoutRequest = parsedPayload.data;
  const completedAtIso = payload.completedAt ?? new Date().toISOString();
  const generationState = getGenerationState(auth.deviceToken);
  const plan = generationState.plan;

  const baseName = 'name' in payload && payload.name
    ? payload.name
    : plan?.focus ?? 'Workout Session';
  const focus = 'focus' in payload && payload.focus
    ? payload.focus
    : plan?.focus ?? baseName;

  let durationSeconds: number | undefined;
  if ('durationSeconds' in payload && payload.durationSeconds) {
    durationSeconds = payload.durationSeconds;
  } else if ('durationMinutes' in payload && payload.durationMinutes) {
    durationSeconds = payload.durationMinutes * 60;
  } else if (plan?.durationMinutes) {
    durationSeconds = plan.durationMinutes * 60;
  }

  const exercises: WorkoutSession['exercises'] = 'exercises' in payload && payload.exercises
    ? payload.exercises.map((exercise) => ({
        ...exercise,
        // Ensure exerciseId is set for plan logs
        exerciseId: exercise.exerciseId ?? exercise.name,
      }))
    : [];

  const isQuickLog =
    ('type' in payload && payload.type === 'quick') ||
    ('durationMinutes' in payload && !('exercises' in payload));

  const source = (() => {
    if (isQuickLog) return 'manual' as const;
    if ('type' in payload && payload.type === 'plan') return (plan?.source ?? 'ai') as const;
    return plan?.source ?? 'manual';
  })();

  const loggedSession = workoutSessionSchema.parse({
    id: `session-${planId}-${Date.now()}`,
    workoutId: planId ?? 'manual',
    name: baseName,
    focus,
    source,
    completedAt: completedAtIso,
    durationSeconds,
    note: 'note' in payload ? payload.note : undefined,
    exercises,
  });

  const durationMinutes = loggedSession.durationSeconds
    ? Math.max(1, Math.round(loggedSession.durationSeconds / 60))
    : plan?.durationMinutes ?? 30;

  const sessionSummary: WorkoutSessionSummary = workoutSessionSummarySchema.parse({
    id: loggedSession.id,
    name: loggedSession.name ?? focus ?? 'Workout Session',
    focus: focus ?? loggedSession.name ?? 'Workout Session',
    completedAt: loggedSession.completedAt,
    durationMinutes,
    source: workoutSourceSchema.parse(source),
  });

  const responsePayload = persistLoggedSession(
    auth.deviceToken,
    sessionSummary,
    loggedSession,
  );

  clearStoredPlan(auth.deviceToken);

  return NextResponse.json(logWorkoutResponseSchema.parse(responsePayload));
}
