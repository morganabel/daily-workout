import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type {
  WorkoutSessionDetail,
  WorkoutSetLog,
} from '@workout-agent/shared';
import { getActiveRepositories } from './db/activeDatabase';
import type { RootStackParamList } from './navigation';
import { SetRow } from './components/SetRow';
import { palette, typography, layout } from './theme';
import { Card } from './components/DesignSystem';

type SessionDetailRoute = RouteProp<RootStackParamList, 'WorkoutSessionDetail'>;

type SessionDetailNav = NativeStackNavigationProp<
  RootStackParamList,
  'WorkoutSessionDetail'
>;

export const WorkoutSessionDetailScreen = () => {
  const repositories = getActiveRepositories();
  const route = useRoute<SessionDetailRoute>();
  const navigation = useNavigation<SessionDetailNav>();
  const { workoutId } = route.params;

  const [sessionDetail, setSessionDetail] =
    useState<WorkoutSessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);

  const refreshSession = async () => {
    const detail = await repositories.workout.getSessionDetailById(workoutId);
    setSessionDetail(detail);
  };

  useEffect(() => {
    let cancelled = false;
    const loadSession = async () => {
      try {
        const detail = await repositories.workout.getSessionDetailById(
          workoutId
        );
        if (!cancelled) {
          setSessionDetail(detail);
        }
      } catch (error) {
        console.error('Failed to load session detail', error);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadSession();

    return () => {
      cancelled = true;
    };
  }, [repositories.workout, workoutId]);

  const handleSetUpdate = async (
    setId: string,
    updates: {
      reps?: number | null;
      weight?: number | null;
      weightUnit?: WorkoutSetLog['weightUnit'] | null;
      rpe?: number | null;
      completed?: boolean;
    }
  ) => {
    await repositories.workout.updateSetById(setId, updates);
    await refreshSession();
  };

  const handleAddSet = async (exerciseId: string) => {
    await repositories.workout.addSetForExercise(exerciseId);
    await refreshSession();
  };

  const handleRemoveSet = async (setId: string) => {
    await repositories.workout.removeSetById(setId);
    await refreshSession();
  };

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator color={palette.primary} />
        <Text style={styles.loadingText}>Loading session…</Text>
      </View>
    );
  }

  if (!sessionDetail) {
    return (
      <View style={styles.loadingScreen}>
        <Text style={styles.loadingText}>Session not found.</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={20} color={palette.textSecondary} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.title}>{sessionDetail.name}</Text>
          <Text style={styles.subtitle}>{sessionDetail.focus}</Text>
        </View>
        <Pressable
          style={({ pressed }) => [
            styles.editButton,
            pressed && { opacity: 0.8 },
          ]}
          onPress={() => setIsEditing((prev) => !prev)}
        >
          <Text style={styles.editButtonText}>
            {isEditing ? 'Done' : 'Edit'}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.metaText}>
          {new Date(sessionDetail.completedAt).toLocaleDateString()} •{' '}
          {sessionDetail.durationMinutes} min
        </Text>

        {sessionDetail.exercises.map((exercise) => (
          <Card key={exercise.id} style={styles.exerciseCard}>
            <View style={styles.exerciseHeader}>
              <Text style={styles.exerciseName}>{exercise.name}</Text>
              {exercise.prescription ? (
                <Text style={styles.exercisePrescription}>
                  {exercise.prescription}
                </Text>
              ) : null}
            </View>
            {exercise.detail ? (
              <Text style={styles.exerciseDetail}>{exercise.detail}</Text>
            ) : null}

            <View style={styles.setList}>
              {exercise.sets.map((setLog, index) => (
                <SetRow
                  key={setLog.id}
                  index={index}
                  setLog={setLog}
                  canRemove={isEditing && exercise.sets.length > 1}
                  isEditing={isEditing}
                  onToggle={() =>
                    handleSetUpdate(setLog.id, { completed: !setLog.completed })
                  }
                  onUpdate={(updates) => handleSetUpdate(setLog.id, updates)}
                  onRemove={() => handleRemoveSet(setLog.id)}
                />
              ))}
            </View>

            {isEditing ? (
              <Pressable
                onPress={() => handleAddSet(exercise.id)}
                style={({ pressed }) => [
                  styles.addSetButton,
                  pressed && { opacity: 0.8 },
                ]}
              >
                <Text style={styles.addSetText}>Add set</Text>
              </Pressable>
            ) : null}
          </Card>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.background,
  },
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: palette.background,
  },
  loadingText: {
    color: palette.textSecondary,
    fontFamily: typography.fontFamily,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: layout.safeAreaTop,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    backgroundColor: palette.background,
    gap: 12,
  },
  backButton: {
    padding: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.cardSecondary,
  },
  headerText: {
    flex: 1,
  },
  title: {
    color: palette.textPrimary,
    fontSize: 18,
    fontFamily: typography.fontFamilyBold,
  },
  subtitle: {
    color: palette.textMuted,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontFamily: typography.fontFamilyBold,
  },
  editButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.cardSecondary,
  },
  editButtonText: {
    color: palette.textSecondary,
    fontWeight: '600',
    fontSize: 12,
    fontFamily: typography.fontFamily,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 120,
    gap: 16,
  },
  metaText: {
    color: palette.textSecondary,
    fontSize: 13,
    fontFamily: typography.fontFamily,
  },
  exerciseCard: {
    gap: 8,
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  exerciseName: {
    color: palette.textPrimary,
    fontSize: 16,
    fontFamily: typography.fontFamilyBold,
    flex: 1,
  },
  exercisePrescription: {
    color: palette.textSecondary,
    fontSize: 12,
    fontFamily: typography.fontFamily,
    flexShrink: 0,
    textAlign: 'right',
    maxWidth: '40%',
  },
  exerciseDetail: {
    color: palette.textMuted,
    fontSize: 12,
    fontFamily: typography.fontFamily,
  },
  setList: {
    marginTop: 8,
    gap: 10,
  },
  addSetButton: {
    marginTop: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
    backgroundColor: palette.cardSecondary,
  },
  addSetText: {
    color: palette.textSecondary,
    fontWeight: '600',
    fontSize: 13,
    fontFamily: typography.fontFamily,
  },
});
