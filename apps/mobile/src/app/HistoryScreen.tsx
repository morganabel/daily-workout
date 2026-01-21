import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Toast from 'react-native-root-toast';
import { Ionicons } from '@expo/vector-icons';
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
import { palette, typography, layout } from './theme';
import { BottomNavigation } from './components/BottomNavigation';
import { Card, Chip } from './components/DesignSystem';

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
      const summaries = workouts.map((workout) =>
        workoutRepository.toSessionSummary(workout)
      );
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
      Toast.show(
        session.archivedAt ? 'Workout restored to history' : 'Workout archived',
        {
          duration: Toast.durations.SHORT,
          position: Toast.positions.BOTTOM - 80,
        }
      );
      await loadHistory(includeArchived);
    } catch (err) {
      console.error('Failed to toggle archive', err);
      Alert.alert('Unable to update', 'Please try again.');
    }
  };

  const handleFavoriteToggle = async (session: WorkoutSessionSummary) => {
    try {
      await toggleFavoriteWorkout(session.id);
      Toast.show(
        session.isFavorite ? 'Removed from favorites' : 'Added to favorites',
        {
          duration: Toast.durations.SHORT,
          position: Toast.positions.BOTTOM - 80,
        }
      );
      await loadHistory(includeArchived);
    } catch (err) {
      console.error('Failed to toggle favorite', err);
      Alert.alert('Unable to update', 'Please try again.');
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
              Alert.alert('Failed to delete', 'Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleOpenSession = (session: WorkoutSessionSummary) => {
    navigation.navigate('WorkoutSessionDetail', { workoutId: session.id });
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.screenTitle}>History</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.filterRow}>
          <Chip
            label={includeArchived ? 'Hide archived' : 'Show archived'}
            onPress={() => setIncludeArchived((prev) => !prev)}
            selected={includeArchived}
            style={styles.filterChip}
          />
        </View>

        {history.length === 0 ? (
          loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={palette.primary} />
              <Text style={styles.loadingText}>Loading history…</Text>
            </View>
          ) : (
            <Text style={styles.emptyText}>No completed workouts yet.</Text>
          )
        ) : (
          history.map((session) => (
            <Card
              key={session.id}
              style={styles.card}
            >
              <Pressable onPress={() => handleOpenSession(session)}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardInfo}>
                    <Text style={styles.workoutName}>{session.name}</Text>
                    <Text style={styles.workoutFocus}>{session.focus}</Text>
                  </View>
                  <Pressable
                    onPress={() => handleFavoriteToggle(session)}
                    hitSlop={10}
                  >
                    <Ionicons
                      name={session.isFavorite ? 'heart' : 'heart-outline'}
                      size={24}
                      color={
                        session.isFavorite
                          ? palette.destructive
                          : palette.textMuted
                      }
                    />
                  </Pressable>
                </View>

                <Text style={styles.workoutMeta}>
                  {new Date(session.completedAt).toLocaleDateString()} •{' '}
                  {session.durationMinutes} min
                </Text>

                <View style={styles.badges}>
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
                    <Text
                      style={[
                        styles.historyActionText,
                        styles.historyActionDestructive,
                      ]}
                    >
                      Delete
                    </Text>
                  </Pressable>
                </View>
              </Pressable>
            </Card>
          ))
        )}
        <View style={{ height: 100 }} />
      </ScrollView>
      <BottomNavigation />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.background,
    paddingTop: layout.safeAreaTop,
  },
  header: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 0,
  },
  filterRow: {
    marginBottom: 20,
  },
  filterChip: {
    alignSelf: 'flex-start',
  },
  screenTitle: {
    fontFamily: typography.fontFamilyExtraBold,
    fontSize: 28,
    color: palette.textPrimary,
  },
  card: {
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  cardInfo: {
    flex: 1,
    paddingRight: 12,
  },
  workoutName: {
    fontFamily: typography.fontFamilyBold,
    fontSize: 18,
    color: palette.textPrimary,
    marginBottom: 4,
  },
  workoutFocus: {
    fontFamily: typography.fontFamilyBold,
    fontSize: 11,
    color: palette.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  workoutMeta: {
    fontFamily: typography.fontFamily,
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
    backgroundColor: palette.cardSecondary,
    borderColor: palette.border,
  },
  archivedBadgeText: {
    color: palette.textSecondary,
    fontSize: 12,
    fontFamily: typography.fontFamilyBold,
  },
  historyActions: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    paddingTop: 12,
  },
  historyActionButton: {
    paddingVertical: 4,
  },
  historyActionText: {
    color: palette.textMuted,
    fontFamily: typography.fontFamilyBold,
    fontSize: 13,
  },
  historyActionDestructive: {
    color: palette.destructive,
  },
  emptyText: {
    color: palette.textMuted,
    fontSize: 16,
    textAlign: 'center',
    marginTop: 40,
    fontFamily: typography.fontFamily,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  loadingText: {
    color: palette.textSecondary,
    fontSize: 14,
    fontFamily: typography.fontFamily,
  },
});
