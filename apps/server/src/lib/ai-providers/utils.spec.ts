import { attachGeneratedIds, isAutoFocus } from './utils';
import type { LlmTodayPlan } from '@workout-agent/shared';

describe('isAutoFocus', () => {
  it('returns true for "smart" (case-insensitive)', () => {
    expect(isAutoFocus('smart')).toBe(true);
    expect(isAutoFocus('Smart')).toBe(true);
    expect(isAutoFocus('SMART')).toBe(true);
  });

  it('returns true for "auto" (case-insensitive)', () => {
    expect(isAutoFocus('auto')).toBe(true);
    expect(isAutoFocus('Auto')).toBe(true);
    expect(isAutoFocus('AUTO')).toBe(true);
  });

  it('handles whitespace around the value', () => {
    expect(isAutoFocus('  smart  ')).toBe(true);
    expect(isAutoFocus(' auto ')).toBe(true);
  });

  it('returns false for specific focus values', () => {
    expect(isAutoFocus('Push')).toBe(false);
    expect(isAutoFocus('Pull')).toBe(false);
    expect(isAutoFocus('Legs')).toBe(false);
    expect(isAutoFocus('Core')).toBe(false);
    expect(isAutoFocus('Cardio')).toBe(false);
  });

  it('returns false for undefined or empty values', () => {
    expect(isAutoFocus(undefined)).toBe(false);
    expect(isAutoFocus('')).toBe(false);
    expect(isAutoFocus('   ')).toBe(false);
  });
});

jest.mock('uuid', () => {
  let call = 0;
  const ids = ['plan-id', 'block-a', 'exercise-a1', 'block-b', 'exercise-b1'];
  return {
    v7: () => ids[call++] ?? `id-${call}`,
  };
});

describe('attachGeneratedIds', () => {
  const basePlan: LlmTodayPlan = {
    focus: 'Push',
    durationMinutes: 30,
    equipment: ['Dumbbells'],
    source: 'ai',
    energy: 'moderate',
    summary: 'Test summary',
    blocks: [
      {
        title: 'Block A',
        durationMinutes: 10,
        focus: 'A focus',
        exercises: [
          {
            name: 'Push-up',
            prescription: '3x10',
            detail: 'Keep core tight',
          },
        ],
      },
      {
        title: 'Block B',
        durationMinutes: 20,
        focus: 'B focus',
        exercises: [
          {
            name: 'Row',
            prescription: '3x12',
            detail: 'Squeeze at top',
          },
        ],
      },
    ],
  };

  it('adds deterministic ids to plan, blocks, and exercises', () => {
    const withIds = attachGeneratedIds(basePlan);

    expect(withIds.id).toBe('plan-id');
    expect(withIds.blocks[0].id).toBe('block-a');
    expect(withIds.blocks[0].exercises[0].id).toBe('exercise-a1');
    expect(withIds.blocks[1].id).toBe('block-b');
    expect(withIds.blocks[1].exercises[0].id).toBe('exercise-b1');
  });

  it('does not mutate the original plan', () => {
    attachGeneratedIds(basePlan);
    expect((basePlan.blocks[0] as { id?: string }).id).toBeUndefined();
    expect((basePlan.blocks[0].exercises[0] as { id?: string }).id).toBeUndefined();
  });
});
