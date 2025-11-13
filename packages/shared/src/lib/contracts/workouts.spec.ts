import {
  buildGenerationRequestFromQuickActions,
  normalizeQuickActionValue,
  type GenerationRequest,
  type QuickActionPreset,
} from './workouts';

const createPreset = (
  overrides: Partial<QuickActionPreset>,
): QuickActionPreset => ({
  key: 'time',
  label: 'Time',
  value: '30',
  description: '30 minutes',
  stagedValue: null,
  ...overrides,
}) as QuickActionPreset;

describe('quick action helpers', () => {
  it('normalizes individual quick action values', () => {
    const timeResult = normalizeQuickActionValue(
      createPreset({ key: 'time', stagedValue: '95' }),
    );
    expect(timeResult).toEqual({ timeMinutes: 95 });

    const focusResult = normalizeQuickActionValue(
      createPreset({
        key: 'focus',
        stagedValue: '  Lower Body  ',
      }),
    );
    expect(focusResult).toEqual({ focus: 'Lower Body' });

    const equipmentResult = normalizeQuickActionValue(
      createPreset({
        key: 'equipment',
        stagedValue: 'Dumbbells, Bands,  Bench ',
      }),
    );
    expect(equipmentResult).toEqual({
      equipment: ['Dumbbells', 'Bands', 'Bench'],
    });

    const energyResult = normalizeQuickActionValue(
      createPreset({ key: 'energy', stagedValue: 'Intense' }),
    );
    expect(energyResult).toEqual({ energy: 'intense' });

    const backfillResult = normalizeQuickActionValue(
      createPreset({ key: 'backfill', stagedValue: 'YES' }),
    );
    expect(backfillResult).toEqual({ backfill: true });
  });

  it('builds a generation request from quick actions and base defaults', () => {
    const quickActions: QuickActionPreset[] = [
      createPreset({ key: 'time', stagedValue: '45' }),
      createPreset({ key: 'focus', stagedValue: 'Upper Body' }),
      createPreset({
        key: 'equipment',
        stagedValue: 'Bodyweight, Rings',
      }),
      createPreset({ key: 'energy', stagedValue: 'easy' }),
    ];

    const base: Partial<GenerationRequest> = { notes: 'Morning session' };
    const request = buildGenerationRequestFromQuickActions(quickActions, base);

    expect(request).toEqual({
      timeMinutes: 45,
      focus: 'Upper Body',
      equipment: ['Bodyweight', 'Rings'],
      energy: 'easy',
      notes: 'Morning session',
    });
  });

  it('ignores invalid quick action values', () => {
    const quickActions: QuickActionPreset[] = [
      createPreset({ key: 'time', stagedValue: 'abc' }),
      createPreset({ key: 'energy', stagedValue: 'supercharged' }),
      createPreset({ key: 'equipment', stagedValue: '' }),
    ];

    const request = buildGenerationRequestFromQuickActions(quickActions);
    expect(request).toEqual({});
  });
});
