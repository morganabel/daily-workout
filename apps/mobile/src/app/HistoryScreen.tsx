import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { database } from './db';
import Workout from './db/models/Workout';
import { Q } from '@nozbe/watermelondb';

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

export const HistoryScreen = () => {
  const [history, setHistory] = useState<Workout[]>([]);

  useEffect(() => {
    const subscription = database.collections
      .get<Workout>('workouts')
      .query(
        Q.where('status', 'completed'),
        Q.sortBy('completed_at', Q.desc)
      )
      .observe()
      .subscribe(setHistory);

    return () => subscription.unsubscribe();
  }, []);

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.screenTitle}>History</Text>

        {history.length === 0 ? (
          <Text style={styles.emptyText}>No completed workouts yet.</Text>
        ) : (
          history.map((workout) => (
            <View key={workout.id} style={styles.card}>
              <Text style={styles.workoutName}>{workout.name}</Text>
              <Text style={styles.workoutMeta}>
                {new Date(workout.completedAt!).toLocaleDateString()} • {Math.round((workout.durationSeconds || 0) / 60)} min
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
  screenTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: palette.textPrimary,
    marginBottom: 24,
    marginTop: 60,
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
