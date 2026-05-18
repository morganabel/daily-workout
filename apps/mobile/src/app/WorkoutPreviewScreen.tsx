import React, { useState, useCallback } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  useNavigation,
  useRoute,
  useFocusEffect,
} from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { TodayPlan, GenerationRequest } from '@workout-agent/shared';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from './navigation';
import { generateWorkout, type ApiError } from './services/api';
import { workoutRepository } from './db/repositories/WorkoutRepository';
import { CustomizeSheet } from './components/CustomizeSheet';
import { palette, typography, layout } from './theme';
import { Button, Card, Chip } from './components/DesignSystem';

type WorkoutPreviewNavigation = NativeStackNavigationProp<
  RootStackParamList,
  'WorkoutPreview'
>;

type WorkoutPreviewRoute = RouteProp<RootStackParamList, 'WorkoutPreview'>;

export const WorkoutPreviewScreen = () => {
  const navigation = useNavigation<WorkoutPreviewNavigation>();
  const route = useRoute<WorkoutPreviewRoute>();
  const [regenerating, setRegenerating] = useState(false);
  const [customizeSheetVisible, setCustomizeSheetVisible] = useState(false);
  const [plan, setPlan] = useState<TodayPlan | null>(
    route.params?.plan ?? null
  );

  // Refresh plan from DB when screen is focused to ensure we have the latest
  useFocusEffect(
    useCallback(() => {
      const refreshPlan = async () => {
        try {
          const workout = await workoutRepository.getTodayWorkout();
          if (workout) {
            const latestPlan = await workoutRepository.mapWorkoutToPlan(
              workout
            );
            setPlan(latestPlan);
          }
        } catch (error) {
          console.error('Failed to refresh plan:', error);
          // If refresh fails, keep the current plan (from route params or state)
        }
      };
      void refreshPlan();
    }, [])
  );

  if (!plan) {
    return (
      <View style={styles.screen}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.goBack()}
            style={({ pressed }) => [
              styles.backButton,
              pressed && { opacity: 0.8 },
            ]}
          >
            <Text style={styles.backButtonText}>‹ Back</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Preview workout</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No workout selected</Text>
          <Text style={styles.emptyText}>
            Generate or choose a workout before opening the preview.
          </Text>
          <Button
            label="Back to home"
            onPress={() => navigation.navigate('Home')}
            variant="primary"
          />
        </View>
      </View>
    );
  }

  const equipmentList = plan.equipment.join(' • ');
  const sourceLabel = plan.source === 'ai' ? 'AI generated' : 'Manual entry';

  const handleDiscard = () => {
    Alert.alert(
      'Discard Workout',
      'Are you sure you want to discard this workout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: async () => {
            await workoutRepository.discardPlannedWorkout();
            navigation.navigate('Home');
          },
        },
      ]
    );
  };

  const handleRegenerate = async (request: GenerationRequest) => {
    if (regenerating) return;

    setRegenerating(true);
    setCustomizeSheetVisible(false);

    try {
      console.log('Regenerating workout with request:', request);
      const newPlan = await generateWorkout(request);
      setPlan(newPlan);
      console.log('New workout plan loaded');
    } catch (err) {
      const apiError = err as ApiError;
      console.error('Failed to regenerate workout:', apiError);
      Alert.alert(
        'Something went wrong',
        apiError.message ||
          'We could not create a new workout. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [
            styles.backButton,
            pressed && { opacity: 0.8 },
          ]}
        >
          <Text style={styles.backButtonText}>‹ Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Preview workout</Text>
        <View style={styles.headerSpacer} />
      </View>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Card style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>Today's workout</Text>
          <Text style={styles.heroTitle}>{plan.focus}</Text>
          <Text style={styles.heroMeta}>
            {plan.durationMinutes} min · {equipmentList}
          </Text>
          <View style={styles.badgeRow}>
            <Chip label={sourceLabel} />
            <Chip label={`Energy: ${plan.energy}`} />
          </View>
          {plan.summary && (
            <Text style={styles.heroSummary}>{plan.summary}</Text>
          )}
        </Card>

        {plan.blocks.map((block) => (
          <View key={block.id} style={styles.blockCard}>
            <View style={styles.blockHeader}>
              <View style={styles.blockHeaderText}>
                <Text style={styles.blockTitle}>{block.title}</Text>
                <Text style={styles.blockFocus}>{block.focus}</Text>
              </View>
              <Text style={styles.blockDuration}>
                {block.durationMinutes} min
              </Text>
            </View>
            <View style={styles.exerciseList}>
              {block.exercises.map((exercise) => (
                <View key={exercise.id} style={styles.exerciseRow}>
                  <View style={styles.exerciseBullet} />
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

        <View style={styles.footer}>
          <Text style={styles.footerHint}>
            Ready to go? Starting the workout will track your time and let you
            log sets.
          </Text>
          <Button
            label="Start workout"
            onPress={() => navigation.navigate('ActiveWorkout', { plan })}
            loading={regenerating}
            variant="primary"
          />
          {plan.source === 'ai' && (
            <Button
              label="Not quite right? Customize"
              onPress={() => setCustomizeSheetVisible(true)}
              disabled={regenerating}
              variant="outline"
            />
          )}
          <Button
            label="Discard workout"
            onPress={handleDiscard}
            disabled={regenerating}
            variant="ghost"
            icon={
              <Ionicons
                name="trash-outline"
                size={18}
                color={palette.textSecondary}
              />
            }
          />
        </View>
      </ScrollView>
      <CustomizeSheet
        visible={customizeSheetVisible}
        currentPlan={plan}
        loading={regenerating}
        onSubmit={handleRegenerate}
        onClose={() => setCustomizeSheetVisible(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    paddingTop: layout.safeAreaTop,
  },
  backButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
  },
  backButtonText: {
    color: palette.textPrimary,
    fontSize: 16,
    fontFamily: typography.fontFamilyBold,
  },
  headerTitle: {
    color: palette.textPrimary,
    fontSize: 18,
    fontFamily: typography.fontFamilyBold,
  },
  headerSpacer: {
    width: 60,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 14,
  },
  emptyTitle: {
    color: palette.textPrimary,
    fontSize: 24,
    fontFamily: typography.fontFamilyExtraBold,
  },
  emptyText: {
    color: palette.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    fontFamily: typography.fontFamily,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 16,
    paddingTop: 20,
  },
  heroCard: {
    gap: 12,
  },
  heroEyebrow: {
    color: palette.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontSize: 12,
    fontFamily: typography.fontFamilyBold,
  },
  heroTitle: {
    color: palette.textPrimary,
    fontSize: 26,
    fontFamily: typography.fontFamilyExtraBold,
  },
  heroMeta: {
    color: palette.textSecondary,
    fontSize: 16,
    fontFamily: typography.fontFamily,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  heroSummary: {
    color: palette.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    fontFamily: typography.fontFamily,
  },
  blockCard: {
    backgroundColor: palette.cardSecondary,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: palette.border,
    gap: 16,
  },
  blockHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: 8,
  },
  blockHeaderText: {
    flex: 1,
    paddingRight: 12,
  },
  blockTitle: {
    color: palette.textPrimary,
    fontSize: 18,
    fontFamily: typography.fontFamilyBold,
    flexShrink: 1,
  },
  blockFocus: {
    color: palette.textMuted,
    fontSize: 13,
    marginTop: 4,
    fontFamily: typography.fontFamily,
  },
  blockDuration: {
    color: palette.textPrimary,
    fontSize: 14,
    fontFamily: typography.fontFamilyBold,
    alignSelf: 'flex-start',
  },
  exerciseList: {
    gap: 12,
  },
  exerciseRow: {
    flexDirection: 'row',
    gap: 12,
  },
  exerciseBullet: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: palette.primary,
    marginTop: 6,
  },
  exerciseBody: {
    flex: 1,
    gap: 4,
  },
  exerciseName: {
    color: palette.textPrimary,
    fontSize: 15,
    fontFamily: typography.fontFamilyBold,
  },
  exercisePrescription: {
    color: palette.textSecondary,
    fontSize: 14,
    fontFamily: typography.fontFamily,
  },
  exerciseDetail: {
    color: palette.textMuted,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: typography.fontFamily,
  },
  footer: {
    marginTop: 8,
    gap: 12,
    backgroundColor: palette.cardSecondary,
    padding: 20,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.border,
  },
  footerHint: {
    color: palette.textMuted,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: typography.fontFamily,
  },
  feedbackToggle: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  feedbackToggleText: {
    color: palette.primary,
    fontSize: 14,
    fontFamily: typography.fontFamilyBold,
  },
});
