import React, { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { WorkoutExerciseLog, WorkoutSetLog } from '@workout-agent/shared';
import { workoutRepository } from './db/repositories/WorkoutRepository';
import { RootStackParamList } from './navigation';
import { SetRow } from './components/SetRow';
import { palette, typography, layout } from './theme';
import { Button } from './components/DesignSystem';

type ActiveWorkoutNavigation = NativeStackNavigationProp<
  RootStackParamList,
  'ActiveWorkout'
>;

type ActiveWorkoutRoute = RouteProp<RootStackParamList, 'ActiveWorkout'>;

type LastPerformance = {
  completedAt: string;
  sets: WorkoutSetLog[];
};

const formatSetSummary = (setLog: WorkoutSetLog): string => {
  const parts: string[] = [];
  if (setLog.weight !== undefined) {
    parts.push(`${setLog.weight} ${setLog.weightUnit ?? 'lb'}`);
  }
  if (setLog.reps !== undefined) {
    parts.push(`${setLog.reps} reps`);
  }
  if (setLog.rpe !== undefined) {
    parts.push(`RPE ${setLog.rpe}`);
  }
  return parts.join(' • ');
};

const formatLastPerformance = (
  performance: LastPerformance | null
): string | null => {
  if (!performance || performance.sets.length === 0) {
    return null;
  }
  const summary = formatSetSummary(performance.sets[0]);
  if (!summary) {
    return null;
  }
  const countLabel =
    performance.sets.length > 1 ? `${performance.sets.length} sets` : '1 set';
  return `${summary} • ${countLabel}`;
};

export const ActiveWorkoutScreen = () => {
  const navigation = useNavigation<ActiveWorkoutNavigation>();
  const route = useRoute<ActiveWorkoutRoute>();
  const { plan } = route.params;

  const [durationSeconds, setDurationSeconds] = useState(0);
  const [exerciseLogs, setExerciseLogs] = useState<WorkoutExerciseLog[]>([]);
  const [lastPerformances, setLastPerformances] = useState<
    Record<string, LastPerformance | null>
  >({});
  const [expandedExercises, setExpandedExercises] = useState<
    Record<string, boolean>
  >({});
  const [workoutId, setWorkoutId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = React.useRef(false);

  useEffect(() => {
    isSubmittingRef.current = isSubmitting;
  }, [isSubmitting]);

  useEffect(() => {
    const timer = setInterval(() => {
      setDurationSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadWorkout = async () => {
      try {
        const workout = await workoutRepository.getWorkoutByPlanId(plan.id);
        if (!workout) {
          setLoading(false);
          return;
        }

        if (cancelled) {
          return;
        }

        setWorkoutId(workout.id);
        await workoutRepository.ensureSetsForWorkout(workout.id);
        const logs = await workoutRepository.listExerciseLogsByWorkoutId(
          workout.id
        );

        if (cancelled) {
          return;
        }

        setExerciseLogs(logs);
        const performanceEntries = await Promise.all(
          logs.map(async (exercise) => {
            const performance =
              await workoutRepository.getLastExercisePerformance(
                exercise.name,
                {
                  excludeWorkoutId: workout.id,
                }
              );
            return [exercise.id, performance] as const;
          })
        );

        if (cancelled) {
          return;
        }

        setLastPerformances(Object.fromEntries(performanceEntries));
      } catch (error) {
        console.error('Failed to load active workout data', error);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadWorkout();

    return () => {
      cancelled = true;
    };
  }, [plan.id]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (isSubmittingRef.current) {
        return;
      }

      e.preventDefault();

      Alert.alert(
        'End workout?',
        'If you leave now, your progress will be lost. Are you sure?',
        [
          { text: 'Stay', style: 'cancel' },
          {
            text: 'End Session',
            style: 'destructive',
            onPress: () => navigation.dispatch(e.data.action),
          },
        ]
      );
    });

    return unsubscribe;
  }, [navigation]);

  const refreshExerciseLogs = async () => {
    if (!workoutId) {
      return;
    }
    const logs = await workoutRepository.listExerciseLogsByWorkoutId(workoutId);
    setExerciseLogs(logs);
  };

  const updateExerciseLogs = (
    updater: (prev: WorkoutExerciseLog[]) => WorkoutExerciseLog[]
  ) => {
    setExerciseLogs((prev) => updater(prev));
  };

  const toggleExerciseExpanded = (exerciseId: string) => {
    setExpandedExercises((prev) => ({
      ...prev,
      [exerciseId]: !prev[exerciseId],
    }));
  };

  const handleExerciseToggle = async (exerciseId: string) => {
    const exercise = exerciseLogs.find((item) => item.id === exerciseId);
    if (!exercise) {
      return;
    }
    const shouldComplete = !exercise.sets.every((setLog) => setLog.completed);

    updateExerciseLogs((prev) =>
      prev.map((item) =>
        item.id === exerciseId
          ? {
              ...item,
              sets: item.sets.map((setLog) => ({
                ...setLog,
                completed: shouldComplete,
              })),
            }
          : item
      )
    );

    await Promise.all(
      exercise.sets.map((setLog) =>
        workoutRepository.updateSetById(setLog.id, {
          completed: shouldComplete,
        })
      )
    );
  };

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
    updateExerciseLogs((prev) =>
      prev.map((exercise) => ({
        ...exercise,
        sets: exercise.sets.map((setLog) => {
          if (setLog.id !== setId) {
            return setLog;
          }
          return {
            ...setLog,
            ...Object.fromEntries(
              Object.entries(updates)
                .filter(([, value]) => value !== undefined)
                .map(([key, value]) => [
                  key,
                  value === null ? undefined : value,
                ])
            ),
          } as WorkoutSetLog;
        }),
      }))
    );

    await workoutRepository.updateSetById(setId, updates);
  };

  const handleAddSet = async (exerciseId: string) => {
    await workoutRepository.addSetForExercise(exerciseId);
    await refreshExerciseLogs();
  };

  const handleRemoveSet = async (setId: string) => {
    await workoutRepository.removeSetById(setId);
    await refreshExerciseLogs();
  };

  const formatTime = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleFinish = () => {
    const totalSets = exerciseLogs.reduce(
      (acc, exercise) => acc + exercise.sets.length,
      0
    );
    const completedSets = exerciseLogs.reduce(
      (acc, exercise) =>
        acc + exercise.sets.filter((setLog) => setLog.completed).length,
      0
    );

    const message =
      completedSets < totalSets
        ? `You have ${totalSets - completedSets} sets left. Finish anyway?`
        : 'Great job! Ready to log this workout?';

    Alert.alert('Finish Workout?', message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Finish',
        style: 'default',
        onPress: async () => {
          if (!workoutId) {
            Alert.alert(
              'Error',
              'Unable to locate this workout. Please try again.'
            );
            return;
          }
          try {
            isSubmittingRef.current = true;
            setIsSubmitting(true);
            await workoutRepository.completeWorkoutById(
              workoutId,
              durationSeconds
            );
            navigation.reset({
              index: 0,
              routes: [{ name: 'Home' }],
            });
          } catch (error) {
            console.error('Failed to finish workout', error);
            Alert.alert('Error', 'Failed to save workout. Please try again.');
            setIsSubmitting(false);
          }
        },
      },
    ]);
  };

  const handleCancel = () => {
    Alert.alert(
      'End workout?',
      'If you leave now, your progress will be lost. Are you sure?',
      [
        { text: 'Stay', style: 'cancel' },
        {
          text: 'End Session',
          style: 'destructive',
          onPress: () => {
            // Allow navigation without the beforeRemove prompt
            isSubmittingRef.current = true;
            navigation.reset({
              index: 0,
              routes: [{ name: 'Home' }],
            });
          },
        },
      ]
    );
  };

  const groupedBlocks = useMemo(() => {
    const grouped = new Map<
      string,
      {
        id: string;
        title: string;
        focus?: string;
        order: number;
        exercises: WorkoutExerciseLog[];
      }
    >();

    exerciseLogs.forEach((exercise) => {
      const blockKey = exercise.blockId ?? `${exercise.blockOrder ?? 0}`;
      const existing = grouped.get(blockKey);
      const order = exercise.blockOrder ?? 0;
      const title = exercise.blockTitle ?? exercise.blockFocus ?? plan.focus;
      if (!existing) {
        grouped.set(blockKey, {
          id: blockKey,
          title,
          focus: exercise.blockFocus,
          order,
          exercises: [exercise],
        });
      } else {
        existing.exercises.push(exercise);
      }
    });

    return Array.from(grouped.values()).sort((a, b) => a.order - b.order);
  }, [exerciseLogs, plan.focus]);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.timerText}>{formatTime(durationSeconds)}</Text>
        </View>
        <View style={styles.headerActions}>
          <Button
            label="Cancel"
            onPress={handleCancel}
            variant="secondary"
            style={styles.headerButton}
          />
          <Button
            label="Finish"
            onPress={handleFinish}
            variant="secondary"
            style={styles.headerButton}
          />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.planTitle}>{plan.focus}</Text>

        {loading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator color={palette.primary} />
            <Text style={styles.loadingText}>Preparing your sets…</Text>
          </View>
        ) : groupedBlocks.length === 0 ? (
          <Text style={styles.emptyText}>No exercises available.</Text>
        ) : (
          groupedBlocks.map((block) => (
            <View key={block.id} style={styles.blockCard}>
              <Text style={styles.blockTitle}>{block.title}</Text>
              <View style={styles.exerciseList}>
                {block.exercises.map((exercise) => (
                  <ExerciseLogCard
                    key={exercise.id}
                    exercise={exercise}
                    lastPerformance={lastPerformances[exercise.id] ?? null}
                    isExpanded={expandedExercises[exercise.id] ?? false}
                    onToggleExpanded={() => toggleExerciseExpanded(exercise.id)}
                    onToggleExercise={() => handleExerciseToggle(exercise.id)}
                    onToggleSet={(setLog) =>
                      handleSetUpdate(setLog.id, {
                        completed: !setLog.completed,
                      })
                    }
                    onUpdateSet={(setId, updates) =>
                      handleSetUpdate(setId, updates)
                    }
                    onAddSet={() => handleAddSet(exercise.id)}
                    onRemoveSet={(setId) => handleRemoveSet(setId)}
                  />
                ))}
              </View>
            </View>
          ))
        )}

        <View style={styles.footerSpacer} />
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label="Complete Workout"
          onPress={handleFinish}
          variant="primary"
        />
      </View>
    </View>
  );
};

type ExerciseLogCardProps = {
  exercise: WorkoutExerciseLog;
  lastPerformance: LastPerformance | null;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  onToggleExercise: () => void;
  onToggleSet: (setLog: WorkoutSetLog) => void;
  onUpdateSet: (
    setId: string,
    updates: {
      reps?: number | null;
      weight?: number | null;
      weightUnit?: WorkoutSetLog['weightUnit'] | null;
      rpe?: number | null;
    }
  ) => void;
  onAddSet: () => void;
  onRemoveSet: (setId: string) => void;
};

const ExerciseLogCard = ({
  exercise,
  lastPerformance,
  isExpanded,
  onToggleExpanded,
  onToggleExercise,
  onToggleSet,
  onUpdateSet,
  onAddSet,
  onRemoveSet,
}: ExerciseLogCardProps) => {
  const lastSummary = formatLastPerformance(lastPerformance);
  const isCompleted = exercise.sets.every((setLog) => setLog.completed);

  return (
    <View style={styles.exerciseCard}>
      <View style={styles.exerciseHeader}>
        <View style={styles.exerciseTitleRow}>
          <Text style={styles.exerciseName}>{exercise.name}</Text>
          {exercise.prescription ? (
            <Text style={styles.exercisePrescription}>
              {exercise.prescription}
            </Text>
          ) : null}
        </View>
        {lastSummary ? (
          <Text style={styles.exerciseLastTime}>Last time: {lastSummary}</Text>
        ) : null}
        {exercise.detail ? (
          <Text style={styles.exerciseDetail}>{exercise.detail}</Text>
        ) : null}
      </View>

      <View style={styles.exerciseActions}>
        <Pressable
          onPress={onToggleExercise}
          style={[
            styles.exerciseCheckbox,
            isCompleted && styles.exerciseCheckboxChecked,
          ]}
        >
          {isCompleted && <Text style={styles.checkmark}>✓</Text>}
        </Pressable>
        <Text style={styles.exerciseActionLabel}>Done</Text>
        <Pressable
          onPress={onToggleExpanded}
          style={({ pressed }) => [
            styles.expandButton,
            pressed && { opacity: 0.8 },
          ]}
        >
          <Text style={styles.expandButtonText}>
            {isExpanded ? 'Hide sets' : 'Log sets'}
          </Text>
        </Pressable>
      </View>

      {isExpanded ? (
        <View style={styles.setList}>
          {exercise.sets.map((setLog, index) => (
            <SetRow
              key={setLog.id}
              index={index}
              setLog={setLog}
              canRemove={exercise.sets.length > 1}
              onToggle={() => onToggleSet(setLog)}
              onUpdate={(updates) => onUpdateSet(setLog.id, updates)}
              onRemove={() => onRemoveSet(setLog.id)}
            />
          ))}
        </View>
      ) : null}

      {isExpanded ? (
        <Pressable
          onPress={onAddSet}
          style={({ pressed }) => [
            styles.addSetButton,
            pressed && { opacity: 0.8 },
          ]}
        >
          <Text style={styles.addSetText}>Add set</Text>
        </Pressable>
      ) : null}
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
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    backgroundColor: palette.background,
  },
  headerLeft: {
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  timerText: {
    color: palette.primary,
    fontSize: 32,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    fontFamily: typography.fontFamilyBold,
  },
  scrollContent: {
    padding: 20,
    gap: 24,
  },
  planTitle: {
    color: palette.textMuted,
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: -12,
    fontFamily: typography.fontFamilyBold,
  },
  loadingState: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: palette.textSecondary,
    fontFamily: typography.fontFamily,
  },
  emptyText: {
    color: palette.textMuted,
    textAlign: 'center',
    marginTop: 24,
    fontFamily: typography.fontFamily,
  },
  blockCard: {
    gap: 16,
  },
  blockTitle: {
    color: palette.textPrimary,
    fontSize: 20,
    fontWeight: '600',
    fontFamily: typography.fontFamilyExtraBold,
  },
  exerciseList: {
    backgroundColor: palette.card,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: palette.border,
  },
  exerciseCard: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  exerciseHeader: {
    gap: 6,
  },
  exerciseTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  exerciseName: {
    color: palette.textPrimary,
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    fontFamily: typography.fontFamilyBold,
  },
  exercisePrescription: {
    color: palette.textSecondary,
    fontSize: 13,
    fontFamily: typography.fontFamily,
  },
  exerciseDetail: {
    color: palette.textMuted,
    fontSize: 12,
    fontFamily: typography.fontFamily,
  },
  exerciseLastTime: {
    color: palette.primary,
    fontSize: 12,
    fontFamily: typography.fontFamily,
  },
  exerciseActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
  },
  exerciseCheckbox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: palette.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exerciseCheckboxChecked: {
    backgroundColor: palette.success,
    borderColor: palette.success,
  },
  checkmark: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  exerciseActionLabel: {
    color: palette.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    fontFamily: typography.fontFamilyBold,
  },
  expandButton: {
    marginLeft: 'auto',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.cardSecondary,
  },
  expandButtonText: {
    color: palette.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    fontFamily: typography.fontFamily,
  },
  setList: {
    marginTop: 12,
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
    fontFamily: typography.fontFamilyBold,
  },
  footerSpacer: {
    height: 100,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: 40,
    backgroundColor: palette.background,
    borderTopWidth: 1,
    borderTopColor: palette.border,
  },
});
