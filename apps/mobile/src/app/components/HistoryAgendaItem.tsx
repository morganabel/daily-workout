import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type {
  CalendarItem,
  PlannedEvent,
  WorkoutSessionSummary,
} from '@workout-agent/shared';
import { palette, typography } from '../theme';
import { formatLocalDate } from '../utils/date';
import { formatTime, getKindMeta } from '../utils/historyCalendar';

type HistoryAgendaItemProps = {
  item: CalendarItem;
  plannedEvent?: PlannedEvent;
  session?: WorkoutSessionSummary;
  isGenerating?: boolean;
  onEditEvent: (event: PlannedEvent) => void;
  onGenerateWorkout: (event: PlannedEvent) => void;
  onOpenSession: (session: WorkoutSessionSummary) => void;
};

export const HistoryAgendaItem = ({
  item,
  plannedEvent,
  session,
  isGenerating = false,
  onEditEvent,
  onGenerateWorkout,
  onOpenSession,
}: HistoryAgendaItemProps) => {
  if (item.type === 'planned-event') {
    const meta = getKindMeta(item.kind);
    const timeLabel = item.allDay
      ? 'All day'
      : item.startsAt
      ? formatTime(new Date(item.startsAt))
      : 'Any time';
    const showGenerate = Boolean(
      plannedEvent &&
        item.kind === 'workout' &&
        item.localDate > formatLocalDate(new Date())
    );

    return (
      <Pressable
        onPress={() => {
          if (plannedEvent) {
            onEditEvent(plannedEvent);
          }
        }}
        disabled={!plannedEvent}
      >
        <View style={styles.agendaCard}>
          <View
            style={[styles.agendaIcon, { backgroundColor: meta.background }]}
          >
            <Ionicons name={meta.icon} size={20} color={meta.color} />
          </View>
          <View style={styles.agendaInfo}>
            <Text style={styles.agendaTitle}>{item.title}</Text>
            <Text style={styles.agendaMeta}>
              {timeLabel}
              {plannedEvent?.durationMinutes
                ? ` • ${plannedEvent.durationMinutes} min`
                : ''}
            </Text>
          </View>
          {showGenerate && plannedEvent && (
            <Pressable
              style={styles.agendaAction}
              onPress={() => onGenerateWorkout(plannedEvent)}
              disabled={isGenerating}
            >
              <Text style={styles.agendaActionText}>
                {isGenerating ? 'Generating…' : 'Generate'}
              </Text>
            </Pressable>
          )}
        </View>
      </Pressable>
    );
  }

  const meta = getKindMeta('workout');
  const completedAt = item.completedAt
    ? formatTime(new Date(item.completedAt))
    : 'Completed';

  return (
    <Pressable
      onPress={() => {
        if (session) {
          onOpenSession(session);
        }
      }}
      disabled={!session}
    >
      <View style={styles.agendaCard}>
        <View style={[styles.agendaIcon, { backgroundColor: meta.background }]}>
          <Ionicons name={meta.icon} size={20} color={meta.color} />
        </View>
        <View style={styles.agendaInfo}>
          <Text style={styles.agendaTitle}>{item.title}</Text>
          <Text style={styles.agendaMeta}>
            {completedAt}
            {item.durationMinutes ? ` • ${item.durationMinutes} min` : ''}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={palette.textMuted} />
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  agendaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.border,
    marginBottom: 12,
  },
  agendaIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  agendaInfo: {
    flex: 1,
  },
  agendaTitle: {
    fontSize: 16,
    fontFamily: typography.fontFamilyBold,
    color: palette.textPrimary,
  },
  agendaMeta: {
    marginTop: 4,
    fontSize: 13,
    fontFamily: typography.fontFamily,
    color: palette.textSecondary,
  },
  agendaAction: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: palette.cardSecondary,
  },
  agendaActionText: {
    fontSize: 12,
    fontFamily: typography.fontFamilyBold,
    color: palette.primary,
  },
});
