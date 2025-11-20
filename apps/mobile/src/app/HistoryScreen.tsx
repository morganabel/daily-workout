import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import type { WorkoutSessionSummary } from '@workout-agent/shared';
import { workoutRepository } from './db/repositories/WorkoutRepository';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
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
  warning: '#ffb347',
  destructive: '#ff6b6b',
};

type HistoryNav = NativeStackNavigationProp<RootStackParamList, 'History'>;

export const HistoryScreen = () => {
  const [history, setHistory] = useState<WorkoutSessionSummary[]>([]);
  const navigation = useNavigation<HistoryNav>();

  useEffect(() => {
    const subscription = workoutRepository
      .observeRecentSessions(50)
      .subscribe((workouts) => {
        const summaries = workouts.map((workout) =>
          workoutRepository.toSessionSummary(workout),
        );
        setHistory(summaries);
      });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerRow}>
          <Pressable style={styles.closeButton} onPress={() => navigation.goBack()}>
            <Text style={styles.closeButtonText}>Close</Text>
          </Pressable>
          <Text style={styles.screenTitle}>History</Text>
        </View>

        {history.length === 0 ? (
          <Text style={styles.emptyText}>No completed workouts yet.</Text>
        ) : (
          history.map((session) => (
            <View key={session.id} style={styles.card}>
              <Text style={styles.workoutName}>{session.name}</Text>
              <Text style={styles.workoutFocus}>{session.focus}</Text>
              <Text style={styles.workoutMeta}>
                {new Date(session.completedAt).toLocaleDateString()} • {session.durationMinutes} min
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.background,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 24,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: palette.textPrimary,
  },
  closeButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.border,
  },
  closeButtonText: {
    color: palette.textSecondary,
    fontWeight: '600',
  },
  card: {
    backgroundColor: palette.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: palette.border,
  },
  workoutName: {
    fontSize: 18,
    fontWeight: '600',
    color: palette.textPrimary,
    marginBottom: 4,
  },
  workoutFocus: {
    fontSize: 14,
    color: palette.textMuted,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  workoutMeta: {
    fontSize: 14,
    color: palette.textSecondary,
  },
  emptyText: {
    color: palette.textMuted,
    fontSize: 16,
    textAlign: 'center',
    marginTop: 40,
  },
});
