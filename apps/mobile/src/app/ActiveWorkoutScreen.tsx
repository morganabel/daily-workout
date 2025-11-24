import React, { useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Alert,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { WorkoutBlock, WorkoutExercise } from '@workout-agent/shared';
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
};

type ActiveWorkoutNavigation = NativeStackNavigationProp<
  RootStackParamList,
  'ActiveWorkout'
>;

type ActiveWorkoutRoute = RouteProp<RootStackParamList, 'ActiveWorkout'>;

export const ActiveWorkoutScreen = () => {
  const navigation = useNavigation<ActiveWorkoutNavigation>();
  const route = useRoute<ActiveWorkoutRoute>();
  const { plan } = route.params;

  const [durationSeconds, setDurationSeconds] = useState(0);
  const [completedItems, setCompletedItems] = useState<Set<string>>(new Set());
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
  }, [navigation]); // Removed isSubmitting from dependency array to avoid re-binding listener

  const formatTime = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const toggleItem = (id: string) => {
    setCompletedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleFinish = () => {
    const totalItems = plan.blocks.reduce(
      (acc, block) => acc + block.exercises.length,
      0
    );
    const uncheckedCount = totalItems - completedItems.size;

    const message =
      uncheckedCount > 0
        ? `You have ${uncheckedCount} unchecked items. Finish anyway?`
        : 'Great job! Ready to log this workout?';

    Alert.alert('Finish Workout?', message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Finish',
        style: 'default',
        onPress: async () => {
          try {
            setIsSubmitting(true);
            await workoutRepository.completeWorkoutById(plan.id, durationSeconds);
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

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.timerText}>{formatTime(durationSeconds)}</Text>
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

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.planTitle}>{plan.focus}</Text>

        {plan.blocks.map((block) => (
          <BlockCard
            key={block.id}
            block={block}
            completedItems={completedItems}
            onToggleItem={toggleItem}
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

const BlockCard = ({
  block,
  completedItems,
  onToggleItem,
}: {
  block: WorkoutBlock;
  completedItems: Set<string>;
  onToggleItem: (id: string) => void;
}) => (
  <View style={styles.blockCard}>
    <Text style={styles.blockTitle}>{block.title}</Text>
    <View style={styles.exerciseList}>
      {block.exercises.map((exercise) => (
        <ExerciseRow
          key={exercise.id}
          exercise={exercise}
          isCompleted={completedItems.has(exercise.id)}
          onToggle={() => onToggleItem(exercise.id)}
        />
      ))}
    </View>
  </View>
);

const ExerciseRow = ({
  exercise,
  isCompleted,
  onToggle,
}: {
  exercise: WorkoutExercise;
  isCompleted: boolean;
  onToggle: () => void;
}) => (
  <Pressable
    onPress={onToggle}
    style={styles.exerciseRow}
    accessibilityRole="checkbox"
    accessibilityLabel={`Mark ${exercise.name} as completed`}
    accessibilityState={{ checked: isCompleted }}
  >
    <View style={[styles.checkbox, isCompleted && styles.checkboxChecked]}>
      {isCompleted && <Text style={styles.checkmark}>✓</Text>}
    </View>
    <View style={styles.exerciseBody}>
      <Text
        style={[
          styles.exerciseName,
          isCompleted && styles.exerciseTextCompleted,
        ]}
      >
        {exercise.name}
      </Text>
      <Text style={styles.exercisePrescription}>{exercise.prescription}</Text>
    </View>
  </Pressable>
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
    paddingTop: 60, // Safe area rough approximation
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    backgroundColor: palette.background,
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
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 16,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  exerciseBody: {
    flex: 1,
    gap: 4,
  },
  exerciseName: {
    color: palette.textPrimary,
    fontSize: 16,
    fontWeight: '500',
  },
  exercisePrescription: {
    color: palette.textSecondary,
    fontSize: 14,
  },
  exerciseTextCompleted: {
    color: palette.textMuted,
    textDecorationLine: 'line-through',
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: palette.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: palette.success,
    borderColor: palette.success,
  },
  checkmark: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 16,
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

