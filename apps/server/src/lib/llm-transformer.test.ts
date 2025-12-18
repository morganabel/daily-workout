jest.mock('uuid', () => ({
  v7: jest.fn(() => 'mock-uuid'),
}));

import {
  transformLlmResponse,
  getDefaultSchemaVersion,
  type LlmSchemaVersion,
} from './llm-transformer';
import type { LlmTodayPlan } from '@workout-agent/shared';

describe('llm-transformer', () => {
  describe('transformLlmResponse', () => {
    const validLlmPlan: LlmTodayPlan = {
      focus: 'Upper Body Strength',
      durationMinutes: 45,
      equipment: ['Dumbbells', 'Bench'],
      source: 'ai',
      energy: 'moderate',
      summary: 'A comprehensive upper body workout focusing on push movements.',
      blocks: [
        {
          title: 'Warm-up',
          durationMinutes: 5,
          focus: 'Mobility',
          exercises: [
            {
              name: 'Arm Circles',
              prescription: '2 x 10 each direction',
              detail: 'Keep shoulders relaxed',
            },
          ],
        },
        {
          title: 'Main Set',
          durationMinutes: 35,
          focus: 'Push Strength',
          exercises: [
            {
              name: 'Dumbbell Bench Press',
              prescription: '4 x 8-10',
              detail: 'Control the descent, explosive press',
            },
            {
              name: 'Overhead Press',
              prescription: '3 x 10',
              detail: 'Keep core tight',
            },
          ],
        },
        {
          title: 'Cool-down',
          durationMinutes: 5,
          focus: 'Recovery',
          exercises: [
            {
              name: 'Shoulder Stretch',
              prescription: '30 seconds each side',
              detail: null,
            },
          ],
        },
      ],
    };

    describe('Scenario: Canonical response preserved', () => {
      it('should transform a valid LlmTodayPlan to TodayPlan with IDs', () => {
        const result = transformLlmResponse(validLlmPlan, {
          schemaVersion: 'v1-current',
        });

        expect(result.success).toBe(true);
        if (!result.success) return;

        // Check that plan has an ID
        expect(result.plan.id).toBeDefined();
        expect(typeof result.plan.id).toBe('string');

        // Check that all original fields are preserved
        expect(result.plan.focus).toBe(validLlmPlan.focus);
        expect(result.plan.durationMinutes).toBe(validLlmPlan.durationMinutes);
        expect(result.plan.equipment).toEqual(validLlmPlan.equipment);
        expect(result.plan.source).toBe(validLlmPlan.source);
        expect(result.plan.energy).toBe(validLlmPlan.energy);
        expect(result.plan.summary).toBe(validLlmPlan.summary);

        // Check that blocks have IDs
        expect(result.plan.blocks).toHaveLength(3);
        result.plan.blocks.forEach((block, idx) => {
          expect(block.id).toBeDefined();
          expect(typeof block.id).toBe('string');
          expect(block.title).toBe(validLlmPlan.blocks[idx].title);
          expect(block.durationMinutes).toBe(
            validLlmPlan.blocks[idx].durationMinutes
          );
          expect(block.focus).toBe(validLlmPlan.blocks[idx].focus);

          // Check that exercises have IDs
          block.exercises.forEach((exercise, exIdx) => {
            expect(exercise.id).toBeDefined();
            expect(typeof exercise.id).toBe('string');
            expect(exercise.name).toBe(
              validLlmPlan.blocks[idx].exercises[exIdx].name
            );
            expect(exercise.prescription).toBe(
              validLlmPlan.blocks[idx].exercises[exIdx].prescription
            );
            expect(exercise.detail).toBe(
              validLlmPlan.blocks[idx].exercises[exIdx].detail
            );
          });
        });

        // Check that schema version was recorded
        expect(result.schemaVersion).toBe('v1-current');
      });

      it('should generate IDs for plan, blocks, and exercises', () => {
        const result = transformLlmResponse(validLlmPlan);

        expect(result.success).toBe(true);
        if (!result.success) return;

        // Check that plan has ID
        expect(result.plan.id).toBe('mock-uuid');

        // Check that all blocks have IDs
        result.plan.blocks.forEach((block) => {
          expect(block.id).toBe('mock-uuid');

          // Check that all exercises have IDs
          block.exercises.forEach((exercise) => {
            expect(exercise.id).toBe('mock-uuid');
          });
        });

        // Verify the structure is complete
        expect(result.plan.blocks).toHaveLength(3);
        expect(result.plan.blocks[0].exercises).toHaveLength(1);
        expect(result.plan.blocks[1].exercises).toHaveLength(2);
        expect(result.plan.blocks[2].exercises).toHaveLength(1);
      });
    });

    describe('Scenario: Identity path for current schema', () => {
      it('should validate and pass through a valid response unchanged', () => {
        const result = transformLlmResponse(validLlmPlan, {
          schemaVersion: 'v1-current',
        });

        expect(result.success).toBe(true);
        if (!result.success) return;

        // Core fields should be byte-for-byte identical (except IDs)
        expect(result.plan.focus).toBe(validLlmPlan.focus);
        expect(result.plan.durationMinutes).toBe(validLlmPlan.durationMinutes);
        expect(result.plan.equipment).toEqual(validLlmPlan.equipment);
        expect(result.plan.source).toBe(validLlmPlan.source);
        expect(result.plan.energy).toBe(validLlmPlan.energy);
        expect(result.plan.summary).toBe(validLlmPlan.summary);
        expect(result.plan.blocks.length).toBe(validLlmPlan.blocks.length);
      });
    });

    describe('Scenario: Versioned schema selection', () => {
      it('should use v1-current when no version specified', () => {
        const result = transformLlmResponse(validLlmPlan);

        expect(result.success).toBe(true);
        if (!result.success) return;

        expect(result.schemaVersion).toBe('v1-current');
      });

      it('should use explicitly specified schema version', () => {
        const result = transformLlmResponse(validLlmPlan, {
          schemaVersion: 'v1-current',
        });

        expect(result.success).toBe(true);
        if (!result.success) return;

        expect(result.schemaVersion).toBe('v1-current');
      });

      it('should record which version was used', () => {
        const result = transformLlmResponse(validLlmPlan, {
          schemaVersion: 'v1-current',
        });

        expect(result.success).toBe(true);
        if (!result.success) return;

        expect(result.schemaVersion).toBeDefined();
        expect(typeof result.schemaVersion).toBe('string');
      });
    });

    describe('Scenario: Transformation failure handling', () => {
      it('should fail when required fields are missing', () => {
        const invalidPlan = {
          focus: 'Test',
          // Missing required fields
        };

        const result = transformLlmResponse(invalidPlan);

        expect(result.success).toBe(false);
        if (result.success) return;

        expect(result.error).toBeDefined();
        expect(result.error.message).toBeDefined();
        expect(result.schemaVersion).toBe('v1-current');
      });

      it('should fail when blocks are empty', () => {
        const invalidPlan: Partial<LlmTodayPlan> = {
          ...validLlmPlan,
          blocks: [],
        };

        const result = transformLlmResponse(invalidPlan);

        expect(result.success).toBe(false);
        if (result.success) return;

        expect(result.error).toBeDefined();
        expect(result.error.message).toContain('blocks');
      });

      it('should fail when block exercises are empty', () => {
        const invalidPlan: LlmTodayPlan = {
          ...validLlmPlan,
          blocks: [
            {
              title: 'Empty Block',
              durationMinutes: 10,
              focus: 'Nothing',
              exercises: [],
            },
          ],
        };

        const result = transformLlmResponse(invalidPlan);

        expect(result.success).toBe(false);
        if (result.success) return;

        expect(result.error).toBeDefined();
        expect(result.error.message).toContain('exercises');
      });

      it('should fail when energy level is invalid', () => {
        const invalidPlan = {
          ...validLlmPlan,
          energy: 'super-hard', // Invalid energy level
        };

        const result = transformLlmResponse(invalidPlan);

        expect(result.success).toBe(false);
        if (result.success) return;

        expect(result.error).toBeDefined();
        expect(result.error.message).toBeDefined();
      });

      it('should fail when durationMinutes is negative', () => {
        const invalidPlan = {
          ...validLlmPlan,
          durationMinutes: -10,
        };

        const result = transformLlmResponse(invalidPlan);

        expect(result.success).toBe(false);
        if (result.success) return;

        expect(result.error).toBeDefined();
      });

      it('should return Error object with message', () => {
        const result = transformLlmResponse({});

        expect(result.success).toBe(false);
        if (result.success) return;

        expect(result.error).toBeInstanceOf(Error);
        expect(result.error.message).toBeTruthy();
      });
    });
  });

  describe('getDefaultSchemaVersion', () => {
    it('should return v1-current as default', () => {
      const version = getDefaultSchemaVersion();
      expect(version).toBe('v1-current');
    });
  });
});
