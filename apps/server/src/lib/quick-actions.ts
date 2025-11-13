import {
  createHomeSnapshotMock,
  type QuickActionPreset,
  type TodayPlan,
} from '@workout-agent/shared';

const baseQuickActions = createHomeSnapshotMock({
  plan: null,
}).quickActions;

const formatEquipment = (equipment: string[]): string =>
  equipment.length ? equipment.join(', ') : 'Bodyweight';

const titleCase = (value: string): string =>
  value.charAt(0).toUpperCase() + value.slice(1);

export function buildQuickActions(plan: TodayPlan | null): QuickActionPreset[] {
  if (!plan) {
    return baseQuickActions.map((action) => ({
      ...action,
      stagedValue: null,
    }));
  }

  const equipmentDescription = formatEquipment(plan.equipment);

  return baseQuickActions.map((action) => {
    switch (action.key) {
      case 'time':
        return {
          ...action,
          value: String(plan.durationMinutes),
          description: `${plan.durationMinutes} min`,
          stagedValue: null,
        };
      case 'focus':
        return {
          ...action,
          value: plan.focus,
          description: plan.focus,
          stagedValue: null,
        };
      case 'equipment':
        return {
          ...action,
          value: equipmentDescription,
          description: equipmentDescription,
          stagedValue: null,
        };
      case 'energy':
        return {
          ...action,
          value: plan.energy,
          description: `${titleCase(plan.energy)} energy`,
          stagedValue: null,
        };
      default:
        return {
          ...action,
          stagedValue: null,
        };
    }
  });
}
