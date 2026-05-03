import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-root-toast';
import type {
  CalendarItem,
  GenerationRequest,
  PlannedEvent,
  PlannedEventInput,
  PlannedEventPatch,
  WorkoutSessionSummary,
} from '@workout-agent/shared';
import { plannedSlotMetadataSchema } from '@workout-agent/shared';
import { workoutRepository } from './db/repositories/WorkoutRepository';
import { plannedEventRepository } from './db/repositories/PlannedEventRepository';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from './navigation';
import {
  archiveWorkoutSession,
  deleteWorkoutSession,
  generateWorkout,
  quickLogWorkout,
  toggleFavoriteWorkout,
  unarchiveWorkoutSession,
} from './services/api';
import { palette, typography, layout } from './theme';
import { BottomNavigation } from './components/BottomNavigation';
import { Button, Chip } from './components/DesignSystem';
import { HistoryAgendaItem } from './components/HistoryAgendaItem';
import { HistoryCalendar } from './components/HistoryCalendar';
import { HistorySessionCard } from './components/HistorySessionCard';
import { QuickLogSheet } from './components/QuickLogSheet';
import { PlannedEventSheet } from './components/PlannedEventSheet';
import { endOfDay, formatLocalDate, parseLocalDate, startOfDay } from './utils/date';
import {
  type CalendarCell,
  type CalendarView,
  buildCalendarCells,
  buildWeekCells,
  formatDayHeader,
  getMonthStart,
  sortAgendaItems,
} from './utils/historyCalendar';

type HistoryNav = NativeStackNavigationProp<RootStackParamList, 'History'>;

type ViewMode = 'calendar' | 'list';

export const HistoryScreen = () => {
  const navigation = useNavigation<HistoryNav>();
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');
  const [calendarView, setCalendarView] = useState<CalendarView>('week');
  const [currentMonth, setCurrentMonth] = useState(getMonthStart(new Date()));
  const [selectedDate, setSelectedDate] = useState<string | null>(
    formatLocalDate(new Date())
  );
  const [monthSessions, setMonthSessions] = useState<WorkoutSessionSummary[]>(
    []
  );
  const [plannedEvents, setPlannedEvents] = useState<PlannedEvent[]>([]);
  const [recentSessions, setRecentSessions] = useState<WorkoutSessionSummary[]>(
    []
  );
  const [history, setHistory] = useState<WorkoutSessionSummary[]>([]);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [showQuickLog, setShowQuickLog] = useState(false);
  const [showPlanSheet, setShowPlanSheet] = useState(false);
  const [editingEvent, setEditingEvent] = useState<PlannedEvent | null>(null);
  const [generatingEventId, setGeneratingEventId] = useState<string | null>(
    null
  );

  const visibleRange = useMemo(() => {
    const cells =
      calendarView === 'week'
        ? buildWeekCells(selectedDate ? parseLocalDate(selectedDate) : new Date())
        : buildCalendarCells(currentMonth);
    const first = cells[0];
    const last = cells[cells.length - 1];
    return {
      startTimestamp: startOfDay(first.date).getTime(),
      endTimestamp: endOfDay(last.date).getTime(),
      startLocalDate: first.localDate,
      endLocalDate: last.localDate,
    };
  }, [calendarView, currentMonth, selectedDate]);

  useEffect(() => {
    const subscription = workoutRepository
      .observeCompletedSessionsByDateRange(
        visibleRange.startTimestamp,
        visibleRange.endTimestamp,
        { includeArchived: false }
      )
      .subscribe((workouts) => {
        const summaries = workouts.map((workout) =>
          workoutRepository.toSessionSummary(workout)
        );
        setMonthSessions(summaries);
      });

    return () => subscription.unsubscribe();
  }, [visibleRange.endTimestamp, visibleRange.startTimestamp]);

  useEffect(() => {
    const subscription = plannedEventRepository
      .observeEvents({ includeArchived: false })
      .subscribe((records) => {
        setPlannedEvents(
          records.map((record) => plannedEventRepository.toPlannedEvent(record))
        );
      });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const subscription = workoutRepository
      .observeRecentSessions(4, { includeArchived: false })
      .subscribe((workouts) => {
        setRecentSessions(
          workouts.map((workout) => workoutRepository.toSessionSummary(workout))
        );
      });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    setLoadingHistory(true);
    const subscription = workoutRepository
      .observeRecentSessions(50, { includeArchived })
      .subscribe((workouts) => {
        setHistory(
          workouts.map((workout) => workoutRepository.toSessionSummary(workout))
        );
        setLoadingHistory(false);
      });

    return () => subscription.unsubscribe();
  }, [includeArchived]);

  useEffect(() => {
    if (!selectedDate) return;
    const selected = parseLocalDate(selectedDate);
    if (
      selected.getMonth() !== currentMonth.getMonth() ||
      selected.getFullYear() !== currentMonth.getFullYear()
    ) {
      setSelectedDate(null);
    }
  }, [currentMonth, selectedDate]);

  useEffect(() => {
    if (!selectedDate && calendarView !== 'month') {
      setCalendarView('month');
    }
  }, [calendarView, selectedDate]);

  const plannedEventsForRange = useMemo(
    () =>
      plannedEvents.filter(
        (event) =>
          event.localDate >= visibleRange.startLocalDate &&
          event.localDate <= visibleRange.endLocalDate
      ),
    [visibleRange.endLocalDate, visibleRange.startLocalDate, plannedEvents]
  );

  const plannedEventById = useMemo(() => {
    const map = new Map<string, PlannedEvent>();
    plannedEvents.forEach((event) => map.set(event.id, event));
    return map;
  }, [plannedEvents]);

  const sessionById = useMemo(() => {
    const map = new Map<string, WorkoutSessionSummary>();
    monthSessions.forEach((session) => map.set(session.id, session));
    return map;
  }, [monthSessions]);

  const calendarItems = useMemo<CalendarItem[]>(() => {
    const sessionItems = monthSessions.map((session) => ({
      type: 'workout-session' as const,
      localDate: formatLocalDate(new Date(session.completedAt)),
      sessionId: session.id,
      title: session.name,
      completedAt: session.completedAt,
      durationMinutes: session.durationMinutes,
    }));

    const eventItems = plannedEventsForRange.map((event) => ({
      type: 'planned-event' as const,
      localDate: event.localDate,
      eventId: event.id,
      kind: event.kind,
      title: event.title,
      startsAt: event.startsAt
        ? new Date(event.startsAt).toISOString()
        : undefined,
      allDay: event.allDay,
    }));

    return [...sessionItems, ...eventItems];
  }, [monthSessions, plannedEventsForRange]);

  const itemsByDate = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    calendarItems.forEach((item) => {
      const items = map.get(item.localDate) ?? [];
      items.push(item);
      map.set(item.localDate, items);
    });
    return map;
  }, [calendarItems]);

  const agendaItems = useMemo(() => {
    if (!selectedDate) return [];
    const items = itemsByDate.get(selectedDate) ?? [];
    return sortAgendaItems(items);
  }, [itemsByDate, selectedDate]);

  const selectedDay = useMemo(
    () => (selectedDate ? parseLocalDate(selectedDate) : null),
    [selectedDate]
  );

  const calendarCells = useMemo(
    () => buildCalendarCells(currentMonth),
    [currentMonth]
  );

  const weekCells = useMemo(
    () => buildWeekCells(selectedDay ?? new Date()),
    [selectedDay]
  );

  const visibleCalendarCells =
    calendarView === 'week' ? weekCells : calendarCells;

  const calendarHeaderDate =
    calendarView === 'week' && selectedDay ? selectedDay : currentMonth;

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

  const shiftWeek = useCallback(
    (direction: number) => {
      if (!selectedDay) return;
      const next = new Date(selectedDay);
      next.setDate(next.getDate() + direction * 7);
      setSelectedDate(formatLocalDate(next));
      setCurrentMonth(getMonthStart(next));
    },
    [selectedDay]
  );

  const handlePrevRange = () => {
    if (calendarView === 'week') {
      shiftWeek(-1);
      return;
    }
    setCurrentMonth(
      getMonthStart(
        new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1)
      )
    );
  };

  const handleNextRange = () => {
    if (calendarView === 'week') {
      shiftWeek(1);
      return;
    }
    setCurrentMonth(
      getMonthStart(
        new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1)
      )
    );
  };

  const handleToggleCalendarView = () => {
    if (!selectedDate) return;
    setCalendarView((prev) => (prev === 'week' ? 'month' : 'week'));
  };

  const handleSelectDate = (cell: CalendarCell) => {
    if (!cell.isCurrentMonth) {
      setCurrentMonth(getMonthStart(cell.date));
    }
    const nextSelectedDate =
      selectedDate === cell.localDate ? null : cell.localDate;
    setSelectedDate(nextSelectedDate);
    if (nextSelectedDate) {
      setCalendarView('week');
    }
  };

  const handleEditEvent = (event: PlannedEvent) => {
    setEditingEvent(event);
    setShowPlanSheet(true);
  };

  const handleOpenLinkedWorkout = async (event: PlannedEvent) => {
    const metadata = plannedSlotMetadataSchema.safeParse(event.metadata);
    const linkedWorkoutId = event.linkedWorkoutId ??
      (metadata.success ? metadata.data.linkedWorkoutId : undefined);

    if (!linkedWorkoutId) {
      handleEditEvent(event);
      return;
    }

    const workout = await workoutRepository.getWorkoutByPlanId(linkedWorkoutId);
    if (!workout) {
      Alert.alert('Workout not found', 'The linked workout is no longer available.');
      return;
    }

    const plan = await workoutRepository.mapWorkoutToPlan(workout);
    navigation.navigate('WorkoutPreview', { plan });
  };

  const handleQuickLogSubmit = async (payload: {
    name: string;
    focus: string;
    durationMinutes: number;
    completedAt?: number;
    note?: string;
  }) => {
    await quickLogWorkout(payload);
  };

  const handlePlanSave = async (
    payload: PlannedEventInput | PlannedEventPatch
  ) => {
    if ('id' in payload) {
      await plannedEventRepository.updatePlannedEvent(payload);
      Toast.show('Plan updated', {
        duration: Toast.durations.SHORT,
        position: Toast.positions.BOTTOM - 80,
      });
    } else {
      await plannedEventRepository.createPlannedEvent(payload);
      Toast.show('Plan added to calendar', {
        duration: Toast.durations.SHORT,
        position: Toast.positions.BOTTOM - 80,
      });
    }
  };

  const handlePlanDelete = async (eventId: string) => {
    await plannedEventRepository.archivePlannedEvent(eventId);
    Toast.show('Plan removed', {
      duration: Toast.durations.SHORT,
      position: Toast.positions.BOTTOM - 80,
    });
  };

  const handleGenerateForEvent = async (event: PlannedEvent) => {
    const metadata = plannedSlotMetadataSchema.safeParse(event.metadata);
    const plannedSlot = metadata.success ? metadata.data : null;
    const baseDate = event.startsAt
      ? new Date(event.startsAt)
      : parseLocalDate(event.localDate);
    if (!event.startsAt) {
      baseDate.setHours(12, 0, 0, 0);
    }

    const scheduledDate = baseDate.getTime();
    const existingPlan = await workoutRepository.getPlannedWorkoutForDate(
      scheduledDate
    );
    const energy = event.intensity
      ? event.intensity === 'low'
        ? 'easy'
        : event.intensity === 'high'
        ? 'intense'
        : 'moderate'
      : undefined;

    const request: GenerationRequest = {
      timeMinutes: plannedSlot?.targetDurationMinutes ?? event.durationMinutes,
      energy,
      equipment: plannedSlot?.equipmentLocationAssumptions.equipment,
      focus: plannedSlot?.slotLabel,
      plannedSlotIntent: plannedSlot
        ? {
            role: plannedSlot.slotRole,
            label: plannedSlot.slotLabel,
            targetDurationMinutes: plannedSlot.targetDurationMinutes,
            equipmentLocationAssumptions:
              plannedSlot.equipmentLocationAssumptions,
            plannedDate: plannedSlot.plannedDate,
            templateId: plannedSlot.templateId,
            slotId: plannedSlot.slotId,
          }
        : undefined,
      notes: event.title ? `Planned workout: ${event.title}` : undefined,
    };

    Alert.alert(
      'Generate workout?',
      existingPlan
        ? 'A workout is already planned for that day. Generating will replace it.'
        : 'Generate a workout for this planned session?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: existingPlan ? 'Replace' : 'Generate',
          onPress: () => {
            const run = async () => {
              try {
                setGeneratingEventId(event.id);
                if (plannedSlot) {
                  await plannedEventRepository.updatePlannedEvent({
                    id: event.id,
                    metadata: {
                      ...plannedSlot,
                      detailState: 'generating',
                    },
                  });
                }
                const plan = await generateWorkout(request, { scheduledDate });
                const workout = await workoutRepository.getWorkoutByPlanId(
                  plan.id
                );
                if (workout) {
                  await plannedEventRepository.updatePlannedEvent({
                    id: event.id,
                    linkedWorkoutId: workout.id,
                    metadata: plannedSlot
                      ? {
                          ...plannedSlot,
                          detailState: 'generated',
                          linkedWorkoutId: workout.id,
                        }
                      : undefined,
                  });
                }
                Toast.show('Workout generated', {
                  duration: Toast.durations.SHORT,
                  position: Toast.positions.BOTTOM - 80,
                });
              } catch (error) {
                console.error('Failed to generate workout for plan', error);
                if (plannedSlot) {
                  await plannedEventRepository.updatePlannedEvent({
                    id: event.id,
                    metadata: {
                      ...plannedSlot,
                      detailState: 'error',
                    },
                  });
                }
                Alert.alert('Unable to generate', 'Please try again.');
              } finally {
                setGeneratingEventId(null);
              }
            };
            void run();
          },
        },
      ]
    );
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.screenTitle}>Activity</Text>
        <Text style={styles.screenSubtitle}>
          Track your progress over time.
        </Text>
      </View>

      <View style={styles.toggleContainer}>
        <Pressable
          style={[
            styles.toggleButton,
            viewMode === 'list' && styles.toggleButtonActive,
          ]}
          onPress={() => setViewMode('list')}
        >
          <Text
            style={[
              styles.toggleText,
              viewMode === 'list' && styles.toggleTextActive,
            ]}
          >
            List
          </Text>
        </Pressable>
        <Pressable
          style={[
            styles.toggleButton,
            viewMode === 'calendar' && styles.toggleButtonActive,
          ]}
          onPress={() => setViewMode('calendar')}
        >
          <Text
            style={[
              styles.toggleText,
              viewMode === 'calendar' && styles.toggleTextActive,
            ]}
          >
            Calendar
          </Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {viewMode === 'calendar' ? (
          <>
            <HistoryCalendar
              calendarView={calendarView}
              calendarHeaderDate={calendarHeaderDate}
              selectedDate={selectedDate}
              visibleCalendarCells={visibleCalendarCells}
              itemsByDate={itemsByDate}
              onPrevRange={handlePrevRange}
              onNextRange={handleNextRange}
              onToggleView={handleToggleCalendarView}
              onSelectDate={handleSelectDate}
            />

            {selectedDate ? (
              <>
                <Text style={styles.dayHeader}>
                  {formatDayHeader(selectedDate)}
                </Text>
                <View style={styles.dayActions}>
                  <Button
                    label="Quick log"
                    variant="primary"
                    icon={
                      <Ionicons
                        name="add"
                        size={18}
                        color={palette.textInverse}
                      />
                    }
                    onPress={() => setShowQuickLog(true)}
                    style={{ flex: 1 }}
                  />
                  <Button
                    label="Plan event"
                    variant="secondary"
                    icon={
                      <Ionicons
                        name="calendar-outline"
                        size={18}
                        color={palette.textPrimary}
                      />
                    }
                    onPress={() => {
                      setEditingEvent(null);
                      setShowPlanSheet(true);
                    }}
                    style={{ flex: 1 }}
                  />
                </View>

                {agendaItems.length === 0 ? (
                  <Text style={styles.emptyText}>
                    No activity planned or completed yet.
                  </Text>
                ) : (
                  agendaItems.map((item) => (
                    <HistoryAgendaItem
                      key={
                        item.type === 'planned-event'
                          ? item.eventId
                          : item.sessionId
                      }
                      item={item}
                      plannedEvent={
                        item.type === 'planned-event'
                          ? plannedEventById.get(item.eventId)
                          : undefined
                      }
                      session={
                        item.type === 'workout-session'
                          ? sessionById.get(item.sessionId)
                          : undefined
                      }
                      isGenerating={
                        item.type === 'planned-event' &&
                        generatingEventId === item.eventId
                      }
                      onEditEvent={handleEditEvent}
                      onGenerateWorkout={handleGenerateForEvent}
                      onOpenLinkedWorkout={handleOpenLinkedWorkout}
                      onOpenSession={handleOpenSession}
                    />
                  ))
                )}
              </>
            ) : (
              <>
                <Text style={styles.sectionTitle}>Recent activity</Text>
                {recentSessions.length === 0 ? (
                  <Text style={styles.emptyText}>
                    No completed workouts yet.
                  </Text>
                ) : (
                  recentSessions.map((session) => (
                    <HistorySessionCard
                      key={session.id}
                      session={session}
                      onOpen={handleOpenSession}
                    />
                  ))
                )}
              </>
            )}
          </>
        ) : (
          <>
            <View style={styles.filterRow}>
              <Chip
                label={includeArchived ? 'Hide archived' : 'Show archived'}
                onPress={() => setIncludeArchived((prev) => !prev)}
                selected={includeArchived}
                style={styles.filterChip}
              />
            </View>

            {history.length === 0 ? (
              loadingHistory ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator color={palette.primary} />
                  <Text style={styles.loadingText}>Loading history…</Text>
                </View>
              ) : (
                <Text style={styles.emptyText}>No completed workouts yet.</Text>
              )
            ) : (
              history.map((session) => (
                <HistorySessionCard
                  key={session.id}
                  session={session}
                  showActions
                  onOpen={handleOpenSession}
                  onToggleArchive={handleArchiveToggle}
                  onToggleFavorite={handleFavoriteToggle}
                  onDelete={handleDelete}
                />
              ))
            )}
          </>
        )}
      </ScrollView>

      <BottomNavigation />

      <QuickLogSheet
        visible={showQuickLog}
        initialDate={selectedDate ? parseLocalDate(selectedDate) : new Date()}
        onSubmit={handleQuickLogSubmit}
        onClose={() => setShowQuickLog(false)}
      />

      <PlannedEventSheet
        visible={showPlanSheet}
        initialDate={selectedDate ? parseLocalDate(selectedDate) : new Date()}
        event={editingEvent}
        onSave={handlePlanSave}
        onDelete={handlePlanDelete}
        onClose={() => {
          setShowPlanSheet(false);
          setEditingEvent(null);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.background,
  },
  header: {
    paddingHorizontal: 20,
  },
  screenTitle: {
    fontSize: 32,
    fontFamily: typography.fontFamilyExtraBold,
    color: palette.textPrimary,
  },
  screenSubtitle: {
    fontSize: 16,
    fontFamily: typography.fontFamily,
    color: palette.textSecondary,
    marginTop: 4,
  },
  toggleContainer: {
    flexDirection: 'row',
    marginTop: 20,
    marginHorizontal: 20,
    borderRadius: 16,
    backgroundColor: palette.cardSecondary,
    padding: 4,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.border,
  },
  toggleText: {
    fontSize: 14,
    fontFamily: typography.fontFamilyBold,
    color: palette.textMuted,
  },
  toggleTextActive: {
    color: palette.primary,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: layout.bottomNavHeight + 40,
  },
  dayHeader: {
    marginTop: 24,
    marginBottom: 12,
    fontSize: 14,
    fontFamily: typography.fontFamilyBold,
    color: palette.textMuted,
    letterSpacing: 1,
  },
  dayActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  sectionTitle: {
    marginTop: 24,
    marginBottom: 12,
    fontSize: 16,
    fontFamily: typography.fontFamilyBold,
    color: palette.textPrimary,
  },
  emptyText: {
    textAlign: 'center',
    color: palette.textMuted,
    fontSize: 14,
    marginTop: 12,
  },
  filterRow: {
    marginBottom: 16,
  },
  filterChip: {
    alignSelf: 'flex-start',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  loadingText: {
    marginTop: 12,
    color: palette.textMuted,
    fontSize: 14,
  },
});
