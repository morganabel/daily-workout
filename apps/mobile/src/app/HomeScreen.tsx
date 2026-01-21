import { useState, useCallback } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Platform,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import {
  type TodayPlan,
  type GenerationRequest,
  type WorkoutEnergy,
} from '@workout-agent/shared';
import { useHomeData } from './hooks/useHomeData';
import {
  generateWorkout,
  type ApiError,
} from './services/api';
import { RootStackParamList } from './navigation';
import { userRepository } from './db/repositories/UserRepository';
import { palette, typography } from './theme';
import { BottomNavigation } from './components/BottomNavigation';
import { Button, Card } from './components/DesignSystem';
import { CustomizeSheet } from './components/CustomizeSheet';

// --- Constants ---

const FOCUS_OPTIONS = [
  { id: 'Smart', label: 'Auto', sub: 'Smart', desc: 'Picks the best focus based on your recent training.', icon: 'sparkles-outline' },
  { id: 'Full Body', label: 'Full Body', icon: 'body-outline' },
  { id: 'Upper Body', label: 'Upper Body', icon: 'arrow-up-outline' },
  { id: 'Lower Body', label: 'Lower Body', icon: 'arrow-down-outline' },
  { id: 'Core', label: 'Core', icon: 'fitness-outline' },
  { id: 'Cardio', label: 'Cardio', icon: 'pulse-outline' },
  { id: 'Strength', label: 'Strength', icon: 'barbell-outline' },
];

// --- Types ---

type HomeScreenNavigation = NativeStackNavigationProp<RootStackParamList, 'Home'>;

// --- Components ---

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
  const equipmentText = equipment.length > 0 ? equipment.join(', ') : 'Bodyweight';
  const truncatedEquipment = equipmentText.length > 20
    ? equipmentText.substring(0, 20) + '...'
    : equipmentText;

  return (
    <Pressable style={styles.summaryRow} onPress={onPress}>
      <View style={styles.summaryContent}>
        <View style={styles.summaryLine}>
          <Ionicons name="time-outline" size={16} color={palette.textSecondary} />
          <Text style={styles.summaryText}>{duration} min</Text>
          <Text style={styles.summaryDot}>•</Text>
          <Ionicons name="barbell-outline" size={16} color={palette.textSecondary} />
          <Text style={styles.summaryText}>{truncatedEquipment}</Text>
        </View>
        <View style={styles.summaryLine}>
          <Ionicons name="speedometer-outline" size={16} color={palette.textSecondary} />
          <Text style={styles.summaryText}>{intensity} intensity</Text>
        </View>
      </View>
      <View style={styles.summaryChevron}>
        <Ionicons name="chevron-forward" size={20} color={palette.textMuted} />
      </View>
    </Pressable>
  );
};

const FocusSelector = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => {
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
              <Text style={[
                styles.focusCardTitle,
                isAutoSelected && styles.focusCardTitleSelected,
              ]}>Auto</Text>
            </View>
            <View style={[
              styles.smartBadge,
              isAutoSelected && styles.smartBadgeSelected,
            ]}>
              <Text style={styles.smartBadgeText}>SMART</Text>
            </View>
          </View>
          <Text style={[
            styles.focusCardDesc,
            isAutoSelected && styles.focusCardDescSelected,
          ]}>
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
                color={isSelected ? palette.textInverse : palette.textSecondary}
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
      </View>
    </View>
  </View>
  );
};

const ActivePlanCard = ({
  plan,
  onStart,
  onDiscard,
}: {
  plan: TodayPlan;
  onStart: () => void;
  onDiscard: () => void;
}) => (
  <Card style={styles.activePlanCard}>
    <View style={styles.activePlanHeader}>
      <Text style={styles.activePlanLabel}>READY TO GO</Text>
      <Pressable onPress={onDiscard}>
        <Ionicons name="trash-outline" size={20} color={palette.destructive} />
      </Pressable>
    </View>
    <Text style={styles.activePlanTitle}>{plan.focus}</Text>
    <Text style={styles.activePlanSubtitle}>
      {plan.durationMinutes} min • {plan.equipment.join(', ') || 'Bodyweight'}
    </Text>
    <Text style={styles.activePlanDesc}>{plan.summary}</Text>
    <Button
      label="Start Workout"
      onPress={onStart}
      style={styles.activePlanButton}
      icon={<Ionicons name="play" size={20} color={palette.textInverse} />}
    />
  </Card>
);

export const HomeScreen = () => {
  const navigation = useNavigation<HomeScreenNavigation>();
  const {
    status,
    plan,
    isOffline,
    refetch,
    generationStatus,
    setGenerationStatus,
  } = useHomeData();

  // State for setup
  const [duration, setDuration] = useState(30);
  const [equipment, setEquipment] = useState<string[]>(['Bodyweight']);
  const [focus, setFocus] = useState('Smart');
  const [intensity, setIntensity] = useState('Moderate');
  const [generating, setGenerating] = useState(false);
  const [showCustomizeSheet, setShowCustomizeSheet] = useState(false);

  // Load user profile on mount
  useFocusEffect(
    useCallback(() => {
      userRepository.hasConfiguredProfile().then((hasProfile) => {
        if (!hasProfile) {
          // Could show onboarding banner here if needed
        }
      });
    }, [])
  );

  const handleGenerate = async () => {
    if (generating || isOffline) return;

    setGenerating(true);
    setGenerationStatus({ state: 'pending', submittedAt: new Date().toISOString() });

    try {
      const request: GenerationRequest = {
        timeMinutes: duration,
        equipment,
        energy: intensity.toLowerCase() as WorkoutEnergy,
        focus: focus === 'Smart' ? undefined : focus,
      };

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

  const handleCustomizeSubmit = (request: GenerationRequest) => {
    // Update local state from the sheet
    if (request.timeMinutes) setDuration(request.timeMinutes);
    if (request.equipment) setEquipment(request.equipment);
    if (request.energy) {
      // Capitalize first letter for display
      setIntensity(request.energy.charAt(0).toUpperCase() + request.energy.slice(1));
    }
    setShowCustomizeSheet(false);
  };

  const handleDiscard = () => {
    Alert.alert('Discard Workout', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: async () => {
          const { workoutRepository } = require('./db/repositories/WorkoutRepository');
          await workoutRepository.discardPlannedWorkout();
          await refetch();
        },
      },
    ]);
  };

  const hasActivePlan = status === 'ready' && plan;
  const isPending = generating || generationStatus.state === 'pending';

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <View>
          <Text style={styles.headerTitle}>Today's Setup</Text>
          <Text style={styles.headerSubtitle}>Personalize your session.</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {hasActivePlan ? (
          <ActivePlanCard
            plan={plan}
            onStart={() => navigation.navigate('ActiveWorkout', { plan })}
            onDiscard={handleDiscard}
          />
        ) : (
          <>
            <SetupSummaryRow
              duration={duration}
              equipment={equipment}
              intensity={intensity}
              onPress={() => setShowCustomizeSheet(true)}
            />

            <FocusSelector value={focus} onChange={setFocus} />

            <View style={styles.actionContainer}>
              <Button
                label={isPending ? "Generating..." : "Generate today's workout"}
                onPress={handleGenerate}
                loading={isPending}
                icon={!isPending && <Ionicons name="flash" size={20} color={palette.textInverse} />}
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
        currentPlan={null}
        loading={false}
        onSubmit={handleCustomizeSubmit}
        onClose={() => setShowCustomizeSheet(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.background,
    paddingTop: Platform.OS === 'android' ? 40 : 60,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  topBar: {
    paddingHorizontal: 20,
    marginBottom: 24,
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
  activePlanCard: {
    padding: 24,
    gap: 12,
  },
  activePlanHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  activePlanLabel: {
    fontFamily: typography.fontFamilyBold,
    fontSize: 11,
    color: palette.textMuted,
    letterSpacing: 1,
  },
  activePlanTitle: {
    fontFamily: typography.fontFamilyExtraBold,
    fontSize: 24,
    color: palette.textPrimary,
  },
  activePlanSubtitle: {
    fontFamily: typography.fontFamilyBold,
    fontSize: 15,
    color: palette.primary,
  },
  activePlanDesc: {
    fontFamily: typography.fontFamily,
    fontSize: 14,
    color: palette.textSecondary,
    lineHeight: 20,
    marginBottom: 12,
  },
  activePlanButton: {
    marginTop: 8,
  },
});
