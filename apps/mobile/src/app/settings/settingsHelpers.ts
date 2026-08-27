import {
  GYM_EQUIPMENT,
  type AdaptiveTargetRange,
  type AdaptiveTrainingBlock,
  type AdaptiveTrainingPlan,
  type UserPreferences,
} from '@leveza/shared';

export const formatLabel = (value: string): string =>
  value
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

export const formatCountRange = (
  minCount: number,
  maxCount: number
): string => (minCount === maxCount ? `${minCount}x` : `${minCount}-${maxCount}x`);

export const humanTargetLabel = (target: AdaptiveTargetRange): string => {
  switch (target.id) {
    case 'lift':
      return 'Strength';
    case 'sprint':
      return 'Conditioning';
    case 'rest':
      return 'Mobility / recovery';
    case 'accessory':
      return 'Core / accessory';
    default:
      return target.label;
  }
};

export const formatTargetFrequency = (
  target: AdaptiveTargetRange
): string => {
  const countRange = formatCountRange(target.minCount, target.maxCount);
  return target.windowDays === 7
    ? `${humanTargetLabel(target)} ${countRange}/week`
    : `${humanTargetLabel(target)} ${countRange} in ${target.windowDays} days`;
};

export const summarizeBlockLabel = (label: string): string => {
  const normalized = label.toLowerCase();
  if (normalized.includes('cardio')) return 'Cardio';
  if (normalized.includes('sprint') || normalized.includes('conditioning')) {
    return 'Conditioning';
  }
  if (normalized.includes('accessory') || normalized.includes('abs')) {
    return 'Core';
  }
  if (normalized.includes('recovery')) return 'Rest';
  return label;
};

export const getBlockLabel = (
  blocks: AdaptiveTrainingBlock[],
  blockId: string
): string =>
  blocks.find((block) => block.id === blockId)?.label ?? formatLabel(blockId);

export const getTrainingTargets = (
  plan?: AdaptiveTrainingPlan
): AdaptiveTargetRange[] => {
  if (!plan) return [];

  const primaryTargets = plan.targetRanges.filter(
    (target) => target.priority !== 'optional' && target.maxCount > 0
  );

  return (primaryTargets.length > 0 ? primaryTargets : plan.targetRanges).slice(
    0,
    3
  );
};

export const getUsuallyLine = (plan?: AdaptiveTrainingPlan): string => {
  if (!plan || plan.typicalWeekPreferences.length === 0) {
    return 'Usually: flexible around your week';
  }

  const labels: string[] = [];
  plan.typicalWeekPreferences.forEach((preference) => {
    preference.preferredBlockIds.forEach((blockId) => {
      const label = summarizeBlockLabel(getBlockLabel(plan.blocks, blockId));
      if (!labels.includes(label)) {
        labels.push(label);
      }
    });
  });

  const visibleLabels = labels.slice(0, 4);
  const suffix =
    labels.length > visibleLabels.length
      ? ` +${labels.length - visibleLabels.length}`
      : '';

  return `Usually: ${visibleLabels.join(', ')}${suffix}`;
};

export const summarizeEquipment = (equipment: string[]): string => {
  if (equipment.includes(GYM_EQUIPMENT)) return 'Gym access';
  if (equipment.length === 0) return 'No equipment set';
  return equipment.slice(0, 2).join(', ');
};

export const summarizeEquipmentDetail = (equipment: string[]): string => {
  if (equipment.includes(GYM_EQUIPMENT)) return 'Full gym setup';
  if (equipment.length === 0) return 'Add equipment you use most.';
  if (equipment.length <= 2) return 'Home setup';
  return equipment.slice(2).join(', ');
};

export const getConstraintItems = (preferences: UserPreferences): string[] => [
  ...preferences.injuries,
  ...preferences.avoid.map((item) => `Avoid ${item}`),
];
