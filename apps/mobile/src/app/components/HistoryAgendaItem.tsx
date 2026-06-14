import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type {
  CalendarItem,
  PlannedEvent,
  WorkoutSessionSummary,
} from '@workout-agent/shared';
import { plannedSlotMetadataSchema } from '@workout-agent/shared';
import { palette, typography } from '../theme';
import { formatTime, getKindMeta } from '../utils/historyCalendar';

type HistoryAgendaItemProps = {
  item: CalendarItem;
  plannedEvent?: PlannedEvent;
  session?: WorkoutSessionSummary;
  isGenerating?: boolean;
  onEditEvent: (event: PlannedEvent) => void;
  onGenerateWorkout: (event: PlannedEvent) => void;
  onOpenLinkedWorkout: (event: PlannedEvent) => void;
  onOpenSession: (session: WorkoutSessionSummary) => void;
};

const formatSlotDetailState = (value: string): string => {
  const label = value.replace('-', ' ');
  return label.charAt(0).toUpperCase() + label.slice(1);
};

export const HistoryAgendaItem = ({
  item,
  plannedEvent,
  session,
  isGenerating = false,
  onEditEvent,
  onGenerateWorkout,
  onOpenLinkedWorkout,
  onOpenSession,
}: HistoryAgendaItemProps) => {
  if (item.type === 'planned-event') {
    const meta = getKindMeta(item.kind);
    const plannedSlotMetadata = plannedEvent
      ? plannedSlotMetadataSchema.safeParse(plannedEvent.metadata)
      : null;
    const plannedSlot = plannedSlotMetadata?.success
      ? plannedSlotMetadata.data
      : null;
    const timeLabel = item.allDay
      ? 'All day'
      : item.startsAt
      ? formatTime(new Date(item.startsAt))
      : 'Any time';
    const hasLinkedWorkout = Boolean(
      plannedEvent?.linkedWorkoutId || plannedSlot?.linkedWorkoutId
    );
    const showGenerate = Boolean(
      plannedEvent && item.kind === 'workout' && !hasLinkedWorkout
    );
    const showOpen = Boolean(plannedEvent && hasLinkedWorkout);
    const detailState = plannedSlot
      ? formatSlotDetailState(plannedSlot.detailState)
      : null;

    return (
      <Pressable
        onPress={() => {
          if (plannedEvent) {
            if (hasLinkedWorkout) {
              onOpenLinkedWorkout(plannedEvent);
              return;
            }
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
            <Text style={styles.agendaTitle}>
              {plannedSlot?.slotLabel ?? item.title}
            </Text>
            <Text style={styles.agendaMeta}>
              {timeLabel}
              {plannedEvent?.durationMinutes
                ? ` • ${plannedEvent.durationMinutes} min`
                : ''}
            </Text>
            {plannedSlot && (
              <Text style={styles.plannedSlotMeta}>{detailState}</Text>
            )}
          </View>
          {showGenerate && plannedEvent && (
            <Pressable
              style={styles.agendaAction}
              onPress={() => onGenerateWorkout(plannedEvent)}
              disabled={isGenerating}
            >
              <Text style={styles.agendaActionText}>
                {isGenerating ? 'Building…' : 'Build'}
              </Text>
            </Pressable>
          )}
          {showOpen && plannedEvent && (
            <Pressable
              style={styles.agendaAction}
              onPress={() => onOpenLinkedWorkout(plannedEvent)}
            >
              <Text style={styles.agendaActionText}>Open</Text>
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
  plannedSlotMeta: {
    marginTop: 4,
    fontSize: 12,
    fontFamily: typography.fontFamilyBold,
    color: palette.primaryDark,
    textTransform: 'capitalize',
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
