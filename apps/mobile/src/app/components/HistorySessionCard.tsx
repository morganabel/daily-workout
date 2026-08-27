import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { WorkoutSessionSummary } from '@leveza/shared';
import { Card } from './DesignSystem';
import { palette, typography } from '../theme';

type HistorySessionCardProps = {
  session: WorkoutSessionSummary;
  showActions?: boolean;
  onOpen: (session: WorkoutSessionSummary) => void;
  onToggleFavorite?: (session: WorkoutSessionSummary) => void;
  onToggleArchive?: (session: WorkoutSessionSummary) => void;
  onDelete?: (session: WorkoutSessionSummary) => void;
};

export const HistorySessionCard = ({
  session,
  showActions = false,
  onOpen,
  onToggleFavorite,
  onToggleArchive,
  onDelete,
}: HistorySessionCardProps) => {
  const showFavoriteAction = showActions && onToggleFavorite;
  const showHistoryActions = showActions && onToggleArchive && onDelete;

  return (
    <Card style={styles.card}>
      <Pressable onPress={() => onOpen(session)}>
        <View style={styles.cardHeader}>
          <View style={styles.cardInfo}>
            <Text style={styles.workoutName}>{session.name}</Text>
            <Text style={styles.workoutFocus}>{session.focus}</Text>
          </View>
          {showFavoriteAction && (
            <Pressable onPress={() => onToggleFavorite?.(session)} hitSlop={10}>
              <Ionicons
                name={session.isFavorite ? 'heart' : 'heart-outline'}
                size={24}
                color={
                  session.isFavorite ? palette.destructive : palette.textMuted
                }
              />
            </Pressable>
          )}
        </View>

        <Text style={styles.workoutMeta}>
          {new Date(session.completedAt).toLocaleDateString()} •{' '}
          {session.durationMinutes} min
        </Text>

        {showActions && (
          <View style={styles.badges}>
            {session.archivedAt && (
              <View style={[styles.badge, styles.archivedBadge]}>
                <Text style={styles.archivedBadgeText}>Archived</Text>
              </View>
            )}
          </View>
        )}

        {showHistoryActions && (
          <View style={styles.historyActions}>
            <Pressable
              style={({ pressed }) => [
                styles.historyActionButton,
                pressed && { opacity: 0.7 },
              ]}
              onPress={() => onToggleArchive?.(session)}
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
              onPress={() => onDelete?.(session)}
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
        )}
      </Pressable>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardInfo: {
    flex: 1,
  },
  workoutName: {
    fontSize: 18,
    fontFamily: typography.fontFamilyBold,
    color: palette.textPrimary,
  },
  workoutFocus: {
    fontSize: 14,
    fontFamily: typography.fontFamily,
    color: palette.textSecondary,
    marginTop: 2,
  },
  workoutMeta: {
    fontSize: 13,
    fontFamily: typography.fontFamily,
    color: palette.textMuted,
    marginTop: 8,
  },
  badges: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: palette.cardSecondary,
  },
  archivedBadge: {
    backgroundColor: palette.cardSecondary,
  },
  archivedBadgeText: {
    fontSize: 12,
    fontFamily: typography.fontFamilyBold,
    color: palette.textMuted,
  },
  historyActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    justifyContent: 'flex-end',
  },
  historyActionButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  historyActionText: {
    fontSize: 13,
    fontFamily: typography.fontFamilyBold,
    color: palette.textSecondary,
  },
  historyActionDestructive: {
    color: palette.destructive,
  },
});
