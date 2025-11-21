import { createTodayPlanMock } from '@workout-agent/shared';
import { planToPersistence, rowsToPlan } from './workoutMapper';

describe('workoutMapper', () => {
  it('round trips TodayPlan through persistence shape', () => {
    const plan = createTodayPlanMock({
      equipment: ['Dumbbells', 'Bench'],
    });
    const timestamp = 1717171717;
    const { workout, exercises } = planToPersistence(plan, timestamp);

    const hydrated = rowsToPlan({ ...workout, id: 'local-plan' }, exercises);

    expect(hydrated.id).toBe('local-plan');
    expect(hydrated.focus).toBe(plan.focus);
    expect(hydrated.energy).toBe(plan.energy);
    expect(hydrated.equipment).toEqual(plan.equipment);
    expect(hydrated.blocks).toHaveLength(plan.blocks.length);
  });

  it('hydrates from exercise rows when planJson is unavailable', () => {
    const plan = createTodayPlanMock();
    const { workout, exercises } = planToPersistence(plan);

    const workoutRow = {
      ...workout,
      id: 'fallback-plan',
      planJson: null,
      equipmentJson: null,
      focus: 'Fallback Focus',
      summary: 'Offline copy',
      source: 'ai' as const,
      energy: 'moderate' as const,
    };

    // ensure block metadata exists even without plan JSON
    const exerciseRows = exercises.map((ex, index) => ({
      ...ex,
      blockId: ex.blockId ?? `block-${index}`,
      blockTitle: ex.blockTitle ?? `Block ${index + 1}`,
      blockFocus: ex.blockFocus ?? 'General',
      blockDuration: ex.blockDuration ?? 10,
      blockOrder: ex.blockOrder ?? index,
    }));

    const hydrated = rowsToPlan(workoutRow, exerciseRows);

    expect(hydrated.id).toBe('fallback-plan');
    expect(hydrated.focus).toBe('Fallback Focus');
    expect(hydrated.blocks.length).toBeGreaterThan(0);
    expect(hydrated.blocks[0].title).toBeTruthy();
    expect(hydrated.equipment).toEqual([]);
  });
});
