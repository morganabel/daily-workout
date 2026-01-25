import { buildRegenerationMessage } from './prompts';
import type { GenerationRequest, RegenerationFeedback } from '@workout-agent/shared';

describe('buildRegenerationMessage', () => {
  const baseRequest: GenerationRequest = {
    timeMinutes: 30,
    equipment: ['Dumbbells'],
    energy: 'moderate',
  };

  describe('auto-focus handling', () => {
    it('does not include "Smart" focus in structured changes', () => {
      const request: GenerationRequest = {
        ...baseRequest,
        focus: 'Smart',
      };

      const message = buildRegenerationMessage(request);

      expect(message).not.toContain('focus: Smart');
      expect(message).toContain('duration: 30 minutes');
    });

    it('does not include "auto" focus in structured changes', () => {
      const request: GenerationRequest = {
        ...baseRequest,
        focus: 'auto',
      };

      const message = buildRegenerationMessage(request);

      expect(message).not.toContain('focus: auto');
    });

    it('does not include "AUTO" focus in structured changes (case-insensitive)', () => {
      const request: GenerationRequest = {
        ...baseRequest,
        focus: 'AUTO',
      };

      const message = buildRegenerationMessage(request);

      expect(message).not.toContain('focus: AUTO');
    });

    it('includes specific focus values in structured changes', () => {
      const request: GenerationRequest = {
        ...baseRequest,
        focus: 'Push',
      };

      const message = buildRegenerationMessage(request);

      expect(message).toContain('focus: Push');
    });

    it('includes "Pull" focus in structured changes', () => {
      const request: GenerationRequest = {
        ...baseRequest,
        focus: 'Pull',
      };

      const message = buildRegenerationMessage(request);

      expect(message).toContain('focus: Pull');
    });
  });

  describe('hasStructured detection with auto-focus', () => {
    it('treats request with only auto-focus as unstructured when combined with notes', () => {
      const request: GenerationRequest = {
        focus: 'Smart',
        notes: 'Make it harder',
      };

      const message = buildRegenerationMessage(request);

      // When unstructured, notes get the "single source of truth" treatment
      expect(message).toContain('single source of truth');
    });

    it('treats request with specific focus as structured when combined with notes', () => {
      const request: GenerationRequest = {
        focus: 'Push',
        notes: 'Make it harder',
      };

      const message = buildRegenerationMessage(request);

      // When structured, notes get the "prioritize" treatment
      expect(message).toContain('Prioritize the user instructions');
      expect(message).not.toContain('single source of truth');
    });
  });

  describe('feedback handling', () => {
    it('includes feedback descriptions', () => {
      const feedback: RegenerationFeedback[] = ['too-hard', 'different-exercises'];

      const message = buildRegenerationMessage(baseRequest, feedback);

      expect(message).toContain('too hard/intense');
      expect(message).toContain('different exercises');
    });
  });

  describe('equipment and energy', () => {
    it('includes equipment in changes', () => {
      const request: GenerationRequest = {
        ...baseRequest,
        equipment: ['Barbell', 'Kettlebell'],
      };

      const message = buildRegenerationMessage(request);

      expect(message).toContain('equipment: Barbell, Kettlebell');
    });

    it('includes energy level in changes', () => {
      const request: GenerationRequest = {
        ...baseRequest,
        energy: 'high',
      };

      const message = buildRegenerationMessage(request);

      expect(message).toContain('energy level: high');
    });
  });
});
