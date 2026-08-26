import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  createTrainingBlueprintFromOnboarding,
  GYM_EQUIPMENT,
  normalizeEquipmentSelection,
  TRAINING_TEMPLATE_DEFINITIONS,
  trainingBlueprintSchema,
  type ExperienceLevel,
  type OnboardingGoal,
  type StarterWeekSlot,
  type StarterWeekSlotRole,
  type TrainingBlueprint,
  type TrainingEnvironment,
} from '@workout-agent/shared';

import type { RootStackParamList } from './navigation';
import { Button, Chip } from './components/DesignSystem';
import { getActiveRepositories } from './db/activeDatabase';
import { palette, typography, layout } from './theme';

type NavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'Onboarding'
>;
type IconName = keyof typeof Ionicons.glyphMap;

const GOALS: Array<{
  value: OnboardingGoal;
  label: string;
  description: string;
  icon: IconName;
  color: string;
  background: string;
}> = [
  {
    value: 'general-fitness',
    label: 'General fitness',
    description: 'Feel healthier and more energetic',
    icon: 'body',
    color: '#22C55E',
    background: '#DCFCE7',
  },
  {
    value: 'build-muscle',
    label: 'Build muscle',
    description: 'Increase size and definition',
    icon: 'barbell',
    color: '#8B5CF6',
    background: '#EDE9FE',
  },
  {
    value: 'build-strength',
    label: 'Build strength',
    description: 'Lift heavier and get stronger',
    icon: 'fitness',
    color: '#F97316',
    background: '#FFEDD5',
  },
  {
    value: 'lose-fat',
    label: 'Lose fat',
    description: 'Build consistency with conditioning support',
    icon: 'flame',
    color: '#EF4444',
    background: '#FEE2E2',
  },
  {
    value: 'run-cardio',
    label: 'Run/cardio',
    description: 'Improve endurance and speed',
    icon: 'walk',
    color: palette.primary,
    background: '#E0F2FE',
  },
  {
    value: 'mobility',
    label: 'Mobility',
    description: 'Move better and recover more',
    icon: 'leaf',
    color: '#14B8A6',
    background: '#CCFBF1',
  },
];

const EXPERIENCE_LEVELS: Array<{
  value: ExperienceLevel;
  label: string;
  description: string;
  icon: IconName;
  color: string;
  background: string;
}> = [
  {
    value: 'beginner',
    label: 'Beginner',
    description: 'New to training or getting back after a break.',
    icon: 'walk',
    color: '#22C55E',
    background: '#DCFCE7',
  },
  {
    value: 'intermediate',
    label: 'Intermediate',
    description: 'Consistent workouts for a while.',
    icon: 'barbell',
    color: palette.primary,
    background: '#E0F2FE',
  },
  {
    value: 'advanced',
    label: 'Advanced',
    description: 'Experienced and training regularly.',
    icon: 'trophy',
    color: '#8B5CF6',
    background: '#EDE9FE',
  },
];

const ENVIRONMENTS: Array<{
  value: TrainingEnvironment;
  label: string;
  description: string;
  icon: IconName;
}> = [
  {
    value: 'gym',
    label: 'Gym',
    description: 'Full equipment access',
    icon: 'barbell',
  },
  {
    value: 'home',
    label: 'Home',
    description: 'Minimal or basic gear',
    icon: 'home',
  },
  { value: 'travel', label: 'Travel', description: 'On the road', icon: 'bed' },
];

const ONBOARDING_EQUIPMENT_OPTIONS = [
  'Dumbbells',
  'Barbell',
  'Bench',
  'Cable Machine',
  'Treadmill',
  'Bodyweight',
] as const;
const DEFAULT_TRAINING_ENVIRONMENT: TrainingEnvironment = 'gym';
const SLOT_DURATION_PRESETS = [15, 20, 30, 45, 60] as const;

const SLOT_META: Record<
  StarterWeekSlot['role'],
  { icon: IconName; color: string; background: string }
> = {
  upper: { icon: 'barbell', color: palette.primary, background: '#E0F2FE' },
  lower: { icon: 'flash', color: '#F97316', background: '#FFEDD5' },
  pull: { icon: 'barbell', color: palette.primary, background: '#E0F2FE' },
  push: { icon: 'barbell', color: '#8B5CF6', background: '#EDE9FE' },
  legs: { icon: 'flash', color: '#F97316', background: '#FFEDD5' },
  sprint: { icon: 'walk', color: '#F97316', background: '#FFEDD5' },
  mobility: { icon: 'leaf', color: '#14B8A6', background: '#CCFBF1' },
  recovery: { icon: 'leaf', color: '#22C55E', background: '#DCFCE7' },
  conditioning: {
    icon: 'speedometer',
    color: palette.primary,
    background: '#E0F2FE',
  },
  'full-body': {
    icon: 'barbell',
    color: palette.primary,
    background: '#E0F2FE',
  },
  flexible: { icon: 'repeat', color: '#14B8A6', background: '#CCFBF1' },
};

const LIFT_ROLES = new Set<StarterWeekSlotRole>([
  'upper',
  'lower',
  'push',
  'pull',
  'legs',
  'full-body',
]);

const ROLE_LABELS: Record<StarterWeekSlotRole, string> = {
  upper: 'Lift',
  lower: 'Lift',
  push: 'Lift',
  pull: 'Lift',
  legs: 'Lift',
  conditioning: 'Cardio',
  sprint: 'Sprint',
  'full-body': 'Lift',
  mobility: 'Mobility',
  recovery: 'Recovery',
  flexible: 'Flexible',
};

const EDITOR_ROLE_OPTIONS: Array<{
  value: StarterWeekSlotRole | 'lift';
  role: StarterWeekSlotRole;
  label: string;
  icon: IconName;
  color: string;
  background: string;
}> = [
  {
    value: 'lift',
    role: 'full-body',
    label: 'Lift',
    ...SLOT_META['full-body'],
  },
  {
    value: 'conditioning',
    role: 'conditioning',
    label: 'Cardio',
    ...SLOT_META.conditioning,
  },
  { value: 'sprint', role: 'sprint', label: 'Sprint', ...SLOT_META.sprint },
  {
    value: 'mobility',
    role: 'mobility',
    label: 'Mobility',
    ...SLOT_META.mobility,
  },
  {
    value: 'recovery',
    role: 'recovery',
    label: 'Recovery',
    ...SLOT_META.recovery,
  },
  {
    value: 'flexible',
    role: 'flexible',
    label: 'Flexible',
    ...SLOT_META.flexible,
  },
];

const getDefaultEquipment = (environment: TrainingEnvironment): string[] => {
  if (environment === 'gym') return [GYM_EQUIPMENT];
  if (environment === 'travel') return ['Bodyweight'];
  return [];
};

const getEnvironmentAssumption = (
  environment: TrainingEnvironment | null
): string | null => {
  if (environment === 'gym') {
    return 'Assuming full gym access. You can fine-tune equipment later.';
  }

  if (environment === 'travel') {
    return 'Assuming bodyweight-friendly workouts while you are on the road.';
  }

  return null;
};

const getStepCopy = (step: number) => {
  if (step === 1) {
    return {
      title: "What's your level?",
      subtitle: 'This tunes the starter plan.',
      prompt: 'What is your experience level?',
    };
  }

  if (step === 2) {
    return {
      title: 'Where do you train?',
      subtitle: "Pick what's usually available.",
      prompt: 'Where do you usually train?',
    };
  }

  if (step === 3) {
    return {
      title: 'Your training plan',
      subtitle: 'A flexible starting point your coach can adapt.',
      prompt: null,
    };
  }

  return {
    title: "Let's set your plan",
    subtitle: "We'll suggest a simple weekly plan from a few basics.",
    prompt: "What's your primary goal?",
  };
};

const formatWeekday = (dayOffset: number) => {
  const date = new Date();
  date.setDate(date.getDate() + dayOffset);
  return date
    .toLocaleDateString([], { weekday: 'short' })
    .slice(0, 3)
    .toUpperCase();
};

const getRoleLabel = (role: StarterWeekSlotRole): string =>
  ROLE_LABELS[role] ?? role;

const getEditorRoleValue = (
  role: StarterWeekSlotRole
): StarterWeekSlotRole | 'lift' => (LIFT_ROLES.has(role) ? 'lift' : role);

const normalizeOnboardingSlot = (slot: StarterWeekSlot): StarterWeekSlot => {
  if (!LIFT_ROLES.has(slot.role)) {
    return {
      ...slot,
      label: getRoleLabel(slot.role),
    };
  }

  return {
    ...slot,
    role: 'full-body',
    label: 'Lift',
  };
};

const normalizeOnboardingSlots = (
  slots: StarterWeekSlot[]
): StarterWeekSlot[] => slots.map(normalizeOnboardingSlot);

export const OnboardingScreen = () => {
  const repositories = getActiveRepositories();
  const navigation = useNavigation<NavigationProp>();
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState<OnboardingGoal | null>(null);
  const [experienceLevel, setExperienceLevel] =
    useState<ExperienceLevel | null>(null);
  const [environment, setEnvironment] = useState<TrainingEnvironment | null>(
    DEFAULT_TRAINING_ENVIRONMENT
  );
  const [equipment, setEquipment] = useState<string[]>(
    getDefaultEquipment(DEFAULT_TRAINING_ENVIRONMENT)
  );
  const [draftSlots, setDraftSlots] = useState<StarterWeekSlot[] | null>(null);
  const [hasEditedWeek, setHasEditedWeek] = useState(false);
  const [activeSlotId, setActiveSlotId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const answers = useMemo(() => {
    if (!goal || !experienceLevel || !environment) return null;
    return {
      goal,
      experienceLevel,
      environment,
      equipment: normalizeEquipmentSelection(
        equipment,
        getDefaultEquipment(environment)
      ),
    };
  }, [environment, equipment, experienceLevel, goal]);

  const blueprint = useMemo(
    () => (answers ? createTrainingBlueprintFromOnboarding(answers) : null),
    [answers]
  );
  const template = blueprint
    ? TRAINING_TEMPLATE_DEFINITIONS[blueprint.templateId]
    : null;
  const copy = getStepCopy(step);
  const displaySlots = useMemo(
    () =>
      draftSlots
        ? normalizeOnboardingSlots(draftSlots)
        : blueprint
        ? normalizeOnboardingSlots(blueprint.slotSequence)
        : undefined,
    [blueprint, draftSlots]
  );
  const activeSlot =
    displaySlots?.find((slot) => slot.id === activeSlotId) ?? null;

  const goHome = () => {
    navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
  };

  const handleEnvironmentSelect = (next: TrainingEnvironment) => {
    setEnvironment(next);
    setEquipment(getDefaultEquipment(next));
  };

  const toggleEquipment = (item: string) => {
    setEquipment((current) => {
      if (item === GYM_EQUIPMENT) {
        return current.includes(GYM_EQUIPMENT) ? [] : [GYM_EQUIPMENT];
      }

      const updated = current.includes(item)
        ? current.filter((selected) => selected !== item)
        : [...current.filter((selected) => selected !== GYM_EQUIPMENT), item];
      return normalizeEquipmentSelection(updated);
    });
  };

  const handleSkip = async () => {
    await repositories.user.skipTrainingBlueprintSetup();
    goHome();
  };

  const saveBlueprintAndSlots = async (
    editStatus: 'accepted' | 'adjusted',
    blueprintOverride?: TrainingBlueprint
  ) => {
    if (!answers) return;
    setIsSaving(true);
    try {
      const nextBlueprint =
        blueprintOverride ??
        createTrainingBlueprintFromOnboarding(answers, {
          editStatus,
          updatedAt: new Date().toISOString(),
        });
      await repositories.user.saveTrainingBlueprint(nextBlueprint);
      goHome();
    } catch (error) {
      console.error('Failed to save onboarding plan', error);
      Alert.alert('Could not save plan', 'Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const updateDraftSlot = (
    slotId: string,
    updates: {
      role?: StarterWeekSlotRole;
      targetDurationMinutes?: number;
    }
  ) => {
    if (!blueprint) return;
    setHasEditedWeek(true);
    setDraftSlots((current) =>
      normalizeOnboardingSlots(current ?? blueprint.slotSequence).map((slot) =>
        slot.id === slotId
          ? normalizeOnboardingSlot({
              ...slot,
              role: updates.role ?? slot.role,
              label: updates.role ? getRoleLabel(updates.role) : slot.label,
              targetDurationMinutes:
                updates.targetDurationMinutes ?? slot.targetDurationMinutes,
            })
          : slot
      )
    );
  };

  const applySlotEdits = (
    slotId: string,
    updates: {
      role?: StarterWeekSlotRole;
      targetDurationMinutes: number;
    }
  ) => {
    const currentSlot = displaySlots?.find((slot) => slot.id === slotId);
    if (!currentSlot) {
      setActiveSlotId(null);
      return;
    }

    const nextUpdates = {
      role:
        updates.role && updates.role !== currentSlot.role
          ? updates.role
          : undefined,
      targetDurationMinutes:
        updates.targetDurationMinutes !== currentSlot.targetDurationMinutes
          ? updates.targetDurationMinutes
          : undefined,
    };

    if (nextUpdates.role || nextUpdates.targetDurationMinutes) {
      updateDraftSlot(slotId, nextUpdates);
    }
    setActiveSlotId(null);
  };

  const saveStarterWeek = () => {
    if (!blueprint) return;
    if (!hasEditedWeek || !draftSlots) {
      void saveBlueprintAndSlots('accepted');
      return;
    }

    const normalizedDraftSlots = normalizeOnboardingSlots(draftSlots);
    const targetMinutes = Math.max(
      ...normalizedDraftSlots.map((slot) => slot.targetDurationMinutes)
    );
    const adjustedBlueprint = trainingBlueprintSchema.parse({
      ...blueprint,
      durationAssumptions: {
        targetMinutes,
        minimumUsefulMinutes: Math.min(
          blueprint.durationAssumptions.minimumUsefulMinutes,
          targetMinutes
        ),
      },
      slotSequence: normalizedDraftSlots,
      editStatus: 'adjusted',
      updatedAt: new Date().toISOString(),
    });
    void saveBlueprintAndSlots('adjusted', adjustedBlueprint);
  };

  const handleContinue = () => {
    if (step < 2) {
      setStep((current) => current + 1);
      return;
    }
    setStep(3);
  };

  const canContinue =
    (step === 0 && Boolean(goal)) ||
    (step === 1 && Boolean(experienceLevel)) ||
    (step === 2 && Boolean(environment));
  const environmentAssumption = getEnvironmentAssumption(environment);

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>{copy.title}</Text>
          <Text style={styles.subtitle}>{copy.subtitle}</Text>
        </View>

        {step < 3 && <StepProgress step={step} />}

        {step === 0 && (
          <View style={styles.section}>
            <Text style={styles.question}>{copy.prompt}</Text>
            {GOALS.map((item) => (
              <OptionCard
                key={item.value}
                label={item.label}
                description={item.description}
                icon={item.icon}
                iconColor={item.color}
                iconBackground={item.background}
                selected={goal === item.value}
                onPress={() => setGoal(item.value)}
              />
            ))}
          </View>
        )}

        {step === 1 && (
          <View style={styles.section}>
            <Text style={styles.question}>{copy.prompt}</Text>
            {EXPERIENCE_LEVELS.map((item) => (
              <OptionCard
                key={item.value}
                label={item.label}
                description={item.description}
                icon={item.icon}
                iconColor={
                  experienceLevel === item.value
                    ? item.color
                    : palette.textSecondary
                }
                iconBackground={
                  experienceLevel === item.value
                    ? item.background
                    : palette.cardSecondary
                }
                selected={experienceLevel === item.value}
                onPress={() => setExperienceLevel(item.value)}
              />
            ))}
          </View>
        )}

        {step === 2 && (
          <View style={styles.section}>
            <Text style={styles.question}>{copy.prompt}</Text>
            {ENVIRONMENTS.map((item) => (
              <OptionCard
                key={item.value}
                label={item.label}
                description={item.description}
                icon={item.icon}
                iconColor={
                  environment === item.value
                    ? palette.primary
                    : palette.textSecondary
                }
                iconBackground={
                  environment === item.value ? '#E0F2FE' : palette.cardSecondary
                }
                selected={environment === item.value}
                onPress={() => handleEnvironmentSelect(item.value)}
              />
            ))}
            {environment === 'home' && (
              <>
                <Text style={styles.equipmentTitle}>
                  What equipment do you have?
                </Text>
                <View style={styles.chipWrap}>
                  {ONBOARDING_EQUIPMENT_OPTIONS.map((item) => (
                    <Chip
                      key={item}
                      label={item}
                      selected={equipment.includes(item)}
                      onPress={() => toggleEquipment(item)}
                    />
                  ))}
                </View>
              </>
            )}
            {environmentAssumption && (
              <View style={styles.assumptionCard}>
                <Ionicons name="sparkles" size={18} color={palette.primary} />
                <Text style={styles.assumptionText}>
                  {environmentAssumption}
                </Text>
              </View>
            )}
          </View>
        )}

        {step === 3 && template && blueprint && displaySlots && (
          <View style={styles.section}>
            <View style={styles.weekCard}>
              {displaySlots.map((slot, index) => (
                <StarterWeekRow
                  key={slot.id}
                  slot={slot}
                  showDivider={index < displaySlots.length - 1}
                  onPress={() => setActiveSlotId(slot.id)}
                  isActive={activeSlotId === slot.id}
                />
              ))}
            </View>

            <View style={styles.editNote}>
              <Ionicons
                name="information-circle"
                size={16}
                color={palette.textSecondary}
              />
              <Text style={styles.editNoteText}>
                This is a starting plan. You can adjust days now and change it
                later.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      <RolePickerSheet
        slot={activeSlot}
        onClose={() => setActiveSlotId(null)}
        onApply={applySlotEdits}
      />

      <View style={styles.footer}>
        {step < 3 ? (
          <View style={styles.footerRow}>
            {step > 0 && (
              <Pressable
                style={styles.backButton}
                onPress={() => setStep((current) => Math.max(0, current - 1))}
                accessibilityRole="button"
                accessibilityLabel="Back"
              >
                <Ionicons
                  name="chevron-back"
                  size={24}
                  color={palette.textSecondary}
                />
              </Pressable>
            )}
            <PrimaryAction
              label={step === 2 ? 'See my plan' : 'Next'}
              onPress={handleContinue}
              disabled={!canContinue}
              rightIcon={
                <Ionicons
                  name="arrow-forward"
                  size={20}
                  color={palette.textInverse}
                />
              }
              style={styles.flexButton}
            />
          </View>
        ) : step === 3 ? (
          <>
            <PrimaryAction
              label="Use this plan"
              onPress={saveStarterWeek}
              loading={isSaving}
              rightIcon={
                <Ionicons
                  name="checkmark"
                  size={20}
                  color={palette.textInverse}
                />
              }
            />
            <Button
              label="Skip"
              variant="secondary"
              onPress={handleSkip}
              disabled={isSaving}
            />
          </>
        ) : null}
        {step < 3 && (
          <Pressable
            style={styles.skipButton}
            onPress={handleSkip}
            disabled={isSaving}
            accessibilityRole="button"
          >
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
};

const StepProgress = ({ step }: { step: number }) => (
  <View style={styles.progressRow}>
    <Text style={styles.progressText}>{step + 1} OF 3</Text>
    <View style={styles.progressTrack}>
      {[0, 1, 2].map((index) => (
        <View
          key={index}
          style={[
            styles.progressSegment,
            index < step && styles.progressSegmentComplete,
            index === step && styles.progressSegmentActive,
          ]}
        />
      ))}
    </View>
  </View>
);

const PrimaryAction = ({
  label,
  onPress,
  disabled = false,
  loading = false,
  rightIcon,
  style,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  rightIcon?: React.ReactNode;
  style?: ViewStyle;
}) => (
  <Pressable
    style={({ pressed }) => [
      styles.primaryAction,
      pressed && styles.primaryActionPressed,
      (disabled || loading) && styles.primaryActionDisabled,
      style,
    ]}
    onPress={onPress}
    disabled={disabled || loading}
    accessibilityRole="button"
    accessibilityLabel={label}
    accessibilityState={{ disabled: disabled || loading }}
  >
    {loading ? (
      <ActivityIndicator color={palette.textInverse} />
    ) : (
      <>
        <Text style={styles.primaryActionText}>{label}</Text>
        {rightIcon && <View style={styles.primaryActionIcon}>{rightIcon}</View>}
      </>
    )}
  </Pressable>
);

const OptionCard = ({
  label,
  description,
  icon,
  iconColor,
  iconBackground,
  selected,
  onPress,
}: {
  label: string;
  description: string;
  icon: IconName;
  iconColor: string;
  iconBackground: string;
  selected: boolean;
  onPress: () => void;
}) => (
  <Pressable
    style={[styles.optionCard, selected && styles.optionCardSelected]}
    onPress={onPress}
    accessibilityRole="radio"
    accessibilityLabel={label}
    accessibilityState={{ selected }}
  >
    <View style={[styles.optionIcon, { backgroundColor: iconBackground }]}>
      <Ionicons name={icon} size={22} color={iconColor} />
    </View>
    <View style={styles.optionCopy}>
      <Text style={styles.optionLabel}>{label}</Text>
      <Text style={styles.optionDescription}>{description}</Text>
    </View>
    {selected ? (
      <View style={styles.selectedBadge}>
        <Ionicons name="checkmark" size={14} color={palette.textInverse} />
      </View>
    ) : (
      <Ionicons name="chevron-forward" size={20} color={palette.borderDark} />
    )}
  </Pressable>
);

const StarterWeekRow = ({
  slot,
  showDivider,
  onPress,
  isActive = false,
}: {
  slot: StarterWeekSlot;
  showDivider: boolean;
  onPress?: () => void;
  isActive?: boolean;
}) => {
  const meta = SLOT_META[slot.role];

  return (
    <Pressable
      style={[
        styles.weekRow,
        showDivider && styles.weekRowDivider,
        isActive && styles.weekRowActive,
      ]}
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${formatWeekday(slot.dayOffset)} ${slot.label}`}
    >
      <Text style={styles.weekday}>{formatWeekday(slot.dayOffset)}</Text>
      <View style={[styles.slotIcon, { backgroundColor: meta.background }]}>
        <Ionicons name={meta.icon} size={18} color={meta.color} />
      </View>
      <View style={styles.slotCopy}>
        <Text style={styles.slotLabel}>{slot.label}</Text>
        <Text style={styles.slotMeta}>{slot.targetDurationMinutes} min</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={palette.borderDark} />
    </Pressable>
  );
};

const RolePickerSheet = ({
  slot,
  onClose,
  onApply,
}: {
  slot: StarterWeekSlot | null;
  onClose: () => void;
  onApply: (
    slotId: string,
    updates: {
      role?: StarterWeekSlotRole;
      targetDurationMinutes: number;
    }
  ) => void;
}) => {
  const [draftRole, setDraftRole] = useState<StarterWeekSlotRole | null>(null);
  const [draftDuration, setDraftDuration] = useState<number | null>(null);
  const selectedRole = draftRole ?? slot?.role;
  const selectedDuration = draftDuration ?? slot?.targetDurationMinutes;
  const selectedEditorValue = selectedRole
    ? getEditorRoleValue(selectedRole)
    : null;

  React.useEffect(() => {
    setDraftRole(null);
    setDraftDuration(null);
  }, [slot?.id]);

  const handleApply = () => {
    if (!slot || !selectedRole || !selectedDuration) return;
    onApply(slot.id, {
      role: draftRole ?? undefined,
      targetDurationMinutes: selectedDuration,
    });
  };

  return (
    <Modal
      visible={Boolean(slot)}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable
        style={styles.modalOverlay}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Cancel role picker"
      >
        <Pressable style={styles.roleSheet} onPress={() => undefined}>
          <View style={styles.roleSheetHandle} />
          <View style={styles.roleSheetHeader}>
            <View>
              <Text style={styles.rolePickerTitle}>
                {slot
                  ? `Change ${formatWeekday(slot.dayOffset)}`
                  : 'Change day'}
              </Text>
              <Text style={styles.rolePickerSubtitle}>
                Pick the workout type and duration for this day.
              </Text>
            </View>
            <Pressable
              style={styles.roleSheetClose}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <Ionicons name="close" size={20} color={palette.textSecondary} />
            </Pressable>
          </View>
          {slot && selectedRole && selectedDuration && (
            <>
              <View style={styles.sheetSection}>
                <Text style={styles.sheetSectionTitle}>Workout type</Text>
                <View style={styles.durationOptions}>
                  {EDITOR_ROLE_OPTIONS.map((option) => (
                    <Chip
                      key={`${slot.id}-${option.value}`}
                      label={option.label}
                      icon={
                        <Ionicons
                          name={option.icon}
                          size={15}
                          color={
                            selectedEditorValue === option.value
                              ? palette.textInverse
                              : option.color
                          }
                        />
                      }
                      selected={selectedEditorValue === option.value}
                      onPress={() => {
                        setDraftRole(option.role);
                        if (option.role === 'recovery') {
                          setDraftDuration(15);
                        }
                      }}
                      role="radio"
                    />
                  ))}
                </View>
              </View>

              <View style={styles.sheetSection}>
                <Text style={styles.sheetSectionTitle}>Duration</Text>
                <View style={styles.durationOptions}>
                  {SLOT_DURATION_PRESETS.map((duration) => (
                    <Chip
                      key={duration}
                      label={`${duration} min`}
                      selected={selectedDuration === duration}
                      onPress={() => setDraftDuration(duration)}
                      role="radio"
                    />
                  ))}
                </View>
              </View>

              <View style={styles.sheetActions}>
                <Button
                  label="Cancel"
                  variant="secondary"
                  onPress={onClose}
                  style={styles.sheetActionButton}
                />
                <Button
                  label="Apply"
                  onPress={handleApply}
                  style={styles.sheetActionButton}
                />
              </View>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.background,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: layout.padding,
    paddingTop: 28,
    paddingBottom: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 22,
  },
  title: {
    fontFamily: typography.fontFamilyExtraBold,
    color: palette.textPrimary,
    fontSize: 28,
    lineHeight: 34,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: typography.fontFamily,
    color: palette.textSecondary,
    fontSize: 15,
    lineHeight: 24,
    marginTop: 8,
    textAlign: 'center',
    maxWidth: 270,
  },
  progressRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 22,
  },
  progressText: {
    fontFamily: typography.fontFamilyBold,
    color: palette.textSecondary,
    fontSize: 12,
  },
  progressTrack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressSegment: {
    width: 40,
    height: 2,
    borderRadius: 2,
    backgroundColor: palette.borderDark,
  },
  progressSegmentComplete: {
    backgroundColor: palette.primary,
  },
  progressSegmentActive: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: palette.primary,
  },
  section: {
    gap: 12,
  },
  question: {
    fontFamily: typography.fontFamilyBold,
    color: palette.textPrimary,
    fontSize: 15,
    marginBottom: 6,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: palette.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 12,
    minHeight: 68,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 18,
    elevation: 2,
  },
  optionCardSelected: {
    borderColor: palette.primary,
    backgroundColor: palette.card,
  },
  optionIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionCopy: {
    flex: 1,
    gap: 3,
  },
  optionLabel: {
    fontFamily: typography.fontFamilyBold,
    color: palette.textPrimary,
    fontSize: 15,
  },
  optionDescription: {
    fontFamily: typography.fontFamily,
    color: palette.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  selectedBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.primary,
  },
  equipmentTitle: {
    fontFamily: typography.fontFamilyBold,
    color: palette.textPrimary,
    fontSize: 15,
    marginTop: 12,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  assumptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#E0F2FE',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 6,
  },
  assumptionText: {
    flex: 1,
    fontFamily: typography.fontFamily,
    color: palette.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  durationOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  weekCard: {
    backgroundColor: palette.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.border,
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 22,
    elevation: 2,
  },
  weekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 13,
  },
  weekRowActive: {
    backgroundColor: '#F0F9FF',
  },
  weekRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  weekday: {
    width: 36,
    fontFamily: typography.fontFamilyBold,
    color: palette.textSecondary,
    fontSize: 12,
  },
  slotIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotCopy: {
    flex: 1,
  },
  slotLabel: {
    fontFamily: typography.fontFamilyBold,
    color: palette.textPrimary,
    fontSize: 15,
  },
  slotMeta: {
    fontFamily: typography.fontFamily,
    color: palette.textSecondary,
    fontSize: 13,
    marginTop: 1,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.32)',
  },
  roleSheet: {
    backgroundColor: palette.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: layout.padding,
    paddingTop: 10,
    paddingBottom: 28,
    gap: 16,
  },
  roleSheetHandle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 999,
    backgroundColor: palette.borderDark,
  },
  roleSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  rolePickerTitle: {
    fontFamily: typography.fontFamilyBold,
    color: palette.textPrimary,
    fontSize: 20,
  },
  rolePickerSubtitle: {
    fontFamily: typography.fontFamily,
    color: palette.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 3,
  },
  roleSheetClose: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.cardSecondary,
  },
  sheetSection: {
    gap: 10,
  },
  sheetSectionTitle: {
    fontFamily: typography.fontFamilyBold,
    color: palette.textPrimary,
    fontSize: 14,
  },
  sheetActions: {
    flexDirection: 'row',
    gap: 12,
  },
  sheetActionButton: {
    flex: 1,
  },
  editNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  editNoteText: {
    fontFamily: typography.fontFamily,
    color: palette.textSecondary,
    fontSize: 13,
  },
  footer: {
    gap: 10,
    padding: layout.padding,
    paddingBottom: 28,
    backgroundColor: palette.background,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  backButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.border,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 18,
    elevation: 2,
  },
  flexButton: {
    flex: 1,
  },
  primaryAction: {
    minHeight: 54,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: palette.primary,
    shadowColor: palette.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.24,
    shadowRadius: 14,
    elevation: 4,
  },
  primaryActionPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.92,
  },
  primaryActionDisabled: {
    opacity: 0.5,
  },
  primaryActionText: {
    fontFamily: typography.fontFamilyBold,
    color: palette.textInverse,
    fontSize: 16,
    textAlign: 'center',
  },
  primaryActionIcon: {
    position: 'absolute',
    right: 22,
  },
  secondaryRow: {
    flexDirection: 'row',
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: palette.card,
  },
  skipButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  skipText: {
    fontFamily: typography.fontFamilyBold,
    color: palette.primary,
    fontSize: 15,
  },
});

export default OnboardingScreen;
