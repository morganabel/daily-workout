import {
  createGenerationContextMock,
  type GenerationContext,
  type GenerationRequest,
} from '@workout-agent/shared';

/**
 * Loads generation context for a user.
 * For now this stitches together request inputs with mocked history/preferences.
 */
export async function loadGenerationContext(
  userId: string,
  request: GenerationRequest,
): Promise<GenerationContext> {
  // TODO: Replace with real persistence once Prisma is wired up.
  return createGenerationContextMock({
    userProfile: {
      energyToday: request.energy ?? undefined,
    },
    environment: {
      equipment: request.equipment ?? ['Bodyweight'],
      timeAvailableMinutes: request.timeMinutes,
    },
    notes: request.notes ?? undefined,
    preferences: {
      focusBias: request.focus ? [request.focus] : undefined,
    },
  });
}
