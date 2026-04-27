import { useState, useCallback, useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import {
  type TodayPlan,
  type GenerationRequest,
  type QuickActionPreset,
  type WorkoutEnergy,
  normalizeEquipmentSelection,
} from '@workout-agent/shared';
import { useHomeData } from './hooks/useHomeData';
import { generateWorkout, type ApiError } from './services/api';
import { RootStackParamList } from './navigation';
import { userRepository } from './db/repositories/UserRepository';
import { palette, typography } from './theme';
import { BottomNavigation } from './components/BottomNavigation';
import { Button, Card } from './components/DesignSystem';
import { CustomizeSheet } from './components/CustomizeSheet';

// --- Constants ---

const FOCUS_OPTIONS = [
  {
    id: 'Smart',
    label: 'Auto',
    sub: 'Smart',
    desc: 'Picks the best focus based on your recent training.',
    icon: 'sparkles-outline',
  },
  { id: 'Full Body', label: 'Full Body', icon: 'body-outline' },
  { id: 'Upper Body', label: 'Upper Body', icon: 'arrow-up-outline' },
  { id: 'Lower Body', label: 'Lower Body', icon: 'arrow-down-outline' },
];

const getQuickActionValue = (
  quickActions: QuickActionPreset[],
  key: QuickActionPreset['key']
): string | undefined => {
  const action = quickActions.find((item) => item.key === key);
  return action?.stagedValue ?? action?.value ?? action?.description;
};

const getQuickActionBaseValue = (
  quickActions: QuickActionPreset[],
  key: QuickActionPreset['key']
): string | undefined => {
  const action = quickActions.find((item) => item.key === key);
  return action?.value ?? action?.description;
};

const parseEquipmentSelection = (value: string | undefined): string[] => {
  if (!value) return [];
  return normalizeEquipmentSelection(value.split(','));
};

const normalizeEquipmentForComparison = (equipment: string[]): string[] =>
  equipment
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
    .sort();

const equipmentSelectionsEqual = (left: string[], right: string[]): boolean => {
  const normalizedLeft = normalizeEquipmentForComparison(left);
  const normalizedRight = normalizeEquipmentForComparison(right);

  return (
    normalizedLeft.length === normalizedRight.length &&
    normalizedLeft.every((item, index) => item === normalizedRight[index])
  );
};

const plansMatchDisplayedContent = (
  left: TodayPlan,
  right: TodayPlan
): boolean =>
  (Boolean(left.responseId) && left.responseId === right.responseId) ||
  (left.focus === right.focus &&
    left.durationMinutes === right.durationMinutes &&
    left.summary === right.summary &&
    equipmentSelectionsEqual(left.equipment, right.equipment));

const formatEquipment = (equipment: string[]): string =>
  equipment.length > 0 ? equipment.join(', ') : 'Bodyweight';

const getExerciseCount = (plan: TodayPlan): number =>
  plan.blocks.reduce((count, block) => count + block.exercises.length, 0);

const getVersionLabel = (
  version: TodayPlan,
  selectedPlan: TodayPlan,
  index: number,
  total: number
): string => {
  if (version.id === selectedPlan.id) return 'Current';
  const changeLabel = getPlanVersionMetadata(version)?.changeLabel;
  if (changeLabel) return changeLabel;
  if (index === 0) return 'Original';
  if (index === total - 1) return 'Latest';
  return `Option ${index + 1}`;
};

const getVersionHighlights = (plan: TodayPlan): string => {
  const names = plan.blocks.flatMap((block) =>
    block.exercises.map((exercise) => exercise.name)
  );
  return names.slice(0, 3).join(' • ');
};

const resolveBaseEquipmentSelection = (
  quickActions: QuickActionPreset[]
): string[] => {
  const quickActionEquipment = parseEquipmentSelection(
    getQuickActionBaseValue(quickActions, 'equipment')
  );
  return quickActionEquipment.length ? quickActionEquipment : ['Bodyweight'];
};

const hasChangedStagedEquipment = (
  quickActions: QuickActionPreset[]
): boolean => {
  const action = quickActions.find((item) => item.key === 'equipment');
  if (!action?.stagedValue?.trim()) {
    return false;
  }

  return !equipmentSelectionsEqual(
    parseEquipmentSelection(action.stagedValue),
    resolveBaseEquipmentSelection(quickActions)
  );
};

const resolveEquipmentSelection = (
  equipmentOverride: string[] | null,
  quickActions: QuickActionPreset[]
): string[] => {
  if (equipmentOverride) {
    return equipmentOverride;
  }

  const quickActionEquipment = parseEquipmentSelection(
    getQuickActionValue(quickActions, 'equipment')
  );
  return quickActionEquipment.length ? quickActionEquipment : ['Bodyweight'];
};

// --- Types ---

type HomeScreenNavigation = NativeStackNavigationProp<
  RootStackParamList,
  'Home'
>;

type PlanVersionMetadata = {
  changeLabel?: string;
};

type PlanWithVersionMetadata = TodayPlan & {
  versionMetadata?: PlanVersionMetadata;
};

const getPlanVersionMetadata = (
  plan: TodayPlan
): PlanVersionMetadata | undefined =>
  (plan as PlanWithVersionMetadata).versionMetadata;

// --- Components ---

const SetupProfileCard = ({ onPress }: { onPress: () => void }) => (
  <Pressable style={styles.setupCard} onPress={onPress}>
    <View style={styles.setupIconContainer}>
      <Ionicons name="sparkles" size={24} color={palette.textInverse} />
    </View>
    <View style={styles.setupContent}>
      <Text style={styles.setupTitle}>Set up your profile</Text>
      <Text style={styles.setupDescription}>
        Tell us about your equipment and goals for personalized workouts.
      </Text>
    </View>
    <Ionicons name="arrow-forward" size={20} color={palette.primary} />
  </Pressable>
);

const SetupSummaryRow = ({
  duration,
  equipment,
  intensity,
  onPress,
}: {
  duration: number;
  equipment: string[];
  intensity: string;
  onPress: () => void;
}) => {
  const equipmentText =
    equipment.length > 0 ? equipment.join(', ') : 'Bodyweight';
  const truncatedEquipment =
    equipmentText.length > 20
      ? equipmentText.substring(0, 20) + '...'
      : equipmentText;

  return (
    <Pressable style={styles.summaryRow} onPress={onPress}>
      <View style={styles.summaryContent}>
        <View style={styles.summaryLine}>
          <Ionicons
            name="time-outline"
            size={16}
            color={palette.textSecondary}
          />
          <Text style={styles.summaryText}>{duration} min</Text>
          <Text style={styles.summaryDot}>•</Text>
          <Ionicons
            name="barbell-outline"
            size={16}
            color={palette.textSecondary}
          />
          <Text style={styles.summaryText}>{truncatedEquipment}</Text>
        </View>
        <View style={styles.summaryLine}>
          <Ionicons
            name="speedometer-outline"
            size={16}
            color={palette.textSecondary}
          />
          <Text style={styles.summaryText}>{intensity} intensity</Text>
        </View>
      </View>
      <View style={styles.summaryChevron}>
        <Ionicons name="chevron-forward" size={20} color={palette.textMuted} />
      </View>
    </Pressable>
  );
};

const FocusSelector = ({
  value,
  onChange,
  onMore,
}: {
  value: string;
  onChange: (v: string) => void;
  onMore: () => void;
}) => {
  const isAutoSelected = value === 'Smart';

  return (
    <View style={styles.sectionContainer}>
      <Text style={styles.sectionLabel}>FOCUS</Text>
      <View style={styles.focusContainer}>
        {/* Auto / Smart Option */}
        <Pressable
          style={[
            styles.focusCardLarge,
            isAutoSelected && styles.focusCardSelected,
          ]}
          onPress={() => onChange('Smart')}
        >
          <View style={styles.focusHeader}>
            <View style={styles.focusTitleRow}>
              <Ionicons
                name="sparkles"
                size={20}
                color={isAutoSelected ? palette.textInverse : palette.primary}
              />
              <Text
                style={[
                  styles.focusCardTitle,
                  isAutoSelected && styles.focusCardTitleSelected,
                ]}
              >
                Auto
              </Text>
            </View>
            <View
              style={[
                styles.smartBadge,
                isAutoSelected && styles.smartBadgeSelected,
              ]}
            >
              <Text style={styles.smartBadgeText}>SMART</Text>
            </View>
          </View>
          <Text
            style={[
              styles.focusCardDesc,
              isAutoSelected && styles.focusCardDescSelected,
            ]}
          >
            Picks the best focus based on your recent training.
          </Text>
        </Pressable>

        {/* Grid for other options */}
        <View style={styles.focusGrid}>
          {FOCUS_OPTIONS.slice(1).map((opt) => {
            const isSelected = value === opt.id;
            return (
              <Pressable
                key={opt.id}
                style={[
                  styles.focusCardSmall,
                  isSelected && styles.focusCardSelected,
                ]}
                onPress={() => onChange(opt.id)}
              >
                <Ionicons
                  name={opt.icon as any}
                  size={20}
                  color={
                    isSelected ? palette.textInverse : palette.textSecondary
                  }
                />
                <Text
                  style={[
                    styles.focusCardTitleSmall,
                    isSelected && styles.focusCardTitleSelected,
                  ]}
                >
                  {opt.label}
                </Text>
                {isSelected && (
                  <Ionicons
                    name="checkmark-circle"
                    size={16}
                    color={palette.textInverse}
                    style={styles.checkIcon}
                  />
                )}
              </Pressable>
            );
          })}
          {/* More button */}
          <Pressable style={styles.focusCardSmall} onPress={onMore}>
            <Ionicons
              name="ellipsis-horizontal"
              size={20}
              color={palette.textSecondary}
            />
            <Text style={styles.focusCardTitleSmall}>More</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
};

const ActivePlanCard = ({
  plan,
  onStart,
  onCustomize,
  isPending,
  regenerationError,
  planVersions = [],
  onSelectVersion,
}: {
  plan: TodayPlan;
  onStart: () => void;
  onCustomize: () => void;
  isPending: boolean;
  regenerationError?: string | null;
  planVersions?: TodayPlan[];
  onSelectVersion?: (version: TodayPlan) => void;
}) => {
  const [showVersions, setShowVersions] = useState(false);
  const canShowOptions = planVersions.length > 1 && Boolean(onSelectVersion);
  const currentVersionIndex = planVersions.findIndex(
    (version) => version.id === plan.id
  );
  const hasOriginalUndo =
    canShowOptions && currentVersionIndex > 0 && Boolean(planVersions[0]);

  return (
    <View style={styles.activePlanStack}>
      <Card style={styles.activePlanCard}>
        {isPending ? (
          <View
            style={styles.activePlanUpdatingRow}
            accessibilityRole="progressbar"
            accessibilityLabel="Updating workout"
          >
            <ActivityIndicator color={palette.primary} size="small" />
            <Text style={styles.activePlanUpdatingText}>
              Updating your workout…
            </Text>
          </View>
        ) : null}
        {regenerationError && !isPending ? (
          <View style={styles.activePlanErrorBanner} accessibilityRole="alert">
            <Ionicons
              name="alert-circle-outline"
              size={18}
              color={palette.destructive}
            />
            <Text style={styles.activePlanErrorText}>{regenerationError}</Text>
          </View>
        ) : null}

        <View style={styles.activePlanHeader}>
          <View>
            <Text style={styles.activePlanLabel}>TODAY'S WORKOUT</Text>
            <Text style={styles.activePlanTitle}>{plan.focus}</Text>
          </View>
          {canShowOptions ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Workout versions"
              accessibilityState={{ disabled: isPending }}
              disabled={isPending}
              onPress={() => setShowVersions(true)}
              style={({ pressed }) => [
                styles.versionSummaryButton,
                pressed && styles.versionSummaryButtonPressed,
                isPending && styles.versionSummaryButtonDisabled,
              ]}
            >
              <Ionicons
                name="albums-outline"
                size={16}
                color={palette.primary}
              />
              <Text style={styles.versionSummaryButtonText}>
                {planVersions.length} versions
              </Text>
            </Pressable>
          ) : null}
        </View>

        <Text style={styles.activePlanDesc}>{plan.summary}</Text>

        <View style={styles.planPillRow}>
          <View style={styles.planInfoPill}>
            <Ionicons name="time-outline" size={15} color={palette.primary} />
            <Text style={styles.planInfoPillText}>
              {plan.durationMinutes} min
            </Text>
          </View>
          <View style={styles.planInfoPill}>
            <Ionicons name="flame-outline" size={15} color={palette.primary} />
            <Text style={styles.planInfoPillText}>{plan.energy}</Text>
          </View>
          <View style={styles.planInfoPillWide}>
            <Ionicons
              name="barbell-outline"
              size={15}
              color={palette.primary}
            />
            <Text style={styles.planInfoPillText} numberOfLines={1}>
              {formatEquipment(plan.equipment)}
            </Text>
          </View>
        </View>

        {hasOriginalUndo && onSelectVersion ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Undo to original workout"
            accessibilityState={{ disabled: isPending }}
            disabled={isPending}
            onPress={() => onSelectVersion(planVersions[0])}
            style={({ pressed }) => [
              styles.undoCard,
              pressed && styles.versionSummaryButtonPressed,
              isPending && styles.versionSummaryButtonDisabled,
            ]}
          >
            <View style={styles.undoIcon}>
              <Ionicons
                name="return-up-back"
                size={16}
                color={palette.primary}
              />
            </View>
            <View style={styles.undoCopy}>
              <Text style={styles.undoTitle}>Prefer the first draft?</Text>
              <Text style={styles.undoText}>
                Switch back to the original version.
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={palette.textMuted}
            />
          </Pressable>
        ) : null}
      </Card>

      <View style={styles.workoutDetailSection}>
        <View style={styles.workoutDetailHeader}>
          <Text style={styles.sectionLabel}>THE PLAN</Text>
          <Text style={styles.exerciseCountText}>
            {getExerciseCount(plan)} exercises
          </Text>
        </View>

        {plan.blocks.map((block) => (
          <View key={block.id} style={styles.workoutBlockCard}>
            <View style={styles.workoutBlockHeader}>
              <View style={styles.workoutBlockTitleGroup}>
                <Text style={styles.workoutBlockTitle}>{block.title}</Text>
                <Text style={styles.workoutBlockFocus}>{block.focus}</Text>
              </View>
              <View style={styles.workoutBlockDurationPill}>
                <Text style={styles.workoutBlockDurationText}>
                  {block.durationMinutes} min
                </Text>
              </View>
            </View>

            <View style={styles.exerciseList}>
              {block.exercises.map((exercise, index) => (
                <View key={exercise.id} style={styles.exerciseRow}>
                  <View style={styles.exerciseIndexCircle}>
                    <Text style={styles.exerciseIndexText}>{index + 1}</Text>
                  </View>
                  <View style={styles.exerciseBody}>
                    <Text style={styles.exerciseName}>{exercise.name}</Text>
                    <Text style={styles.exercisePrescription}>
                      {exercise.prescription}
                    </Text>
                    {exercise.detail ? (
                      <Text style={styles.exerciseDetail}>
                        {exercise.detail}
                      </Text>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
          </View>
        ))}
      </View>

      <View style={styles.activePlanActions}>
        <Button
          label="Start Workout"
          onPress={onStart}
          disabled={isPending}
          icon={<Ionicons name="play" size={20} color={palette.textInverse} />}
        />
        <View style={styles.activePlanSecondaryRow}>
          <Button
            label={isPending ? 'Updating…' : 'Customize'}
            onPress={onCustomize}
            variant="outline"
            disabled={isPending}
            style={styles.activePlanSecondaryButton}
          />
          {canShowOptions ? (
            <Button
              label="Versions"
              onPress={() => setShowVersions(true)}
              variant="outline"
              disabled={isPending}
              style={styles.activePlanSecondaryButton}
            />
          ) : null}
        </View>
      </View>

      {canShowOptions && onSelectVersion ? (
        <Modal
          visible={showVersions}
          transparent
          animationType="slide"
          onRequestClose={() => setShowVersions(false)}
        >
          <View style={styles.optionsOverlay}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close workout versions"
              style={StyleSheet.absoluteFill}
              onPress={() => setShowVersions(false)}
            />
            <View style={styles.optionsSheet}>
              <View style={styles.optionsHandle} />
              <View style={styles.optionsHeader}>
                <View>
                  <Text style={styles.optionsTitle}>Workout versions</Text>
                  <Text style={styles.optionsSubtitle}>
                    Pick the version that feels right today.
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close workout versions"
                  onPress={() => setShowVersions(false)}
                  style={styles.optionsCloseButton}
                >
                  <Ionicons
                    name="close"
                    size={20}
                    color={palette.textPrimary}
                  />
                </Pressable>
              </View>

              <ScrollView
                style={styles.optionsList}
                contentContainerStyle={styles.optionsListContent}
                showsVerticalScrollIndicator={false}
              >
                {planVersions.map((version, index) => {
                  const selected = version.id === plan.id;
                  const label = getVersionLabel(
                    version,
                    plan,
                    index,
                    planVersions.length
                  );

                  return (
                    <Pressable
                      key={version.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Use ${label} workout version`}
                      accessibilityState={{ selected, disabled: isPending }}
                      disabled={isPending}
                      onPress={() => {
                        setShowVersions(false);
                        onSelectVersion(version);
                      }}
                      style={({ pressed }) => [
                        styles.optionCard,
                        selected && styles.optionCardSelected,
                        pressed && styles.optionCardPressed,
                        isPending && styles.versionSummaryButtonDisabled,
                      ]}
                    >
                      <View style={styles.optionCardHeader}>
                        <View style={styles.optionLabelPill}>
                          <Text style={styles.optionLabelText}>{label}</Text>
                        </View>
                        {selected ? (
                          <Ionicons
                            name="checkmark-circle"
                            size={20}
                            color={palette.primary}
                          />
                        ) : null}
                      </View>
                      <Text style={styles.optionTitle}>{version.focus}</Text>
                      <Text style={styles.optionMeta}>
                        {version.durationMinutes} min •{' '}
                        {formatEquipment(version.equipment)}
                      </Text>
                      <Text style={styles.optionSummary} numberOfLines={2}>
                        {version.summary}
                      </Text>
                      <Text style={styles.optionHighlights} numberOfLines={1}>
                        {getVersionHighlights(version)}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
};

export const HomeScreen = () => {
  const navigation = useNavigation<HomeScreenNavigation>();
  const {
    plan,
    planVersions,
    quickActions,
    isOffline,
    refetch,
    selectWorkoutVersion,
    generationStatus,
    updateStagedValue,
    setGenerationStatus,
  } = useHomeData();

  // State for setup
  const [duration, setDuration] = useState(30);
  const [equipmentOverride, setEquipmentOverride] = useState<string[] | null>(
    null
  );
  const [focus, setFocus] = useState('Smart');
  const [intensity, setIntensity] = useState('Moderate');
  const [generating, setGenerating] = useState(false);
  const [showCustomizeSheet, setShowCustomizeSheet] = useState(false);
  const [customizeForRegeneration, setCustomizeForRegeneration] =
    useState(false);
  const [showProfileSetup, setShowProfileSetup] = useState(false);
  const [pendingPlanSnapshot, setPendingPlanSnapshot] =
    useState<TodayPlan | null>(null);
  const [optimisticPlan, setOptimisticPlan] = useState<TodayPlan | null>(null);
  const [selectedVersionPlan, setSelectedVersionPlan] =
    useState<TodayPlan | null>(null);

  useEffect(() => {
    if (!optimisticPlan || !plan) return;

    if (plansMatchDisplayedContent(plan, optimisticPlan)) {
      setOptimisticPlan(null);
    }
  }, [optimisticPlan, plan]);

  useEffect(() => {
    if (!selectedVersionPlan || !plan) return;

    if (plansMatchDisplayedContent(plan, selectedVersionPlan)) {
      setSelectedVersionPlan(null);
    }
  }, [selectedVersionPlan, plan]);

  const regenerationPlan = optimisticPlan ?? plan;
  const activePlan = selectedVersionPlan ?? regenerationPlan;

  // Load user profile on mount
  useFocusEffect(
    useCallback(() => {
      userRepository.hasConfiguredProfile().then((hasProfile) => {
        setShowProfileSetup(!hasProfile);
      });
    }, [])
  );

  const handleGenerate = async () => {
    if (generating || isOffline) return;

    setGenerating(true);
    setGenerationStatus({
      state: 'pending',
      submittedAt: new Date().toISOString(),
    });

    const equipment = resolveEquipmentSelection(
      equipmentOverride,
      quickActions
    );
    const shouldSendEquipment =
      Boolean(equipmentOverride) || hasChangedStagedEquipment(quickActions);

    try {
      setSelectedVersionPlan(null);
      const request: GenerationRequest = {
        timeMinutes: duration,
        energy: intensity.toLowerCase() as WorkoutEnergy,
        focus,
      };

      if (shouldSendEquipment) {
        request.equipment = equipment;
      }

      console.log('Generating workout:', request);
      await generateWorkout(request);
      await refetch();

      setGenerationStatus({ state: 'idle', submittedAt: null });
    } catch (err) {
      const apiError = err as ApiError;
      console.error('Failed to generate:', apiError);
      setGenerationStatus({
        state: 'error',
        submittedAt: new Date().toISOString(),
        message: apiError.message,
      });
      Alert.alert('Error', apiError.message || 'Failed to generate workout');
    } finally {
      setGenerating(false);
    }
  };

  const handleCustomizeSubmit = async (request: GenerationRequest) => {
    if (customizeForRegeneration && activePlan) {
      // Regeneration mode - generate a new workout
      setShowCustomizeSheet(false);
      setPendingPlanSnapshot(activePlan);
      setGenerating(true);
      setGenerationStatus({
        state: 'pending',
        submittedAt: new Date().toISOString(),
      });

      try {
        setSelectedVersionPlan(null);
        const newPlan = await generateWorkout(request);
        setOptimisticPlan(newPlan);
        await refetch();
        setGenerationStatus({ state: 'idle', submittedAt: null });
      } catch (err) {
        const apiError = err as ApiError;
        setGenerationStatus({
          state: 'error',
          submittedAt: new Date().toISOString(),
          message: apiError.message,
        });
        Alert.alert(
          'Error',
          apiError.message || 'Failed to regenerate workout'
        );
      } finally {
        setGenerating(false);
        setPendingPlanSnapshot(null);
        setCustomizeForRegeneration(false);
      }
    } else {
      // Initial customization - just update local state
      if (request.timeMinutes) setDuration(request.timeMinutes);
      if (request.equipment) {
        setEquipmentOverride(
          equipmentSelectionsEqual(
            request.equipment,
            resolveBaseEquipmentSelection(quickActions)
          )
            ? null
            : request.equipment
        );
      }
      if (request.energy) {
        setIntensity(
          request.energy.charAt(0).toUpperCase() + request.energy.slice(1)
        );
      }
      setFocus(request.focus ?? 'Smart');
      setShowCustomizeSheet(false);
    }
  };

  const handleCustomize = () => {
    if (generationStatus.state === 'error') {
      setGenerationStatus({ state: 'idle', submittedAt: null });
    }
    setCustomizeForRegeneration(true);
    setShowCustomizeSheet(true);
  };

  const displayPlan = activePlan ?? (generating ? pendingPlanSnapshot : null);
  const displayPlanVersions = optimisticPlan ? [] : planVersions;
  const displayEquipment = resolveEquipmentSelection(
    equipmentOverride,
    quickActions
  );
  const hasActivePlan = Boolean(displayPlan);
  const isPending = generating || generationStatus.state === 'pending';
  const regenerationError =
    generationStatus.state === 'error' && generationStatus.message
      ? generationStatus.message
      : null;

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <View>
          <Text style={styles.headerTitle}>
            {hasActivePlan ? "Today's Workout" : "Today's Setup"}
          </Text>
          <Text style={styles.headerSubtitle}>
            {hasActivePlan
              ? 'Review the plan, then start.'
              : 'Personalize your session.'}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {showProfileSetup && (
          <SetupProfileCard onPress={() => navigation.navigate('Settings')} />
        )}

        {hasActivePlan && displayPlan ? (
          <ActivePlanCard
            plan={displayPlan}
            onStart={() =>
              navigation.navigate('ActiveWorkout', { plan: displayPlan })
            }
            onCustomize={handleCustomize}
            isPending={isPending}
            regenerationError={regenerationError}
            planVersions={displayPlanVersions}
            onSelectVersion={(version) => {
              setSelectedVersionPlan(version);
              setOptimisticPlan(null);
              void selectWorkoutVersion(version.id);
            }}
          />
        ) : (
          <>
            <SetupSummaryRow
              duration={duration}
              equipment={displayEquipment}
              intensity={intensity}
              onPress={() => setShowCustomizeSheet(true)}
            />

            <FocusSelector
              value={focus}
              onChange={setFocus}
              onMore={() => setShowCustomizeSheet(true)}
            />

            <View style={styles.actionContainer}>
              <Button
                label={isPending ? 'Generating...' : "Generate today's workout"}
                onPress={handleGenerate}
                loading={isPending}
                icon={
                  !isPending && (
                    <Ionicons
                      name="flash"
                      size={20}
                      color={palette.textInverse}
                    />
                  )
                }
                style={styles.generateButton}
              />
            </View>
          </>
        )}

        {/* Extra spacing for bottom nav */}
        <View style={{ height: 100 }} />
      </ScrollView>

      <BottomNavigation />

      <CustomizeSheet
        visible={showCustomizeSheet}
        currentPlan={customizeForRegeneration ? activePlan : null}
        loading={generating}
        initialDuration={duration}
        initialEquipment={displayEquipment}
        initialEnergy={
          intensity.toLowerCase() as 'easy' | 'moderate' | 'intense'
        }
        initialFocus={focus}
        quickActions={customizeForRegeneration ? undefined : quickActions}
        onUpdateStagedValue={
          customizeForRegeneration ? undefined : updateStagedValue
        }
        onSubmit={handleCustomizeSubmit}
        onClose={() => {
          setShowCustomizeSheet(false);
          setCustomizeForRegeneration(false);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.background,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  topBar: {
    paddingHorizontal: 20,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: typography.fontFamilyExtraBold,
    fontSize: 28,
    color: palette.textPrimary,
  },
  headerSubtitle: {
    fontFamily: typography.fontFamily,
    fontSize: 14,
    color: palette.textSecondary,
    marginTop: 4,
  },

  // Setup Card
  setupCard: {
    backgroundColor: palette.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: palette.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    shadowColor: palette.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  setupIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setupContent: {
    flex: 1,
    gap: 4,
  },
  setupTitle: {
    fontFamily: typography.fontFamilyBold,
    fontSize: 16,
    color: palette.textPrimary,
  },
  setupDescription: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    color: palette.textSecondary,
    lineHeight: 18,
  },

  // Summary Row
  summaryRow: {
    backgroundColor: palette.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: palette.border,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  summaryContent: {
    flex: 1,
    gap: 8,
  },
  summaryLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  summaryText: {
    fontFamily: typography.fontFamily,
    fontSize: 14,
    color: palette.textPrimary,
  },
  summaryDot: {
    color: palette.textMuted,
    marginHorizontal: 4,
  },
  summaryChevron: {
    marginLeft: 8,
  },

  // Section Shared
  sectionContainer: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontFamily: typography.fontFamilyBold,
    fontSize: 11,
    color: palette.textMuted,
    letterSpacing: 1,
    marginBottom: 12,
  },

  // Focus
  focusContainer: {
    gap: 8,
  },
  focusCardLarge: {
    backgroundColor: palette.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: palette.border,
  },
  focusCardSelected: {
    borderColor: palette.primary,
    backgroundColor: palette.primary,
  },
  focusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  focusTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  focusCardTitle: {
    fontFamily: typography.fontFamilyBold,
    fontSize: 16,
    color: palette.textPrimary,
  },
  focusCardDesc: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    color: palette.textSecondary,
    lineHeight: 18,
  },
  focusCardDescSelected: {
    color: 'rgba(255, 255, 255, 0.85)',
  },
  smartBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: palette.accentIndigo,
    borderRadius: 99,
  },
  smartBadgeSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  smartBadgeText: {
    color: 'white',
    fontSize: 10,
    fontFamily: typography.fontFamilyBold,
  },
  focusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  focusCardSmall: {
    flex: 1,
    minWidth: '48%',
    backgroundColor: palette.card,
    borderRadius: 99,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: palette.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  focusCardTitleSmall: {
    fontFamily: typography.fontFamilyBold,
    fontSize: 13,
    color: palette.textPrimary,
  },
  focusCardTitleSelected: {
    color: palette.textInverse,
  },
  checkIcon: {
    marginLeft: 'auto',
  },

  // Action
  actionContainer: {
    marginTop: 8,
  },
  generateButton: {
    shadowColor: palette.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },

  // Active Plan
  activePlanStack: {
    gap: 18,
  },
  activePlanCard: {
    padding: 22,
    gap: 16,
    borderRadius: 24,
  },
  activePlanUpdatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: palette.cardSecondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
  },
  activePlanUpdatingText: {
    flex: 1,
    fontFamily: typography.fontFamilyBold,
    fontSize: 14,
    color: palette.textPrimary,
  },
  activePlanErrorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: palette.destructiveBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.destructive,
  },
  activePlanErrorText: {
    flex: 1,
    fontFamily: typography.fontFamily,
    fontSize: 13,
    color: palette.destructive,
    lineHeight: 18,
  },
  activePlanHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
  },
  activePlanLabel: {
    fontFamily: typography.fontFamilyBold,
    fontSize: 11,
    color: palette.textMuted,
    letterSpacing: 1,
  },
  activePlanTitle: {
    fontFamily: typography.fontFamilyExtraBold,
    fontSize: 30,
    color: palette.textPrimary,
    marginTop: 4,
  },
  activePlanDesc: {
    fontFamily: typography.fontFamily,
    fontSize: 15,
    color: palette.textSecondary,
    lineHeight: 22,
  },
  versionSummaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: palette.cardSecondary,
    borderWidth: 1,
    borderColor: palette.border,
  },
  versionSummaryButtonPressed: {
    opacity: 0.78,
  },
  versionSummaryButtonDisabled: {
    opacity: 0.5,
  },
  versionSummaryButtonText: {
    fontFamily: typography.fontFamilyBold,
    fontSize: 12,
    color: palette.primary,
  },
  planPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  planInfoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: palette.cardSecondary,
    borderWidth: 1,
    borderColor: palette.border,
  },
  planInfoPillWide: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: palette.cardSecondary,
    borderWidth: 1,
    borderColor: palette.border,
  },
  planInfoPillText: {
    fontFamily: typography.fontFamilyBold,
    fontSize: 12,
    color: palette.textPrimary,
    textTransform: 'capitalize',
  },
  undoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 18,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    gap: 10,
  },
  undoIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.card,
  },
  undoCopy: {
    flex: 1,
    gap: 2,
  },
  undoTitle: {
    fontFamily: typography.fontFamilyBold,
    fontSize: 13,
    color: palette.textPrimary,
  },
  undoText: {
    fontFamily: typography.fontFamily,
    fontSize: 12,
    color: palette.textSecondary,
  },
  workoutDetailSection: {
    gap: 8,
  },
  workoutDetailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  exerciseCountText: {
    fontFamily: typography.fontFamilyBold,
    fontSize: 12,
    color: palette.textMuted,
  },
  workoutBlockCard: {
    backgroundColor: palette.card,
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: palette.border,
    gap: 14,
  },
  workoutBlockHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  workoutBlockTitleGroup: {
    flex: 1,
    gap: 3,
  },
  workoutBlockTitle: {
    fontFamily: typography.fontFamilyExtraBold,
    fontSize: 18,
    color: palette.textPrimary,
  },
  workoutBlockFocus: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    color: palette.textSecondary,
  },
  workoutBlockDurationPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: palette.primary,
  },
  workoutBlockDurationText: {
    fontFamily: typography.fontFamilyBold,
    fontSize: 12,
    color: palette.textInverse,
  },
  exerciseList: {
    gap: 12,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  exerciseIndexCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.cardSecondary,
    borderWidth: 1,
    borderColor: palette.border,
    marginTop: 1,
  },
  exerciseIndexText: {
    fontFamily: typography.fontFamilyBold,
    fontSize: 12,
    color: palette.textSecondary,
  },
  exerciseBody: {
    flex: 1,
    gap: 3,
  },
  exerciseName: {
    fontFamily: typography.fontFamilyBold,
    fontSize: 15,
    color: palette.textPrimary,
  },
  exercisePrescription: {
    fontFamily: typography.fontFamilyBold,
    fontSize: 13,
    color: palette.primary,
  },
  exerciseDetail: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    color: palette.textSecondary,
    lineHeight: 18,
  },
  activePlanActions: {
    gap: 12,
    paddingTop: 2,
  },
  activePlanSecondaryRow: {
    flexDirection: 'row',
    gap: 12,
  },
  activePlanSecondaryButton: {
    flex: 1,
  },
  optionsOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
  },
  optionsSheet: {
    maxHeight: '78%',
    paddingTop: 10,
    paddingHorizontal: 20,
    paddingBottom: 28,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: palette.background,
    borderWidth: 1,
    borderColor: palette.border,
  },
  optionsHandle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: palette.borderDark,
    marginBottom: 16,
  },
  optionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
    marginBottom: 16,
  },
  optionsTitle: {
    fontFamily: typography.fontFamilyExtraBold,
    fontSize: 24,
    color: palette.textPrimary,
  },
  optionsSubtitle: {
    fontFamily: typography.fontFamily,
    fontSize: 14,
    color: palette.textSecondary,
    marginTop: 3,
  },
  optionsCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.border,
  },
  optionsList: {
    marginHorizontal: -2,
  },
  optionsListContent: {
    gap: 10,
    paddingHorizontal: 2,
    paddingBottom: 8,
  },
  optionCard: {
    padding: 16,
    borderRadius: 20,
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.border,
    gap: 8,
  },
  optionCardSelected: {
    borderColor: palette.primary,
    backgroundColor: '#F0F9FF',
  },
  optionCardPressed: {
    transform: [{ scale: 0.99 }],
  },
  optionCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  optionLabelPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: palette.cardSecondary,
  },
  optionLabelText: {
    fontFamily: typography.fontFamilyBold,
    fontSize: 11,
    color: palette.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  optionTitle: {
    fontFamily: typography.fontFamilyExtraBold,
    fontSize: 18,
    color: palette.textPrimary,
  },
  optionMeta: {
    fontFamily: typography.fontFamilyBold,
    fontSize: 13,
    color: palette.primary,
  },
  optionSummary: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    color: palette.textSecondary,
    lineHeight: 18,
  },
  optionHighlights: {
    fontFamily: typography.fontFamilyBold,
    fontSize: 12,
    color: palette.textMuted,
  },
});
