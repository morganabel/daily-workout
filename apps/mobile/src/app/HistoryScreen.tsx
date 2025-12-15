import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, ActivityIndicator } from 'react-native';
import Toast from 'react-native-root-toast';
import type { WorkoutSessionSummary } from '@workout-agent/shared';
import { workoutRepository } from './db/repositories/WorkoutRepository';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from './navigation';
import {
  archiveWorkoutSession,
  deleteWorkoutSession,
  unarchiveWorkoutSession,
  toggleFavoriteWorkout,
} from './services/api';

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
  const [includeArchived, setIncludeArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigation = useNavigation<HistoryNav>();

  const loadHistory = useCallback(async (includeArchivedFlag: boolean) => {
    try {
      const workouts = await workoutRepository.listRecentSessions(50, {
        includeArchived: includeArchivedFlag,
      });
      const summaries = workouts.map((workout) => workoutRepository.toSessionSummary(workout));
      setHistory(summaries);
    } catch (err) {
      console.error('Failed to load history', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    void loadHistory(includeArchived);
  }, [includeArchived, loadHistory]);

  const handleArchiveToggle = async (session: WorkoutSessionSummary) => {
    try {
      if (session.archivedAt) {
        await unarchiveWorkoutSession(session.id);
      } else {
        await archiveWorkoutSession(session.id);
      }
      Toast.show(session.archivedAt ? 'Workout restored to history' : 'Workout archived', {
        duration: Toast.durations.SHORT,
        position: Toast.positions.BOTTOM - 80,
      });
      await loadHistory(includeArchived);
    } catch (err) {
      console.error('Failed to toggle archive', err);
      Alert.alert(
        'Unable to update',
        'Please try again.',
      );
    }
  };

  const handleFavoriteToggle = async (session: WorkoutSessionSummary) => {
    try {
      await toggleFavoriteWorkout(session.id);
      Toast.show(session.isFavorite ? 'Removed from favorites' : 'Added to favorites', {
        duration: Toast.durations.SHORT,
        position: Toast.positions.BOTTOM - 80,
      });
      await loadHistory(includeArchived);
    } catch (err) {
      console.error('Failed to toggle favorite', err);
      Alert.alert(
        'Unable to update',
        'Please try again.',
      );
    }
  };

  const handleDelete = (session: WorkoutSessionSummary) => {
    Alert.alert(
      'Delete workout?',
      'This will remove the workout and its details. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteWorkoutSession(session.id);
              Toast.show('Workout deleted', {
                duration: Toast.durations.SHORT,
                position: Toast.positions.BOTTOM - 80,
              });
              await loadHistory(includeArchived);
            } catch (err) {
              console.error('Failed to delete workout', err);
              Alert.alert(
                'Failed to delete',
                'Please try again.',
              );
            }
          },
        },
      ],
    );
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerRow}>
          <Pressable style={styles.closeButton} onPress={() => navigation.goBack()}>
            <Text style={styles.closeButtonText}>Close</Text>
          </Pressable>
          <Text style={styles.screenTitle}>History</Text>
        </View>
        <View style={styles.filterRow}>
          <Pressable
            style={[
              styles.filterPill,
              includeArchived && styles.filterPillActive,
            ]}
            onPress={() => setIncludeArchived((prev) => !prev)}
          >
            <Text
              style={[
                styles.filterPillText,
                includeArchived && styles.filterPillTextActive,
              ]}
            >
              {includeArchived ? 'Hide archived' : 'Show archived'}
            </Text>
          </Pressable>
        </View>

        {history.length === 0 ? (
          loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={palette.accent} />
              <Text style={styles.loadingText}>Loading history…</Text>
            </View>
          ) : (
            <Text style={styles.emptyText}>No completed workouts yet.</Text>
          )
        ) : (
          history.map((session) => (
            <View key={session.id} style={styles.card}>
              <Text style={styles.workoutName}>{session.name}</Text>
              <Text style={styles.workoutFocus}>{session.focus}</Text>
              <Text style={styles.workoutMeta}>
                {new Date(session.completedAt).toLocaleDateString()} • {session.durationMinutes} min
              </Text>
              <View style={styles.badges}>
                {session.isFavorite && (
                  <View style={[styles.badge, styles.favoriteBadge]}>
                    <Text style={styles.favoriteBadgeText}>Favorite</Text>
                  </View>
                )}
                {session.archivedAt && (
                  <View style={[styles.badge, styles.archivedBadge]}>
                    <Text style={styles.archivedBadgeText}>Archived</Text>
                  </View>
                )}
              </View>
              <View style={styles.historyActions}>
                <Pressable
                  style={({ pressed }) => [
                    styles.historyActionButton,
                    pressed && { opacity: 0.7 },
                  ]}
                  onPress={() => handleFavoriteToggle(session)}
                >
                  <Text style={[
                    styles.historyActionText,
                    session.isFavorite && styles.historyActionActive
                  ]}>
                    {session.isFavorite ? 'Unfavorite' : 'Favorite'}
                  </Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.historyActionButton,
                    pressed && { opacity: 0.7 },
                  ]}
                  onPress={() => handleArchiveToggle(session)}
                >
                  <Text style={styles.historyActionText}>
                    {session.archivedAt ? 'Unarchive' : 'Archive'}
                  </Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.historyActionButton,
                    pressed && { opacity: 0.7 },
                  ]}
                  onPress={() => handleDelete(session)}
                >
                  <Text style={[styles.historyActionText, styles.historyActionDestructive]}>
                    Delete
                  </Text>
                </Pressable>
              </View>
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
  filterRow: {
    marginBottom: 12,
  },
  filterPill: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.cardSecondary,
  },
  filterPillActive: {
    borderColor: palette.accent,
    backgroundColor: palette.accentMuted,
  },
  filterPillText: {
    color: palette.textSecondary,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  filterPillTextActive: {
    color: palette.accent,
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
  badges: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  badge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  archivedBadge: {
    backgroundColor: palette.accentMuted,
    borderColor: palette.border,
  },
  archivedBadgeText: {
    color: palette.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  favoriteBadge: {
    backgroundColor: 'rgba(255, 179, 71, 0.1)',
    borderColor: 'rgba(255, 179, 71, 0.3)',
  },
  favoriteBadgeText: {
    color: palette.warning,
    fontSize: 12,
    fontWeight: '700',
  },
  historyActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  historyActionButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  historyActionText: {
    color: palette.textMuted,
    fontWeight: '600',
    fontSize: 13,
  },
  historyActionActive: {
    color: palette.warning,
  },
  historyActionDestructive: {
    color: palette.destructive,
  },
  emptyText: {
    color: palette.textMuted,
    fontSize: 16,
    textAlign: 'center',
    marginTop: 40,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  loadingText: {
    color: palette.textSecondary,
    fontSize: 14,
  },
});
