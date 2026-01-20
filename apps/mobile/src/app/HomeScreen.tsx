import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
  ActivityIndicator,
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
  type GenerationStatus,
} from '@workout-agent/shared';
import { useHomeData } from './hooks/useHomeData';
import {
  generateWorkout,
  type ApiError,
} from './services/api';
import { RootStackParamList } from './navigation';
import { userRepository } from './db/repositories/UserRepository';
import { palette, typography, layout } from './theme';
import { BottomNavigation } from './components/BottomNavigation';
import { Button, Card, SectionHeader, Chip } from './components/DesignSystem';

// --- Constants ---

const DURATION_OPTIONS = [15, 30, 45, 60, 90];

const EQUIPMENT_OPTIONS = [
  { label: 'Bodyweight', icon: 'body-outline' },
  { label: 'Dumbbells', icon: 'barbell-outline' },
  { label: 'Kettlebell', icon: 'fitness-outline' },
  { label: 'Bands', icon: 'infinite-outline' },
  { label: 'Gym', icon: 'business-outline' },
];

const FOCUS_OPTIONS = [
  { id: 'Smart', label: 'Auto', sub: 'Smart', desc: 'Picks the best focus based on your recent training.', icon: 'sparkles-outline' },
  { id: 'Full Body', label: 'Full Body', icon: 'body-outline' },
  { id: 'Upper Body', label: 'Upper Body', icon: 'arrow-up-outline' },
  { id: 'Lower Body', label: 'Lower Body', icon: 'arrow-down-outline' },
  { id: 'Cardio', label: 'Cardio', icon: 'pulse-outline' },
];

const INTENSITY_OPTIONS = ['Easy', 'Moderate', 'Hard'];

// --- Types ---

type HomeScreenNavigation = NativeStackNavigationProp<RootStackParamList, 'Home'>;

// --- Components ---

const DurationSelector = ({ value, onChange }: { value: number; onChange: (v: number) => void }) => (
  <View style={styles.durationContainer}>
    <View style={styles.headerRow}>
      <Text style={styles.sectionLabel}>DURATION</Text>
      <Text style={styles.durationValue}>{value} min</Text>
    </View>
    <View style={styles.durationRow}>
      {DURATION_OPTIONS.map((mins) => {
        const isSelected = value === mins;
        return (
          <Pressable
            key={mins}
            style={[
              styles.durationButton,
              isSelected && styles.durationButtonSelected,
            ]}
            onPress={() => onChange(mins)}
          >
            <Text
              style={[
                styles.durationButtonText,
                isSelected && styles.durationButtonTextSelected,
              ]}
            >
              {mins}
            </Text>
          </Pressable>
        );
      })}
    </View>
  </View>
);

const EquipmentSelector = ({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) => {
  const toggle = (item: string) => {
    if (value.includes(item)) {
      onChange(value.filter((i) => i !== item));
    } else {
      onChange([...value, item]);
    }
  };

  return (
    <View style={styles.sectionContainer}>
      <Text style={styles.sectionLabel}>EQUIPMENT</Text>
      <View style={styles.chipRow}>
        {EQUIPMENT_OPTIONS.map((opt) => {
          const isSelected = value.includes(opt.label);
          return (
            <Chip
              key={opt.label}
              label={opt.label}
              selected={isSelected}
              onPress={() => toggle(opt.label)}
              icon={
                <Ionicons
                  name={opt.icon as any}
                  size={16}
                  color={isSelected ? palette.textInverse : palette.textSecondary}
                />
              }
            />
          );
        })}
      </View>
    </View>
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

const IntensitySelector = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
  <View style={styles.sectionContainer}>
    <Text style={styles.sectionLabel}>INTENSITY</Text>
    <View style={styles.intensityContainer}>
      {INTENSITY_OPTIONS.map((level) => {
        const isSelected = value === level;
        return (
          <Pressable
            key={level}
            style={[
              styles.intensityButton,
              isSelected && styles.intensityButtonSelected,
            ]}
            onPress={() => onChange(level)}
          >
            <Text
              style={[
                styles.intensityText,
                isSelected && styles.intensityTextSelected,
              ]}
            >
              {level}
            </Text>
          </Pressable>
        );
      })}
    </View>
  </View>
);

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
    recentSessions,
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
        energy: intensity.toLowerCase() as any,
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

  const handleDiscard = () => {
    Alert.alert('Discard Workout', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: async () => {
          // This calls the repo directly to clear local state
          // Ideally should be an API call if server state exists, but shared logic handles it?
          // The previous code called `workoutRepository.discardPlannedWorkout()`
          const { workoutRepository } = require('./db/repositories/WorkoutRepository'); // Lazy import to avoid cycle if any
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
        <View style={styles.streakContainer}>
          {/* Flame icon hidden as requested */}
          {/* <Ionicons name="flame" size={20} color={palette.warning} /> */}
          {/* <Text style={styles.streakText}>12</Text> */}
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
            <DurationSelector value={duration} onChange={setDuration} />
            <EquipmentSelector value={equipment} onChange={setEquipment} />
            <FocusSelector value={focus} onChange={setFocus} />
            <IntensitySelector value={intensity} onChange={setIntensity} />

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
  streakContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  streakText: {
    fontFamily: typography.fontFamilyBold,
    fontSize: 14,
    color: palette.textPrimary,
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

  // Duration
  durationContainer: {
    marginBottom: 24,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 12,
  },
  durationValue: {
    fontFamily: typography.fontFamilyBold,
    fontSize: 14,
    color: palette.primary,
  },
  durationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  durationButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: palette.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.border,
    shadowColor: palette.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  durationButtonSelected: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
    transform: [{ scale: 1.1 }],
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  durationButtonText: {
    fontFamily: typography.fontFamilyBold,
    fontSize: 14,
    color: palette.textPrimary,
  },
  durationButtonTextSelected: {
    color: palette.textInverse,
  },

  // Equipment
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
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

  // Intensity
  intensityContainer: {
    flexDirection: 'row',
    backgroundColor: palette.cardSecondary,
    padding: 4,
    borderRadius: 99,
  },
  intensityButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 99,
  },
  intensityButtonSelected: {
    backgroundColor: palette.card,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  intensityText: {
    fontFamily: typography.fontFamilyBold,
    fontSize: 13,
    color: palette.textMuted,
  },
  intensityTextSelected: {
    color: palette.primary,
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
