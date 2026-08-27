import {
  CLASSIC_STRENGTH_GUIDANCE,
  GYM_STRENGTH_EQUIPMENT_GUIDANCE,
  buildCandidatePoolPromptData,
  INITIAL_GENERATION_INSTRUCTIONS,
  buildPlanningBriefPromptData,
  buildStageOnePlannerArtifactPromptData,
  buildStageOnePlannerRequestPayload,
  buildRegenerationMessage,
} from './prompts';
import type {
  ExerciseCandidatePool,
  PlanningBrief,
  StageOnePlannerArtifact,
} from '@leveza/server-core';
import type {
  GenerationRequest,
  RegenerationFeedback,
} from '@leveza/shared';

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
      {
        id: 'fedb:pushups',
        name: 'Pushups',
        requiredEquipment: ['bodyweight'],
      },
      {
        id: 'fedb:chin-up',
        name: 'Chin-Up',
        requiredEquipment: ['bodyweight', 'pull_up_bar'],
      },
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
    userConstraints: {
      injuries: ['left shoulder irritation'],
      avoid: ['overhead pressing'],
    },
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
    styleBias: 'strength',
    primaryGoal: 'build strength',
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
    selectionIntent: 'balanced_upper',
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
        stageOneArtifact
      );

      expect(message).toContain('Resolved session intent: Upper Body & Core');
      expect(message).toContain(
        'Hard user avoid list: overhead pressing. Treat these as hard constraints and do not include them.'
      );
      expect(message).toContain(
        'Hard user injury context: left shoulder irritation. Treat these as hard constraints and keep the workout safely away from aggravating patterns.'
      );
      expect(message).toContain(
        "Planner-generated avoidances: lower_body_overload. Use these as lower-confidence guidance unless they conflict with the user's explicit constraints."
      );
      expect(message).toContain('Baseline exercises: Goblet Squat');
      expect(message).toContain('Planner intent: Protect lower-body freshness');
      expect(message).toContain('Novelty target: high');
      expect(message).toContain(
        'When viable alternatives exist, make meaningful exercise changes that are proportional to the feedback.'
      );
      expect(message).toContain(
        'If only one or two baseline exercises are the problem, it is acceptable to replace only those exercises and keep the rest of the workout aligned to the original intent.'
      );
      expect(message).toContain(
        'Do not just reshuffle the exact same full exercise list into new blocks or lightly rewrite prescriptions/details when the user is asking for a real change.'
      );
      expect(message).toContain(
        'Prefer unused exercises from the candidate pool before falling back to any baseline exercise.'
      );
      expect(message).toContain(CLASSIC_STRENGTH_GUIDANCE);
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
            {
              id: 'fedb:pushups',
              name: 'Pushups',
              requiredEquipment: ['bodyweight'],
            },
            {
              id: 'fedb:chin-up',
              name: 'Chin-Up',
              requiredEquipment: ['bodyweight', 'pull_up_bar'],
            },
          ],
        })
      );
      expect(
        buildCandidatePoolPromptData(candidatePool)?.instructions
      ).toContain('Candidate buckets are available roles');
      expect(
        buildCandidatePoolPromptData(candidatePool)?.instructions
      ).toContain('buckets are not unconditional requirements');
    });

    it('formats grouped candidate buckets with compact tags', () => {
      const groupedPool: ExerciseCandidatePool = {
        ...candidatePool,
        candidateExercises: [
          {
            id: 'fedb:pushups',
            name: 'Pushups',
            requiredEquipment: ['bodyweight'],
            focusTags: ['upper_body'],
            movementTags: ['push'],
            loadLevel: 'moderate',
          },
          {
            id: 'fedb:row',
            name: 'Inverted Row',
            requiredEquipment: ['squat_rack'],
            focusTags: ['upper_body', 'middle_back'],
            movementTags: ['pull', 'row'],
            loadLevel: 'moderate',
          },
        ],
        candidateBuckets: [
          {
            key: 'main:upper_push',
            title: 'Main Block - Upper Push',
            quota: 26,
            availableCount: 40,
            selectedCount: 1,
            shortfall: 0,
            candidateExercises: [
              {
                id: 'fedb:pushups',
                name: 'Pushups',
                requiredEquipment: ['bodyweight'],
                focusTags: ['upper_body'],
                movementTags: ['push'],
                loadLevel: 'moderate',
              },
            ],
          },
          {
            key: 'main:upper_back_pull',
            title: 'Main Block - Upper Back Pull',
            quota: 25,
            availableCount: 1,
            selectedCount: 1,
            shortfall: 24,
            candidateExercises: [
              {
                id: 'fedb:row',
                name: 'Inverted Row',
                requiredEquipment: ['squat_rack'],
                focusTags: ['upper_body', 'middle_back'],
                movementTags: ['pull', 'row'],
                loadLevel: 'moderate',
              },
            ],
          },
        ],
      };

      const promptData = buildCandidatePoolPromptData(groupedPool);

      expect(promptData).toEqual(
        expect.objectContaining({
          buckets: [
            expect.objectContaining({
              key: 'main:upper_push',
              exercises: [
                expect.objectContaining({
                  name: 'Pushups',
                  movementTags: ['push'],
                  focusTags: ['upper_body'],
                }),
              ],
            }),
            expect.objectContaining({
              key: 'main:upper_back_pull',
              shortfall: 24,
              exercises: [
                expect.objectContaining({
                  name: 'Inverted Row',
                  movementTags: ['pull', 'row'],
                  focusTags: ['upper_body', 'middle_back'],
                }),
              ],
            }),
          ],
        })
      );
      expect(promptData).not.toHaveProperty('exercises');

      const serializedBuckets = JSON.stringify(promptData?.buckets);
      expect(serializedBuckets.match(/fedb:pushups/g)).toHaveLength(1);
      expect(serializedBuckets.match(/fedb:row/g)).toHaveLength(1);
    });

    it('includes classic strength guidance in initial instructions', () => {
      expect(INITIAL_GENERATION_INSTRUCTIONS).toContain(
        CLASSIC_STRENGTH_GUIDANCE
      );
      expect(INITIAL_GENERATION_INSTRUCTIONS).toContain(
        GYM_STRENGTH_EQUIPMENT_GUIDANCE
      );
      expect(INITIAL_GENERATION_INSTRUCTIONS).toContain(
        'preserve stable and user-locked current assignments'
      );
      expect(INITIAL_GENERATION_INSTRUCTIONS).toContain(
        'allow coach-rotatable slots to vary'
      );
    });

    it('includes candidate pool guidance in regeneration messages', () => {
      const message = buildRegenerationMessage(
        baseRequest,
        undefined,
        candidatePool
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
          userConstraints: expect.objectContaining({
            injuries: ['left shoulder irritation'],
            avoid: ['overhead pressing'],
          }),
          styleBias: 'strength',
          primaryGoal: 'build strength',
          plannerAvoidances: ['lower_body_overload'],
          stagedPlanning: expect.objectContaining({
            mode: 'llm-assisted',
          }),
          blockIntents: [
            expect.objectContaining({ focus: 'Upper Body & Core' }),
          ],
        })
      );
    });

    it('formats stage-one planner request payload', () => {
      expect(
        buildStageOnePlannerRequestPayload(
          baseRequest,
          planningBrief,
          candidatePool
        )
      ).toEqual(
        expect.objectContaining({
          planningBrief: expect.objectContaining({
            resolvedFocus: 'Upper Body & Core',
          }),
          candidatePool: expect.objectContaining({
            libraryVersion: 'test-library',
          }),
        })
      );
    });

    it('includes adaptive plan intent in planning brief and stage-one payloads', () => {
      const request: GenerationRequest = {
        focus: 'Pull',
        adaptivePlanIntent: {
          planId: 'plan-ppl',
          recommendationId: 'rec-pull-cardio',
          sourceTemplateId: 'ppl-conditioning',
          primaryBlock: {
            blockId: 'pull',
            label: 'Pull',
            category: 'strength',
            targetDurationMinutes: 50,
            stressTags: ['upper-body'],
          },
          addOnBlocks: [
            {
              blockId: 'easy-cardio',
              label: 'Easy Cardio',
              category: 'cardio',
              targetDurationMinutes: 25,
              stressTags: ['low-impact'],
            },
          ],
          targetRangeContext: [],
          rationale: [
            {
              code: 'target-gap',
              message: 'Cardio is below target.',
            },
          ],
          repairRationale: [],
          projectionStatus: 'projected',
          exerciseSlotPolicy: {
            slots: [
              {
                id: 'pull-main-pull',
                label: 'Pull main lift',
                sourceBlockId: 'pull',
                stabilityPolicy: 'stable',
                targetExerciseCount: 1,
                movementTags: ['row', 'vertical-pull'],
                focusTags: ['pull', 'upper-body'],
                preferredExerciseIds: [],
                eligibleExerciseIds: [],
                requiredEquipment: [],
              },
              {
                id: 'pull-accessory',
                label: 'Pull accessory',
                sourceBlockId: 'pull',
                stabilityPolicy: 'coach-rotatable',
                targetExerciseCount: 1,
                movementTags: ['biceps', 'rear-delts'],
                focusTags: ['pull', 'accessory'],
                preferredExerciseIds: [],
                eligibleExerciseIds: [],
                requiredEquipment: [],
              },
            ],
            currentAssignments: [
              {
                slotId: 'pull-main-pull',
                exerciseName: 'Pull-Up',
                source: 'generated',
                locked: false,
              },
              {
                slotId: 'pull-main-pull',
                exerciseName: 'Chin-Up',
                source: 'generated',
                locked: false,
              },
              {
                slotId: 'pull-accessory',
                exerciseName: 'Hammer Curl',
                source: 'generated',
                locked: false,
              },
            ],
            overrideReasons: [],
          },
        },
      };
      const adaptiveBrief: PlanningBrief = {
        ...planningBrief,
        focusMode: 'adaptive-plan',
        resolvedFocus: 'Pull + Easy Cardio',
        adaptivePlanIntent: request.adaptivePlanIntent,
        exerciseSlotPolicy: request.adaptivePlanIntent?.exerciseSlotPolicy,
        blockIntents: [
          {
            key: 'adaptive-primary',
            title: 'Adaptive Primary Block',
            focus: 'Pull',
            durationMinutes: 50,
            objective: 'Train the requested emphasis.',
            candidateFocusTags: ['strength', 'pull', 'upper-body'],
          },
          {
            key: 'adaptive-addon-1',
            title: 'Adaptive Add-on Block',
            focus: 'Easy Cardio',
            durationMinutes: 25,
            objective: 'Train the requested emphasis.',
            candidateFocusTags: ['cardio', 'low-impact'],
          },
        ],
      };

      expect(buildPlanningBriefPromptData(adaptiveBrief)).toEqual(
        expect.objectContaining({
          adaptivePlanIntent: expect.objectContaining({ planId: 'plan-ppl' }),
          exerciseSlotPolicy: expect.objectContaining({
            slots: expect.arrayContaining([
              expect.objectContaining({
                id: 'pull-main-pull',
                stabilityPolicy: 'stable',
              }),
              expect.objectContaining({
                id: 'pull-accessory',
                stabilityPolicy: 'coach-rotatable',
              }),
            ]),
          }),
        })
      );
      expect(
        buildStageOnePlannerRequestPayload(request, adaptiveBrief).planningBrief
      ).toEqual(
        expect.objectContaining({
          exerciseSlotPolicy: expect.objectContaining({
            currentAssignments: expect.arrayContaining([
              expect.objectContaining({ exerciseName: 'Pull-Up' }),
            ]),
          }),
        })
      );
      expect(buildStageOnePlannerRequestPayload(request).request).toEqual(
        expect.objectContaining({
          adaptivePlanIntent: expect.objectContaining({ planId: 'plan-ppl' }),
        })
      );
      expect(
        buildRegenerationMessage(request, undefined, undefined, adaptiveBrief)
      ).toContain(
        'Adaptive plan intent: primary Pull; add-ons Easy Cardio; rationale Cardio is below target.'
      );
      expect(
        buildRegenerationMessage(request, undefined, undefined, adaptiveBrief)
      ).toContain(
        'Exercise slot policy: Pull main lift (stable, Pull-Up, Chin-Up): preserve if viable; Pull accessory (coach-rotatable, Hammer Curl): may rotate.'
      );
    });

    it('does not surface overridden adaptive intent as prompt guidance', () => {
      const adaptiveBrief: PlanningBrief = {
        ...planningBrief,
        focusMode: 'adaptive-plan',
        resolvedFocus: 'Upper Body & Core',
        adaptivePlanIntent: {
          planId: 'plan-ppl',
          recommendationId: 'rec-legs',
          sourceTemplateId: 'ppl-conditioning',
          primaryBlock: {
            blockId: 'legs',
            label: 'Legs',
            category: 'strength',
            targetDurationMinutes: 50,
            stressTags: ['lower-body', 'heavy'],
          },
          addOnBlocks: [],
          targetRangeContext: [],
          rationale: [],
          repairRationale: [],
          projectionStatus: 'projected',
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
      };

      expect(buildPlanningBriefPromptData(adaptiveBrief)).toEqual(
        expect.objectContaining({ adaptivePlanIntent: undefined })
      );
      expect(
        buildRegenerationMessage(
          baseRequest,
          undefined,
          undefined,
          adaptiveBrief
        )
      ).not.toContain('Adaptive plan intent: primary Legs');
    });

    it('formats stage-one planner artifact prompt data', () => {
      expect(buildStageOnePlannerArtifactPromptData(stageOneArtifact)).toEqual(
        expect.objectContaining({
          confidence: 'high',
          noveltyTarget: 'high',
          selectionIntent: 'balanced_upper',
          resolvedFocus: 'Upper Body & Core',
        })
      );
    });
  });
});
