import {
  generationContextSchema,
  isAutoFocus,
  type GenerationContext,
  type GenerationRequestPayload,
} from '@leveza/shared';
import { createLogger } from './logging';

export type GenerationRequestWithContext = GenerationRequestPayload;

/**
 * Loads generation context for a user.
 *
 * If the client provides a context object (from local DB), we use that.
 * Otherwise, we build a minimal context from the request parameters.
 *
 * This approach supports the local-first architecture where the mobile client
 * is the source of truth for user preferences and history.
 */
export async function loadGenerationContext(
  _userId: string,
  request: GenerationRequestWithContext,
): Promise<GenerationContext> {
  const log = createLogger({ route: 'generation.context' });

  // If client provided context, validate and use it
  if (request.context) {
    const result = generationContextSchema.safeParse(request.context);
    if (result.success) {
      // Merge any request-level overrides (quick actions take precedence)
      return {
        ...result.data,
        userProfile: {
          ...result.data.userProfile,
          energyToday: request.energy ?? result.data.userProfile.energyToday,
        },
        environment: {
          ...result.data.environment,
          equipment: request.equipment ?? result.data.environment.equipment,
          timeAvailableMinutes:
            request.timeMinutes ?? result.data.environment.timeAvailableMinutes,
        },
        preferences: {
          ...result.data.preferences,
          focusBias:
            request.focus && !isAutoFocus(request.focus)
              ? [
                  request.focus,
                  ...(result.data.preferences.focusBias ?? []).slice(0, 2),
                ]
              : result.data.preferences.focusBias,
        },
      };
    }
    log.warn('invalid client context; building from request', {
      message: result.error.message,
      issues: result.error.issues.length,
    });
  }

  // Fallback: build minimal context from request parameters only
  // Used when client doesn't provide context (e.g., no profile configured yet)
  return {
    userProfile: {
      energyToday: request.energy ?? undefined,
    },
    preferences: {
      focusBias:
        request.focus && !isAutoFocus(request.focus)
          ? [request.focus]
          : undefined,
    },
    environment: {
      equipment: request.equipment ?? ['Bodyweight'],
      timeAvailableMinutes: request.timeMinutes,
    },
    recentSessions: [],
  };
}
