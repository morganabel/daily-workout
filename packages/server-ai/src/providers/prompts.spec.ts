import {
  buildCandidatePoolPromptData,
  buildPlanningBriefPromptData,
  buildStageOnePlannerArtifactPromptData,
  buildStageOnePlannerRequestPayload,
  buildRegenerationMessage,
} from './prompts';
import type {
  ExerciseCandidatePool,
  PlanningBrief,
  StageOnePlannerArtifact,
} from '@workout-agent-ce/server-core';
import type {
  GenerationRequest,
  RegenerationFeedback,
} from '@workout-agent/shared';

describe('buildRegenerationMessage', () => {
  const baseRequest: GenerationRequest = {
    timeMinutes: 30,
    equipment: ['Dumbbells'],
    energy: 'moderate',
  };

  const candidatePool: ExerciseCandidatePool = {
    libraryVersion: 'test-library',
    totalEligibleCount: 2,
    searchText: 'upper body strength',
    baselineExerciseIds: ['fedb:pushups'],
    candidateExercises: [
      { id: 'fedb:pushups', name: 'Pushups' },
      { id: 'fedb:chin-up', name: 'Chin-Up' },
    ],
  };

  const planningBrief: PlanningBrief = {
    provider: 'openai',
    planningDateLocal: '2026-04-15',
    focusMode: 'smart',
    resolvedFocus: 'Upper Body & Core',
    durationMinutes: 30,
    availableEquipment: ['Dumbbells'],
    energy: 'moderate',
    loadCeiling: 'low',
    unknowns: [],
    disallowedStressors: ['lower_body_overload'],
    recentStressorsToAvoid: ['lower_body'],
    eventProtection: {
      kind: 'run',
      title: '10K Tune-Up',
      localDate: '2026-04-16',
      reason: 'Protect freshness for the upcoming event.',
    },
    blockIntents: [
      {
        key: 'main',
        title: 'Main Block',
        focus: 'Upper Body & Core',
        durationMinutes: 30,
        objective: 'Protect lower-body freshness.',
        candidateFocusTags: ['upper_body', 'core'],
      },
    ],
    variationMode: 'different-exercises',
    fallbackMode: 'strict-library',
    fallbackReasons: [],
    regeneration: {
      isRegeneration: true,
      mode: 'stateless',
      feedback: ['different-exercises'],
      baselineWorkoutId: 'plan-1',
      baselineExerciseCount: 4,
    },
    stagedPlanning: {
      mode: 'llm-assisted',
      shouldRun: true,
      reasons: ['smart-focus'],
    },
  };

  const stageOneArtifact: StageOnePlannerArtifact = {
    mode: 'llm-assisted',
    confidence: 'high',
    planningIntent:
      'Protect lower-body freshness and bias toward upper-body work.',
    resolvedFocus: 'Upper Body & Core',
    protectStressors: ['lower_body_overload'],
    avoidStressors: ['lower_body_fatigue'],
    styleBiases: ['athletic'],
    loadBias: 'low',
    noveltyTarget: 'high',
    rerankHints: ['prefer upper-body compound lifts'],
    candidateInstructions: ['keep lower-body fatigue minimal'],
  };

  describe('auto-focus handling', () => {
    it('does not include "Smart" focus in structured changes', () => {
      const request: GenerationRequest = {
        ...baseRequest,
        focus: 'Smart',
      };

      const message = buildRegenerationMessage(request);

      expect(message).not.toContain('focus: Smart');
      expect(message).not.toContain('focus: auto');
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
      expect(message).not.toContain('focus: auto');
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
    it('treats request with only auto-focus as structured when combined with notes', () => {
      const request: GenerationRequest = {
        focus: 'Smart',
        notes: 'Make it harder',
      };

      const message = buildRegenerationMessage(request);

      // When structured, notes get the "prioritize" treatment
      expect(message).toContain('Prioritize the user instructions');
      expect(message).not.toContain('single source of truth');
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
      const feedback: RegenerationFeedback[] = [
        'too-hard',
        'different-exercises',
      ];

      const message = buildRegenerationMessage(baseRequest, feedback);

      expect(message).toContain('too hard/intense');
      expect(message).toContain('different exercises');
    });

    it('includes planning brief and baseline workout guidance', () => {
      const message = buildRegenerationMessage(
        {
          ...baseRequest,
          baselineWorkout: {
            id: 'plan-1',
            focus: 'Lower Body',
            durationMinutes: 30,
            equipment: ['Dumbbells'],
            source: 'ai',
            energy: 'moderate',
            summary: 'Baseline summary',
            blocks: [
              {
                id: 'block-1',
                title: 'Main',
                durationMinutes: 30,
                focus: 'Lower Body',
                exercises: [
                  {
                    id: 'exercise-1',
                    name: 'Goblet Squat',
                    prescription: '3x10',
                    detail: null,
                  },
                ],
              },
            ],
          },
        },
        ['different-exercises'],
        candidatePool,
        planningBrief,
        stageOneArtifact,
      );

      expect(message).toContain('Resolved session intent: Upper Body & Core');
      expect(message).toContain('Avoid these stressors: lower_body_overload');
      expect(message).toContain('Baseline exercises: Goblet Squat');
      expect(message).toContain('Planner intent: Protect lower-body freshness');
      expect(message).toContain('Novelty target: high');
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
        energy: 'intense',
      };

      const message = buildRegenerationMessage(request);

      expect(message).toContain('energy level: intense');
    });
  });

  describe('candidate pool prompt data', () => {
    it('formats candidate pool prompt payload for initial generation', () => {
      expect(buildCandidatePoolPromptData(candidatePool)).toEqual(
        expect.objectContaining({
          libraryVersion: 'test-library',
          totalEligibleCount: 2,
          searchText: 'upper body strength',
          exercises: [
            { id: 'fedb:pushups', name: 'Pushups' },
            { id: 'fedb:chin-up', name: 'Chin-Up' },
          ],
        }),
      );
    });

    it('includes candidate pool guidance in regeneration messages', () => {
      const message = buildRegenerationMessage(
        baseRequest,
        undefined,
        candidatePool,
      );

      expect(message).toContain('Candidate pool from exercise library');
      expect(message).toContain('Pushups');
      expect(message).toContain('Chin-Up');
      expect(message).toContain('Avoid repeating baseline exercises');
    });
  });

  describe('planning brief prompt data', () => {
    it('formats planning brief payload for provider prompts', () => {
      expect(buildPlanningBriefPromptData(planningBrief)).toEqual(
        expect.objectContaining({
          resolvedFocus: 'Upper Body & Core',
          loadCeiling: 'low',
          stagedPlanning: expect.objectContaining({
            mode: 'llm-assisted',
          }),
          blockIntents: [
            expect.objectContaining({ focus: 'Upper Body & Core' }),
          ],
        }),
      );
    });

    it('formats stage-one planner request payload', () => {
      expect(
        buildStageOnePlannerRequestPayload(
          baseRequest,
          planningBrief,
          candidatePool,
        ),
      ).toEqual(
        expect.objectContaining({
          planningBrief: expect.objectContaining({
            resolvedFocus: 'Upper Body & Core',
          }),
          candidatePool: expect.objectContaining({
            libraryVersion: 'test-library',
          }),
        }),
      );
    });

    it('formats stage-one planner artifact prompt data', () => {
      expect(buildStageOnePlannerArtifactPromptData(stageOneArtifact)).toEqual(
        expect.objectContaining({
          confidence: 'high',
          noveltyTarget: 'high',
          resolvedFocus: 'Upper Body & Core',
        }),
      );
    });
  });
});
