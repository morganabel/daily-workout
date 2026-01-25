import { loadGenerationContext, type GenerationRequestWithContext } from './context';
import { createGenerationContextMock } from '@workout-agent/shared';

describe('loadGenerationContext', () => {
  const userId = 'test-user-id';

  describe('auto-focus handling', () => {
    describe('with client-provided context', () => {
      const clientContext = createGenerationContextMock({
        preferences: {
          focusBias: ['Legs', 'Core'],
        },
      });

      it('does not override focusBias when focus is "Smart"', async () => {
        const request: GenerationRequestWithContext = {
          focus: 'Smart',
          context: clientContext,
        };

        const result = await loadGenerationContext(userId, request);

        expect(result.preferences.focusBias).toEqual(['Legs', 'Core']);
      });

      it('does not override focusBias when focus is "auto"', async () => {
        const request: GenerationRequestWithContext = {
          focus: 'auto',
          context: clientContext,
        };

        const result = await loadGenerationContext(userId, request);

        expect(result.preferences.focusBias).toEqual(['Legs', 'Core']);
      });

      it('does not override focusBias when focus is "AUTO" (case-insensitive)', async () => {
        const request: GenerationRequestWithContext = {
          focus: 'AUTO',
          context: clientContext,
        };

        const result = await loadGenerationContext(userId, request);

        expect(result.preferences.focusBias).toEqual(['Legs', 'Core']);
      });

      it('prepends specific focus to existing focusBias', async () => {
        const request: GenerationRequestWithContext = {
          focus: 'Push',
          context: clientContext,
        };

        const result = await loadGenerationContext(userId, request);

        expect(result.preferences.focusBias).toEqual(['Push', 'Legs', 'Core']);
      });

      it('limits focusBias to 3 items when prepending', async () => {
        const contextWithFullBias = createGenerationContextMock({
          preferences: {
            focusBias: ['A', 'B', 'C'],
          },
        });

        const request: GenerationRequestWithContext = {
          focus: 'Push',
          context: contextWithFullBias,
        };

        const result = await loadGenerationContext(userId, request);

        // Prepends 'Push' and keeps only the first 2 of existing bias
        expect(result.preferences.focusBias).toEqual(['Push', 'A', 'B']);
      });
    });

    describe('without client-provided context (fallback)', () => {
      it('sets focusBias to undefined when focus is "Smart"', async () => {
        const request: GenerationRequestWithContext = {
          focus: 'Smart',
          timeMinutes: 30,
        };

        const result = await loadGenerationContext(userId, request);

        expect(result.preferences.focusBias).toBeUndefined();
      });

      it('sets focusBias to undefined when focus is "auto"', async () => {
        const request: GenerationRequestWithContext = {
          focus: 'auto',
          timeMinutes: 30,
        };

        const result = await loadGenerationContext(userId, request);

        expect(result.preferences.focusBias).toBeUndefined();
      });

      it('sets focusBias to the specific focus value', async () => {
        const request: GenerationRequestWithContext = {
          focus: 'Pull',
          timeMinutes: 30,
        };

        const result = await loadGenerationContext(userId, request);

        expect(result.preferences.focusBias).toEqual(['Pull']);
      });

      it('sets focusBias to undefined when no focus provided', async () => {
        const request: GenerationRequestWithContext = {
          timeMinutes: 30,
        };

        const result = await loadGenerationContext(userId, request);

        expect(result.preferences.focusBias).toBeUndefined();
      });
    });
  });

  describe('other request parameters', () => {
    it('sets equipment from request', async () => {
      const request: GenerationRequestWithContext = {
        equipment: ['Barbell', 'Kettlebell'],
      };

      const result = await loadGenerationContext(userId, request);

      expect(result.environment.equipment).toEqual(['Barbell', 'Kettlebell']);
    });

    it('defaults equipment to Bodyweight when not provided', async () => {
      const request: GenerationRequestWithContext = {};

      const result = await loadGenerationContext(userId, request);

      expect(result.environment.equipment).toEqual(['Bodyweight']);
    });

    it('sets energy from request', async () => {
      const request: GenerationRequestWithContext = {
        energy: 'high',
      };

      const result = await loadGenerationContext(userId, request);

      expect(result.userProfile.energyToday).toBe('high');
    });

    it('sets timeAvailableMinutes from request', async () => {
      const request: GenerationRequestWithContext = {
        timeMinutes: 45,
      };

      const result = await loadGenerationContext(userId, request);

      expect(result.environment.timeAvailableMinutes).toBe(45);
    });
  });
});
