jest.mock('uuid', () => ({
  v7: jest.fn(() => 'mock-uuid'),
}));

import {
  transformLlmResponse,
  getDefaultSchemaVersion,
  selectSchemaVersion,
} from './llm-transformer';
import {
  llmTodayPlanFlatSchema,
  type LlmTodayPlan,
  type LlmTodayPlanFlat,
} from '@workout-agent/shared';
import * as z from 'zod';

const resolveJsonSchemaRef = (ref: string, root: unknown): unknown => {
  if (!ref.startsWith('#/')) {
    return undefined;
  }
  const path = ref.slice(2).split('/');
  let current: unknown = root;
  for (const segment of path) {
    if (!current || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
};

const computeSchemaDepth = (schema: unknown, root: unknown): number => {
  if (!schema || typeof schema !== 'object') {
    return 0;
  }

  const node = schema as Record<string, unknown>;
  if (typeof node.$ref === 'string') {
    const resolved = resolveJsonSchemaRef(node.$ref, root);
    return resolved ? computeSchemaDepth(resolved, root) : 0;
  }

  let maxChild = 0;
  const consider = (child: unknown) => {
    maxChild = Math.max(maxChild, computeSchemaDepth(child, root));
  };

  for (const key of ['anyOf', 'oneOf', 'allOf'] as const) {
    const variants = node[key];
    if (Array.isArray(variants)) {
      variants.forEach(consider);
    }
  }

  if (node.type === 'object') {
    const properties = node.properties as Record<string, unknown> | undefined;
    if (properties) {
      Object.values(properties).forEach(consider);
    }
    if (node.additionalProperties && typeof node.additionalProperties === 'object') {
      consider(node.additionalProperties);
    }
    return Math.max(1, 1 + maxChild);
  }

  if (node.type === 'array') {
    if (node.items) {
      consider(node.items);
    }
    return Math.max(1, 1 + maxChild);
  }

  return maxChild;
};

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

        // Input should not have IDs (LLM schema)
        expect((validLlmPlan as unknown as { id?: string }).id).toBeUndefined();
        validLlmPlan.blocks.forEach((block) => {
          expect((block as unknown as { id?: string }).id).toBeUndefined();
          block.exercises.forEach((exercise) => {
            expect((exercise as unknown as { id?: string }).id).toBeUndefined();
          });
        });

        // Output should have IDs
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
        expect(result.plan.id).toBeDefined();
        expect(typeof result.plan.id).toBe('string');

        // Check that all blocks have IDs
        result.plan.blocks.forEach((block) => {
          expect(block.id).toBeDefined();
          expect(typeof block.id).toBe('string');

          // Check that all exercises have IDs
          block.exercises.forEach((exercise) => {
            expect(exercise.id).toBeDefined();
            expect(typeof exercise.id).toBe('string');
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
      it('should use v1-current when no version specified (defaults to v1-current)', () => {
        const result = transformLlmResponse(validLlmPlan);

        expect(result.success).toBe(true);
        if (!result.success) return;

        // transformLlmResponse defaults to v1-current when no schemaVersion is provided
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
    it('should prefer v2-flat when both schemas are available (smaller estimated size)', () => {
      const version = getDefaultSchemaVersion({
        supportedSchemas: ['v1-current', 'v2-flat'],
      });
      expect(version).toBe('v2-flat');
    });

    it('should return v1-current when only v1-current is supported', () => {
      const version = getDefaultSchemaVersion({
        supportedSchemas: ['v1-current'],
      });
      expect(version).toBe('v1-current');
    });

    it('should respect explicit override', () => {
      const version = getDefaultSchemaVersion({
        override: 'v1-current',
        supportedSchemas: ['v1-current', 'v2-flat'],
      });
      expect(version).toBe('v1-current');
    });
  });

  describe('v2-flat schema transformation', () => {
    const validFlatPlan: LlmTodayPlanFlat = {
      focus: 'Upper Body Strength',
      durationMinutes: 30,
      equipment: ['Dumbbells'],
      source: 'ai',
      energy: 'moderate',
      summary: 'Sample plan',
      blocks: [
        { title: 'Warm-up', durationMinutes: 5, focus: 'Prep' },
        { title: 'Main Set', durationMinutes: 20, focus: 'Strength' },
      ],
      exercises: [
        {
          blockIndex: 0,
          order: 0,
          name: 'Jumping Jacks',
          prescription: '2 x 30s',
          detail: null,
        },
        {
          blockIndex: 1,
          order: 0,
          name: 'DB Press',
          prescription: '3 x 10',
          detail: 'Controlled tempo',
        },
      ],
    };

    describe('Scenario: Flat schema rebuilds ordered exercises', () => {
      it('should transform flat schema to canonical TodayPlan with correct ordering', () => {
        const result = transformLlmResponse(validFlatPlan, {
          schemaVersion: 'v2-flat',
        });

        expect(result.success).toBe(true);
        if (!result.success) return;

        // Check plan-level fields
        expect(result.plan.focus).toBe(validFlatPlan.focus);
        expect(result.plan.durationMinutes).toBe(validFlatPlan.durationMinutes);
        expect(result.plan.equipment).toEqual(validFlatPlan.equipment);
        expect(result.plan.source).toBe(validFlatPlan.source);
        expect(result.plan.energy).toBe(validFlatPlan.energy);
        expect(result.plan.summary).toBe(validFlatPlan.summary);

        // Check blocks are correctly structured
        expect(result.plan.blocks).toHaveLength(2);
        expect(result.plan.blocks[0].title).toBe('Warm-up');
        expect(result.plan.blocks[0].exercises).toHaveLength(1);
        expect(result.plan.blocks[0].exercises[0].name).toBe('Jumping Jacks');

        expect(result.plan.blocks[1].title).toBe('Main Set');
        expect(result.plan.blocks[1].exercises).toHaveLength(1);
        expect(result.plan.blocks[1].exercises[0].name).toBe('DB Press');
        expect(result.plan.blocks[1].exercises[0].detail).toBe(
          'Controlled tempo',
        );

        // Check IDs are generated
        expect(result.plan.id).toBeDefined();
        result.plan.blocks.forEach((block) => {
          expect(block.id).toBeDefined();
          block.exercises.forEach((exercise) => {
            expect(exercise.id).toBeDefined();
          });
        });

        expect(result.schemaVersion).toBe('v2-flat');
      });

      it('should preserve exercise order within blocks', () => {
        const planWithMultipleExercises: LlmTodayPlanFlat = {
          ...validFlatPlan,
          blocks: [
            { title: 'Warm-up', durationMinutes: 5, focus: 'Prep' },
          ],
          exercises: [
            {
              blockIndex: 0,
              order: 1,
              name: 'Second Exercise',
              prescription: '10 reps',
              detail: null,
            },
            {
              blockIndex: 0,
              order: 0,
              name: 'First Exercise',
              prescription: '10 reps',
              detail: null,
            },
            {
              blockIndex: 0,
              order: 2,
              name: 'Third Exercise',
              prescription: '10 reps',
              detail: null,
            },
          ],
        };

        const result = transformLlmResponse(planWithMultipleExercises, {
          schemaVersion: 'v2-flat',
        });

        expect(result.success).toBe(true);
        if (!result.success) return;

        expect(result.plan.blocks[0].exercises).toHaveLength(3);
        expect(result.plan.blocks[0].exercises[0].name).toBe('First Exercise');
        expect(result.plan.blocks[0].exercises[1].name).toBe('Second Exercise');
        expect(result.plan.blocks[0].exercises[2].name).toBe('Third Exercise');
      });
    });

    describe('Scenario: Invalid block mapping fails transformation', () => {
      it('should fail when blockIndex is out of range', () => {
        const invalidPlan: LlmTodayPlanFlat = {
          ...validFlatPlan,
          exercises: [
            {
              blockIndex: 99, // Invalid: only 2 blocks (0, 1)
              order: 0,
              name: 'Invalid Exercise',
              prescription: '10 reps',
              detail: null,
            },
          ],
        };

        const result = transformLlmResponse(invalidPlan, {
          schemaVersion: 'v2-flat',
        });

        expect(result.success).toBe(false);
        if (result.success) return;

        expect(result.error.message).toContain('blockIndex');
        expect(result.error.message).toContain('99');
      });

      it('should fail when blockIndex is negative (schema validation)', () => {
        const invalidPlan: LlmTodayPlanFlat = {
          ...validFlatPlan,
          exercises: [
            {
              blockIndex: -1,
              order: 0,
              name: 'Invalid Exercise',
              prescription: '10 reps',
              detail: null,
            },
          ],
        };

        const result = transformLlmResponse(invalidPlan, {
          schemaVersion: 'v2-flat',
        });

        expect(result.success).toBe(false);
      });
    });

    describe('Scenario: Missing blocks fails transformation', () => {
      it('should fail when blocks array is empty', () => {
        const invalidPlan: LlmTodayPlanFlat = {
          ...validFlatPlan,
          blocks: [],
        };

        const result = transformLlmResponse(invalidPlan, {
          schemaVersion: 'v2-flat',
        });

        expect(result.success).toBe(false);
        if (result.success) return;

        expect(result.error.message).toContain('blocks');
      });
    });

    describe('Scenario: Duplicate order per block fails transformation', () => {
      it('should fail when two exercises share the same order for the same blockIndex', () => {
        const invalidPlan: LlmTodayPlanFlat = {
          ...validFlatPlan,
          exercises: [
            {
              blockIndex: 0,
              order: 0,
              name: 'First Exercise',
              prescription: '10 reps',
              detail: null,
            },
            {
              blockIndex: 0,
              order: 0, // Duplicate order
              name: 'Second Exercise',
              prescription: '10 reps',
              detail: null,
            },
          ],
        };

        const result = transformLlmResponse(invalidPlan, {
          schemaVersion: 'v2-flat',
        });

        expect(result.success).toBe(false);
        if (result.success) return;

        expect(result.error.message).toContain('Duplicate order');
        expect(result.error.message).toContain('0');
      });
    });

    describe('Scenario: Block with no exercises fails transformation', () => {
      it('should fail when a block has no exercises', () => {
        const invalidPlan: LlmTodayPlanFlat = {
          ...validFlatPlan,
          exercises: [
            // Only exercises for block 1, block 0 has none
            {
              blockIndex: 1,
              order: 0,
              name: 'Exercise',
              prescription: '10 reps',
              detail: null,
            },
          ],
        };

        const result = transformLlmResponse(invalidPlan, {
          schemaVersion: 'v2-flat',
        });

        expect(result.success).toBe(false);
        if (result.success) return;

        expect(result.error.message).toContain('no exercises');
      });
    });
  });

  describe('selectSchemaVersion', () => {
    it('should prefer v2-flat when it has the smaller estimated size', () => {
      const version = selectSchemaVersion({
        supportedSchemas: ['v1-current', 'v2-flat'],
      });
      expect(version).toBe('v2-flat');
    });

    it('should use override when provided', () => {
      const version = selectSchemaVersion({
        override: 'v1-current',
        supportedSchemas: ['v1-current', 'v2-flat'],
      });
      expect(version).toBe('v1-current');
    });

    it('should use single supported schema when only one is available', () => {
      const version = selectSchemaVersion({
        supportedSchemas: ['v1-current'],
      });
      expect(version).toBe('v1-current');
    });
  });

  describe('schema depth', () => {
    it('should keep llmTodayPlanFlatSchema depth <= 3', () => {
      const jsonSchema = z.toJSONSchema(llmTodayPlanFlatSchema);
      const depth = computeSchemaDepth(jsonSchema, jsonSchema);
      expect(depth).toBeLessThanOrEqual(3);
    });
  });
});
