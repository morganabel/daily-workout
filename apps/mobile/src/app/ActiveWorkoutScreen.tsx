import React, { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Alert,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { WorkoutExerciseLog, WorkoutSetLog } from '@workout-agent/shared';
import { workoutRepository } from './db/repositories/WorkoutRepository';
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
  success: '#4ade80',
  destructive: '#ff6b6b',
};

type ActiveWorkoutNavigation = NativeStackNavigationProp<
  RootStackParamList,
  'ActiveWorkout'
>;

type ActiveWorkoutRoute = RouteProp<RootStackParamList, 'ActiveWorkout'>;

type LastPerformance = {
  completedAt: string;
  sets: WorkoutSetLog[];
};

const parseOptionalNumber = (
  value: string,
  allowFloat = false
): number | null => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = allowFloat
    ? Number.parseFloat(trimmed)
    : Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return parsed;
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
      completedSets > 0 && completedSets < totalSets
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
          <Pressable
            onPress={handleCancel}
            style={({ pressed }) => [
              styles.cancelButtonHeader,
              pressed && { opacity: 0.8 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Cancel workout"
            accessibilityHint="Leave without logging this workout"
          >
            <Text style={styles.cancelButtonHeaderText}>Cancel</Text>
          </Pressable>
          <Pressable
            onPress={handleFinish}
            style={({ pressed }) => [
              styles.finishButtonHeader,
              pressed && { opacity: 0.8 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Finish workout"
            accessibilityHint="Completes the current workout session"
          >
            <Text style={styles.finishButtonHeaderText}>Finish</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.planTitle}>{plan.focus}</Text>

        {loading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator color={palette.accent} />
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
        <Pressable
          onPress={handleFinish}
          style={({ pressed }) => [
            styles.finishButton,
            pressed && { opacity: 0.9 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Complete Workout"
          accessibilityHint="Saves your progress and finishes the session"
        >
          <Text style={styles.finishButtonText}>Complete Workout</Text>
        </Pressable>
      </View>
    </View>
  );
};

type ExerciseLogCardProps = {
  exercise: WorkoutExerciseLog;
  lastPerformance: LastPerformance | null;
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
  onToggleSet,
  onUpdateSet,
  onAddSet,
  onRemoveSet,
}: ExerciseLogCardProps) => {
  const lastSummary = formatLastPerformance(lastPerformance);

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

      <Pressable
        onPress={onAddSet}
        style={({ pressed }) => [
          styles.addSetButton,
          pressed && { opacity: 0.8 },
        ]}
      >
        <Text style={styles.addSetText}>Add set</Text>
      </Pressable>
    </View>
  );
};

type SetRowProps = {
  index: number;
  setLog: WorkoutSetLog;
  canRemove: boolean;
  onToggle: () => void;
  onUpdate: (updates: {
    reps?: number | null;
    weight?: number | null;
    weightUnit?: WorkoutSetLog['weightUnit'] | null;
    rpe?: number | null;
  }) => void;
  onRemove: () => void;
};

const SetRow = ({
  index,
  setLog,
  canRemove,
  onToggle,
  onUpdate,
  onRemove,
}: SetRowProps) => {
  const weightUnit = setLog.weightUnit ?? 'lb';

  const handleWeightChange = (value: string) => {
    const weight = parseOptionalNumber(value, true);
    const updates: {
      weight?: number | null;
      weightUnit?: WorkoutSetLog['weightUnit'] | null;
    } = {
      weight,
    };
    if (weight !== null && setLog.weightUnit === undefined) {
      updates.weightUnit = 'lb';
    }
    onUpdate(updates);
  };

  const handleRepsChange = (value: string) => {
    onUpdate({ reps: parseOptionalNumber(value) });
  };

  const handleRpeChange = (value: string) => {
    const rpe = parseOptionalNumber(value);
    onUpdate({ rpe });
  };

  return (
    <View style={styles.setRow}>
      <Pressable
        onPress={onToggle}
        style={[
          styles.setCheckbox,
          setLog.completed && styles.setCheckboxChecked,
        ]}
      >
        {setLog.completed && <Text style={styles.checkmark}>✓</Text>}
      </Pressable>
      <Text style={styles.setLabel}>Set {index + 1}</Text>
      <View style={styles.setInputs}>
        <TextInput
          value={setLog.weight !== undefined ? `${setLog.weight}` : ''}
          onChangeText={handleWeightChange}
          placeholder="Wt"
          placeholderTextColor={palette.textMuted}
          keyboardType="decimal-pad"
          style={styles.setInput}
        />
        <Pressable
          onPress={() =>
            onUpdate({ weightUnit: weightUnit === 'lb' ? 'kg' : 'lb' })
          }
          style={styles.unitToggle}
        >
          <Text style={styles.unitToggleText}>{weightUnit}</Text>
        </Pressable>
        <TextInput
          value={setLog.reps !== undefined ? `${setLog.reps}` : ''}
          onChangeText={handleRepsChange}
          placeholder="Reps"
          placeholderTextColor={palette.textMuted}
          keyboardType="number-pad"
          style={styles.setInput}
        />
        <TextInput
          value={setLog.rpe !== undefined ? `${setLog.rpe}` : ''}
          onChangeText={handleRpeChange}
          placeholder="RPE"
          placeholderTextColor={palette.textMuted}
          keyboardType="number-pad"
          style={styles.setInput}
        />
      </View>
      {canRemove ? (
        <Pressable onPress={onRemove} style={styles.removeSetButton}>
          <Text style={styles.removeSetText}>×</Text>
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
  timerText: {
    color: palette.accent,
    fontSize: 32,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  finishButtonHeader: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: palette.cardSecondary,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.border,
  },
  finishButtonHeaderText: {
    color: palette.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  cancelButtonHeader: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.cardSecondary,
  },
  cancelButtonHeaderText: {
    color: palette.textSecondary,
    fontSize: 14,
    fontWeight: '600',
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
  },
  loadingState: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: palette.textSecondary,
  },
  emptyText: {
    color: palette.textMuted,
    textAlign: 'center',
    marginTop: 24,
  },
  blockCard: {
    gap: 16,
  },
  blockTitle: {
    color: palette.textPrimary,
    fontSize: 20,
    fontWeight: '600',
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
  },
  exercisePrescription: {
    color: palette.textSecondary,
    fontSize: 13,
  },
  exerciseDetail: {
    color: palette.textMuted,
    fontSize: 12,
  },
  exerciseLastTime: {
    color: palette.accent,
    fontSize: 12,
  },
  setList: {
    marginTop: 12,
    gap: 10,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  setCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: palette.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setCheckboxChecked: {
    backgroundColor: palette.success,
    borderColor: palette.success,
  },
  checkmark: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 14,
  },
  setLabel: {
    color: palette.textSecondary,
    fontSize: 12,
    width: 50,
  },
  setInputs: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  setInput: {
    flex: 1,
    minWidth: 50,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    color: palette.textPrimary,
    backgroundColor: palette.cardSecondary,
  },
  unitToggle: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.cardSecondary,
  },
  unitToggleText: {
    color: palette.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  removeSetButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeSetText: {
    color: palette.destructive,
    fontSize: 16,
    fontWeight: '700',
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
  finishButton: {
    backgroundColor: palette.accent,
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
  },
  finishButtonText: {
    color: '#031b1b',
    fontSize: 18,
    fontWeight: '700',
  },
});
