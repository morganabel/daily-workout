import { v7 as uuidv7 } from 'uuid';
import type { LlmTodayPlan, TodayPlan } from '@workout-agent/shared';

/**
 * Checks if a focus value represents an "auto" or "smart" selection,
 * meaning the AI should choose the most appropriate focus based on context.
 */
export const isAutoFocus = (focus?: string): boolean =>
  Boolean(focus && ['smart', 'auto'].includes(focus.trim().toLowerCase()));

export function attachGeneratedIds(plan: LlmTodayPlan): TodayPlan {
  return {
    id: uuidv7(),
    ...plan,
    blocks: plan.blocks.map((block) => ({
      id: uuidv7(),
      ...block,
      exercises: block.exercises.map((exercise) => ({
        id: uuidv7(),
        ...exercise,
      })),
    })),
  };
}
