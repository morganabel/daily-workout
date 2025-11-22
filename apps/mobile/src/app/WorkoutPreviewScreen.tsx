import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { TodayPlan } from '@workout-agent/shared';
import { createTodayPlanMock } from '@workout-agent/shared';
import { RootStackParamList } from './navigation';

const palette = {
  background: '#030914',
  card: '#0d1322',
  cardSecondary: '#111a30',
  border: '#1d2943',
  accent: '#6efacc',
  accentMuted: '#233746',
  textPrimary: '#f5f6fb',
  textSecondary: '#9cabc4',
  textMuted: '#5c6a85',
};

type WorkoutPreviewNavigation = NativeStackNavigationProp<
  RootStackParamList,
  'WorkoutPreview'
>;

type WorkoutPreviewRoute = RouteProp<RootStackParamList, 'WorkoutPreview'>;

export const WorkoutPreviewScreen = () => {
  const navigation = useNavigation<WorkoutPreviewNavigation>();
  const route = useRoute<WorkoutPreviewRoute>();

  // Get plan from route params, fallback to mock if not provided
  const plan: TodayPlan = route.params?.plan ?? createTodayPlanMock();

  const equipmentList = plan.equipment.join(' • ');
  const sourceLabel = plan.source === 'ai' ? 'AI generated' : 'Manual entry';

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
        <View style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>Today's workout</Text>
          <Text style={styles.heroTitle}>{plan.focus}</Text>
          <Text style={styles.heroMeta}>
            {plan.durationMinutes} min · {equipmentList}
          </Text>
          <View style={styles.badgeRow}>
            <Badge text={sourceLabel} />
            <Badge text={`Energy: ${plan.energy}`} variant="muted" />
          </View>
          {plan.summary && (
            <Text style={styles.heroSummary}>{plan.summary}</Text>
          )}
        </View>

        {plan.blocks.map((block) => (
          <View key={block.id} style={styles.blockCard}>
            <View style={styles.blockHeader}>
              <View style={styles.blockHeaderText}>
                <Text style={styles.blockTitle}>{block.title}</Text>
                <Text style={styles.blockFocus}>{block.focus}</Text>
              </View>
              <Text style={styles.blockDuration}>{block.durationMinutes} min</Text>
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
                      <Text style={styles.exerciseDetail}>{exercise.detail}</Text>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
          </View>
        ))}

        <View style={styles.footer}>
          <Text style={styles.footerHint}>
            Ready to go? Starting the workout will track your time and let you log sets.
          </Text>
          <PrimaryButton
            label="Start workout"
            onPress={() => navigation.navigate('ActiveWorkout', { plan })}
          />
        </View>
      </ScrollView>
    </View>
  );
};

const Badge = ({
  text,
  variant = 'default',
}: {
  text: string;
  variant?: 'default' | 'muted';
}) => (
  <View
    style={[
      styles.badge,
      variant === 'muted' && { backgroundColor: palette.accentMuted },
    ]}
  >
    <Text style={styles.badgeText}>{text}</Text>
  </View>
);

const PrimaryButton = ({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) => (
  <Pressable
    onPress={onPress}
    style={({ pressed }) => [
      styles.primaryButton,
      pressed && { opacity: 0.9 },
    ]}
  >
    <Text style={styles.primaryButtonText}>{label}</Text>
  </Pressable>
);

const DisabledButton = ({ label }: { label: string }) => (
  <View style={styles.disabledButton}>
    <Text style={styles.disabledButtonText}>{label}</Text>
  </View>
);

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
    fontWeight: '600',
  },
  headerTitle: {
    color: palette.textPrimary,
    fontSize: 18,
    fontWeight: '600',
  },
  headerSpacer: {
    width: 60,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 16,
  },
  heroCard: {
    backgroundColor: palette.card,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: palette.border,
    gap: 12,
  },
  heroEyebrow: {
    color: palette.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontSize: 12,
  },
  heroTitle: {
    color: palette.textPrimary,
    fontSize: 26,
    fontWeight: '600',
  },
  heroMeta: {
    color: palette.textSecondary,
    fontSize: 16,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: palette.accent,
    borderRadius: 999,
  },
  badgeText: {
    color: '#031b1b',
    fontSize: 13,
    fontWeight: '600',
  },
  heroSummary: {
    color: palette.textSecondary,
    fontSize: 15,
    lineHeight: 22,
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
    fontWeight: '600',
    flexShrink: 1,
  },
  blockFocus: {
    color: palette.textMuted,
    fontSize: 13,
    marginTop: 4,
  },
  blockDuration: {
    color: palette.textPrimary,
    fontSize: 14,
    fontWeight: '600',
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
    backgroundColor: palette.accent,
    marginTop: 6,
  },
  exerciseBody: {
    flex: 1,
    gap: 4,
  },
  exerciseName: {
    color: palette.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  exercisePrescription: {
    color: palette.textSecondary,
    fontSize: 14,
  },
  exerciseDetail: {
    color: palette.textMuted,
    fontSize: 13,
    lineHeight: 18,
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
  },
  disabledButton: {
    backgroundColor: palette.border,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  disabledButtonText: {
    color: palette.textSecondary,
    fontSize: 16,
    fontWeight: '600',
  },
  primaryButton: {
    backgroundColor: palette.accent,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#031b1b',
    fontSize: 16,
    fontWeight: '600',
  },
});
