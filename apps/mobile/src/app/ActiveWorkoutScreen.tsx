import React, { useEffect, useState, useCallback } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type {
  WorkoutBlock,
  WorkoutExercise,
  LogWorkoutRequest,
  WorkoutSessionSet,
  WeightUnit,
} from '@workout-agent/shared';
import { workoutRepository } from './db/repositories/WorkoutRepository';
import { userRepository } from './db/repositories/UserRepository';
import { logWorkout } from './services/api';
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
  error: '#f87171',
};

type ActiveWorkoutNavigation = NativeStackNavigationProp<
  RootStackParamList,
  'ActiveWorkout'
>;

type ActiveWorkoutRoute = RouteProp<RootStackParamList, 'ActiveWorkout'>;

interface SetState {
  order: number;
  reps: string;
  weight: string;
  rpe: string;
  completed: boolean;
  localId: string; // for React keys
}

interface ExerciseState {
  exerciseId: string;
  name: string;
  prescription: string;
  sets: SetState[];
  previousSets?: Array<{ reps?: number; weight?: number; unit?: WeightUnit }>;
}

export const ActiveWorkoutScreen = () => {
  const navigation = useNavigation<ActiveWorkoutNavigation>();
  const route = useRoute<ActiveWorkoutRoute>();
  const { plan } = route.params;

  const [preferredUnit, setPreferredUnit] = useState<WeightUnit>('kg');
  const [exercises, setExercises] = useState<ExerciseState[]>([]);
  const [startedAt, setStartedAt] = useState<number>(Date.now());
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const isSubmittingRef = React.useRef(false);

  useEffect(() => {
    isSubmittingRef.current = isSubmitting;
  }, [isSubmitting]);

  // Hydrate from DB on mount
  useEffect(() => {
    let isMounted = true;

    (async () => {
      try {
        // Get user preference
        const prefs = await userRepository.getPreferences();
        if (isMounted) {
          setPreferredUnit(prefs?.preferredWeightUnit ?? 'kg');
        }

        // Check if workout is already in-progress
        const workoutDetail = await workoutRepository.getWorkoutDetail(plan.id);
        
        if (workoutDetail && isMounted) {
          // Restore timer
          if (workoutDetail.workout.startedAt) {
            const elapsed = Math.floor((Date.now() - workoutDetail.workout.startedAt) / 1000);
            setStartedAt(workoutDetail.workout.startedAt);
            setDurationSeconds(elapsed);
          } else {
            // Start timer if not started
            const now = Date.now();
            setStartedAt(now);
            await workoutRepository.startWorkoutTimer(plan.id, now);
          }

          // Restore exercises and sets
          const restoredExercises: ExerciseState[] = [];
          for (const exercise of workoutDetail.exercises) {
            // Fetch previous workout data for this exercise
            const previousData = await workoutRepository.findLastCompletedExerciseByName(exercise.name);
            const previousSets = previousData?.sets;

            const sets: SetState[] = exercise.sets.length > 0
              ? exercise.sets.map((set, idx) => ({
                  order: set.order ?? idx,
                  reps: set.reps?.toString() ?? '',
                  weight: set.weight?.toString() ?? '',
                  rpe: set.rpe?.toString() ?? '',
                  completed: set.completed ?? false,
                  localId: `${exercise.id}-${idx}`,
                }))
              : [
                  {
                    order: 0,
                    reps: '',
                    weight: '',
                    rpe: '',
                    completed: false,
                    localId: `${exercise.id}-0`,
                  },
                ];

            restoredExercises.push({
              exerciseId: exercise.id,
              name: exercise.name,
              prescription: exercise.prescription ?? '',
              sets,
              previousSets,
            });
          }
          setExercises(restoredExercises);
        } else if (isMounted) {
          // Fresh workout - initialize exercises with one empty set each
          const now = Date.now();
          setStartedAt(now);
          await workoutRepository.startWorkoutTimer(plan.id, now);

          const initialExercises: ExerciseState[] = [];
          for (const block of plan.blocks) {
            for (const exercise of block.exercises) {
              // Fetch previous workout data
              const previousData = await workoutRepository.findLastCompletedExerciseByName(exercise.name);
              const previousSets = previousData?.sets;

              initialExercises.push({
                exerciseId: exercise.id,
                name: exercise.name,
                prescription: exercise.prescription ?? '',
                sets: [
                  {
                    order: 0,
                    reps: '',
                    weight: '',
                    rpe: '',
                    completed: false,
                    localId: `${exercise.id}-0`,
                  },
                ],
                previousSets,
              });
            }
          }
          setExercises(initialExercises);
        }
      } catch (error) {
        console.error('Failed to hydrate workout state', error);
        Alert.alert('Error', 'Failed to load workout data. Please try again.');
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [plan]);

  // Timer tick
  useEffect(() => {
    const timer = setInterval(() => {
      setDurationSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Prevent navigation away without confirmation
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

  const formatTime = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Persist sets to DB
  const persistSets = useCallback(
    async (exerciseId: string, sets: SetState[]) => {
      try {
        await workoutRepository.replaceSetsForExercise(
          exerciseId,
          sets.map((set) => ({
            order: set.order,
            reps: set.reps ? parseInt(set.reps, 10) : undefined,
            weight: set.weight ? parseFloat(set.weight) : undefined,
            weightUnit: set.weight ? preferredUnit : undefined,
            rpe: set.rpe ? parseInt(set.rpe, 10) : undefined,
            completed: set.completed,
          }))
        );
      } catch (error) {
        console.error('Failed to persist sets', error);
      }
    },
    [preferredUnit]
  );

  const updateSet = useCallback(
    (exerciseIdx: number, setIdx: number, field: keyof SetState, value: string | boolean) => {
      setExercises((prev) => {
        const next = [...prev];
        const exercise = { ...next[exerciseIdx] };
        const sets = [...exercise.sets];
        sets[setIdx] = { ...sets[setIdx], [field]: value };
        exercise.sets = sets;
        next[exerciseIdx] = exercise;

        // Persist asynchronously
        persistSets(exercise.exerciseId, sets);

        return next;
      });
    },
    [persistSets]
  );

  const addSet = useCallback(
    (exerciseIdx: number) => {
      setExercises((prev) => {
        const next = [...prev];
        const exercise = { ...next[exerciseIdx] };
        const sets = [...exercise.sets];
        const newOrder = sets.length;
        sets.push({
          order: newOrder,
          reps: '',
          weight: '',
          rpe: '',
          completed: false,
          localId: `${exercise.exerciseId}-${newOrder}`,
        });
        exercise.sets = sets;
        next[exerciseIdx] = exercise;

        // Persist asynchronously
        persistSets(exercise.exerciseId, sets);

        return next;
      });
    },
    [persistSets]
  );

  const removeSet = useCallback(
    (exerciseIdx: number, setIdx: number) => {
      setExercises((prev) => {
        const next = [...prev];
        const exercise = { ...next[exerciseIdx] };
        const sets = [...exercise.sets];
        if (sets.length === 1) {
          Alert.alert('Cannot remove', 'At least one set is required.');
          return prev;
        }
        sets.splice(setIdx, 1);
        // Reorder
        sets.forEach((s, idx) => {
          s.order = idx;
        });
        exercise.sets = sets;
        next[exerciseIdx] = exercise;

        // Persist asynchronously
        persistSets(exercise.exerciseId, sets);

        return next;
      });
    },
    [persistSets]
  );

  const handleFinish = useCallback(async () => {
    const totalSets = exercises.reduce((acc, ex) => acc + ex.sets.length, 0);
    const completedSets = exercises.reduce(
      (acc, ex) => acc + ex.sets.filter((s) => s.completed).length,
      0
    );
    const uncompletedCount = totalSets - completedSets;

    const message =
      uncompletedCount > 0
        ? `You have ${uncompletedCount} uncompleted sets. Finish anyway?`
        : 'Great job! Ready to log this workout?';

    Alert.alert('Finish Workout?', message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Finish',
        style: 'default',
        onPress: async () => {
          try {
            setIsSubmitting(true);

            const durationMinutes = Math.floor(durationSeconds / 60);

            // Build detailed payload
            const sessionExercises = exercises.map((ex) => ({
              exerciseId: ex.exerciseId,
              name: ex.name,
              sets: ex.sets.map((s) => {
                const set: WorkoutSessionSet = {
                  order: s.order,
                  completed: s.completed,
                };
                if (s.reps) {
                  set.reps = parseInt(s.reps, 10);
                }
                if (s.rpe) {
                  set.rpe = parseInt(s.rpe, 10);
                }
                if (s.weight) {
                  set.load = {
                    weight: parseFloat(s.weight),
                    unit: preferredUnit,
                  };
                }
                return set;
              }),
            }));

            const payload: LogWorkoutRequest = {
              workoutId: plan.id,
              name: plan.focus,
              focus: plan.focus,
              durationMinutes,
              completedAt: new Date().toISOString(),
              exercises: sessionExercises,
            };

            // Mark workout complete locally
            await workoutRepository.completeWorkoutById(plan.id, durationSeconds);

            // Try to sync to server
            try {
              await logWorkout(plan.id, payload);
            } catch (apiError) {
              console.error('Failed to sync workout to server', apiError);
              // Mark as sync pending for retry
              await workoutRepository.markSyncPending(plan.id, true);
              Alert.alert(
                'Offline',
                'Workout saved locally. It will sync when you are back online.'
              );
            }

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
  }, [exercises, durationSeconds, plan, preferredUnit, navigation]);

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
            isSubmittingRef.current = true;
            navigation.reset({
              index: 0,
              routes: [{ name: 'Home' }],
            });
          },
        },
      ],
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator size="large" color={palette.accent} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {/* Header */}
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

        {exercises.map((exercise, exerciseIdx) => (
          <ExerciseCard
            key={exercise.exerciseId}
            exercise={exercise}
            preferredUnit={preferredUnit}
            onUpdateSet={(setIdx, field, value) =>
              updateSet(exerciseIdx, setIdx, field, value)
            }
            onAddSet={() => addSet(exerciseIdx)}
            onRemoveSet={(setIdx) => removeSet(exerciseIdx, setIdx)}
          />
        ))}

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

const ExerciseCard = ({
  exercise,
  preferredUnit,
  onUpdateSet,
  onAddSet,
  onRemoveSet,
}: {
  exercise: ExerciseState;
  preferredUnit: WeightUnit;
  onUpdateSet: (setIdx: number, field: keyof SetState, value: string | boolean) => void;
  onAddSet: () => void;
  onRemoveSet: (setIdx: number) => void;
}) => (
  <View style={styles.exerciseCard}>
    <View style={styles.exerciseHeader}>
      <View style={styles.exerciseHeaderLeft}>
        <Text style={styles.exerciseName}>{exercise.name}</Text>
        {exercise.prescription && (
          <Text style={styles.exercisePrescription}>{exercise.prescription}</Text>
        )}
      </View>
    </View>

    {exercise.previousSets && exercise.previousSets.length > 0 && (
      <View style={styles.historyBanner}>
        <Text style={styles.historyText}>
          Last time: {exercise.previousSets.map((s, idx) => {
            const parts: string[] = [];
            if (s.reps) parts.push(`${s.reps} reps`);
            if (s.weight && s.unit) parts.push(`${s.weight}${s.unit}`);
            return parts.join(' × ');
          }).join(', ')}
        </Text>
      </View>
    )}

    <View style={styles.setsContainer}>
      {exercise.sets.map((set, setIdx) => (
        <SetRow
          key={set.localId}
          set={set}
          setNumber={setIdx + 1}
          preferredUnit={preferredUnit}
          onUpdate={(field, value) => onUpdateSet(setIdx, field, value)}
          onRemove={() => onRemoveSet(setIdx)}
        />
      ))}
    </View>

    <Pressable
      onPress={onAddSet}
      style={({ pressed }) => [
        styles.addSetButton,
        pressed && { opacity: 0.8 },
      ]}
      accessibilityRole="button"
      accessibilityLabel="Add set"
    >
      <Text style={styles.addSetButtonText}>+ Add Set</Text>
    </Pressable>
  </View>
);

const SetRow = ({
  set,
  setNumber,
  preferredUnit,
  onUpdate,
  onRemove,
}: {
  set: SetState;
  setNumber: number;
  preferredUnit: WeightUnit;
  onUpdate: (field: keyof SetState, value: string | boolean) => void;
  onRemove: () => void;
}) => (
  <View style={styles.setRow}>
    <View style={styles.setRowLeft}>
      <Text style={styles.setLabel}>Set {setNumber}</Text>
    </View>

    <View style={styles.setInputsRow}>
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Reps</Text>
        <TextInput
          style={styles.input}
          value={set.reps}
          onChangeText={(val) => onUpdate('reps', val)}
          keyboardType="number-pad"
          placeholder="0"
          placeholderTextColor={palette.textMuted}
          maxLength={3}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Weight ({preferredUnit})</Text>
        <TextInput
          style={styles.input}
          value={set.weight}
          onChangeText={(val) => onUpdate('weight', val)}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor={palette.textMuted}
          maxLength={6}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>RPE</Text>
        <TextInput
          style={styles.input}
          value={set.rpe}
          onChangeText={(val) => onUpdate('rpe', val)}
          keyboardType="number-pad"
          placeholder="0"
          placeholderTextColor={palette.textMuted}
          maxLength={2}
        />
      </View>

      <Pressable
        onPress={() => onUpdate('completed', !set.completed)}
        style={[styles.checkbox, set.completed && styles.checkboxChecked]}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: set.completed }}
        accessibilityLabel="Mark set as completed"
      >
        {set.completed && <Text style={styles.checkmark}>✓</Text>}
      </Pressable>

      <Pressable
        onPress={onRemove}
        style={({ pressed }) => [
          styles.removeButton,
          pressed && { opacity: 0.6 },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Remove set"
      >
        <Text style={styles.removeButtonText}>×</Text>
      </Pressable>
    </View>
  </View>
);

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.background,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
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
  exerciseCard: {
    backgroundColor: palette.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 16,
    gap: 12,
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  exerciseHeaderLeft: {
    flex: 1,
    gap: 4,
  },
  exerciseName: {
    color: palette.textPrimary,
    fontSize: 18,
    fontWeight: '600',
  },
  exercisePrescription: {
    color: palette.textSecondary,
    fontSize: 14,
  },
  historyBanner: {
    backgroundColor: palette.cardSecondary,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.border,
  },
  historyText: {
    color: palette.textSecondary,
    fontSize: 12,
  },
  setsContainer: {
    gap: 8,
  },
  setRow: {
    gap: 8,
  },
  setRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  setLabel: {
    color: palette.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  setInputsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inputGroup: {
    flex: 1,
    gap: 4,
  },
  inputLabel: {
    color: palette.textMuted,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: palette.cardSecondary,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: palette.textPrimary,
    fontSize: 16,
    textAlign: 'center',
  },
  checkbox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: palette.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  checkboxChecked: {
    backgroundColor: palette.success,
    borderColor: palette.success,
  },
  checkmark: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 18,
  },
  removeButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: palette.cardSecondary,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  removeButtonText: {
    color: palette.error,
    fontSize: 24,
    fontWeight: '600',
  },
  addSetButton: {
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.border,
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  addSetButtonText: {
    color: palette.textSecondary,
    fontSize: 14,
    fontWeight: '600',
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
