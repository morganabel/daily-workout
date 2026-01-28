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
import Toast from 'react-native-root-toast';
import { Ionicons } from '@expo/vector-icons';
import type {
  CalendarItem,
  GenerationRequest,
  PlannedEvent,
  PlannedEventInput,
  PlannedEventPatch,
  WorkoutSessionSummary,
} from '@workout-agent/shared';
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
import { Button, Card, Chip } from './components/DesignSystem';
import { QuickLogSheet } from './components/QuickLogSheet';
import { PlannedEventSheet } from './components/PlannedEventSheet';
import {
  endOfDay,
  formatLocalDate,
  isSameDay,
  parseLocalDate,
  startOfDay,
} from './utils/date';

type HistoryNav = NativeStackNavigationProp<RootStackParamList, 'History'>;

type ViewMode = 'calendar' | 'list';

type CalendarView = 'month' | 'week';

type CalendarCell = {
  date: Date;
  localDate: string;
  isCurrentMonth: boolean;
};

const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const EVENT_KIND_META: Record<
  string,
  { icon: keyof typeof Ionicons.glyphMap; color: string; background: string }
> = {
  workout: {
    icon: 'barbell',
    color: palette.primary,
    background: '#E0F2FE',
  },
  hike: {
    icon: 'walk',
    color: palette.success,
    background: palette.successBg,
  },
  run: {
    icon: 'speedometer',
    color: palette.accentIndigo,
    background: '#E0E7FF',
  },
  sport: {
    icon: 'football',
    color: palette.accentPurple,
    background: '#F3E8FF',
  },
  rest: {
    icon: 'moon',
    color: palette.textSecondary,
    background: palette.cardSecondary,
  },
  travel: {
    icon: 'airplane',
    color: palette.warning,
    background: palette.warningBg,
  },
  other: {
    icon: 'ellipsis-horizontal',
    color: palette.textSecondary,
    background: palette.cardSecondary,
  },
};

const getKindMeta = (kind: string) =>
  EVENT_KIND_META[kind] ?? {
    ...EVENT_KIND_META.other,
    icon: 'calendar',
  };

const formatMonthLabel = (date: Date) =>
  date.toLocaleDateString([], { month: 'long', year: 'numeric' });

const formatDayHeader = (localDate: string) => {
  const date = parseLocalDate(localDate);
  return date
    .toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })
    .toUpperCase();
};

const formatTime = (date: Date) =>
  date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

const getMonthStart = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), 1);
const getMonthEnd = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth() + 1, 0);

const getMonthRange = (date: Date) => {
  const start = getMonthStart(date);
  const end = getMonthEnd(date);
  return {
    start,
    end,
    startTimestamp: startOfDay(start).getTime(),
    endTimestamp: endOfDay(end).getTime(),
    startLocalDate: formatLocalDate(start),
    endLocalDate: formatLocalDate(end),
  };
};

const getCalendarGridStart = (date: Date) => {
  const start = getMonthStart(date);
  const offset = start.getDay();
  const gridStart = new Date(start);
  gridStart.setDate(start.getDate() - offset);
  return gridStart;
};

const buildCalendarCells = (currentMonth: Date): CalendarCell[] => {
  const start = getCalendarGridStart(currentMonth);
  return Array.from({ length: 42 }, (_, index) => {
    const cellDate = new Date(start);
    cellDate.setDate(start.getDate() + index);
    return {
      date: cellDate,
      localDate: formatLocalDate(cellDate),
      isCurrentMonth:
        cellDate.getMonth() === currentMonth.getMonth() &&
        cellDate.getFullYear() === currentMonth.getFullYear(),
    };
  });
};

const getWeekStart = (date: Date) => {
  const start = new Date(date);
  start.setDate(start.getDate() - start.getDay());
  return start;
};

const buildWeekCells = (anchorDate: Date): CalendarCell[] => {
  const start = getWeekStart(anchorDate);
  return Array.from({ length: 7 }, (_, index) => {
    const cellDate = new Date(start);
    cellDate.setDate(start.getDate() + index);
    return {
      date: cellDate,
      localDate: formatLocalDate(cellDate),
      isCurrentMonth:
        cellDate.getMonth() === anchorDate.getMonth() &&
        cellDate.getFullYear() === anchorDate.getFullYear(),
    };
  });
};

const sortAgendaItems = (items: CalendarItem[]) => {
  const getSortMeta = (item: CalendarItem) => {
    if (item.type === 'planned-event') {
      const hasTime = Boolean(item.startsAt) && !item.allDay;
      return {
        allDay: !hasTime,
        timestamp:
          hasTime && item.startsAt ? new Date(item.startsAt).getTime() : 0,
      };
    }
    return {
      allDay: false,
      timestamp: item.completedAt ? new Date(item.completedAt).getTime() : 0,
    };
  };

  return items.slice().sort((a, b) => {
    const metaA = getSortMeta(a);
    const metaB = getSortMeta(b);
    if (metaA.allDay !== metaB.allDay) {
      return metaA.allDay ? 1 : -1;
    }
    return metaA.timestamp - metaB.timestamp;
  });
};

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

  const monthRange = useMemo(() => getMonthRange(currentMonth), [currentMonth]);

  useEffect(() => {
    const subscription = workoutRepository
      .observeCompletedSessionsByDateRange(
        monthRange.startTimestamp,
        monthRange.endTimestamp,
        { includeArchived: false }
      )
      .subscribe((workouts) => {
        const summaries = workouts.map((workout) =>
          workoutRepository.toSessionSummary(workout)
        );
        setMonthSessions(summaries);
      });

    return () => subscription.unsubscribe();
  }, [monthRange.endTimestamp, monthRange.startTimestamp]);

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

  const plannedEventsForMonth = useMemo(
    () =>
      plannedEvents.filter(
        (event) =>
          event.localDate >= monthRange.startLocalDate &&
          event.localDate <= monthRange.endLocalDate
      ),
    [monthRange.endLocalDate, monthRange.startLocalDate, plannedEvents]
  );

  const plannedEventById = useMemo(() => {
    const map = new Map<string, PlannedEvent>();
    plannedEvents.forEach((event) => map.set(event.id, event));
    return map;
  }, [plannedEvents]);

  const calendarItems = useMemo<CalendarItem[]>(() => {
    const sessionItems = monthSessions.map((session) => ({
      type: 'workout-session' as const,
      localDate: formatLocalDate(new Date(session.completedAt)),
      sessionId: session.id,
      title: session.name,
      completedAt: session.completedAt,
      durationMinutes: session.durationMinutes,
    }));

    const eventItems = plannedEventsForMonth.map((event) => ({
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
  }, [monthSessions, plannedEventsForMonth]);

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
      timeMinutes: event.durationMinutes,
      energy,
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
                const plan = await generateWorkout(request, { scheduledDate });
                const workout = await workoutRepository.getWorkoutByPlanId(
                  plan.id
                );
                if (workout) {
                  await plannedEventRepository.updatePlannedEvent({
                    id: event.id,
                    linkedWorkoutId: workout.id,
                  });
                }
                Toast.show('Workout generated', {
                  duration: Toast.durations.SHORT,
                  position: Toast.positions.BOTTOM - 80,
                });
              } catch (error) {
                console.error('Failed to generate workout for plan', error);
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

  const renderSessionCard = (
    session: WorkoutSessionSummary,
    options?: { showActions?: boolean }
  ) => {
    const showActions = options?.showActions ?? false;
    return (
      <Card key={session.id} style={styles.card}>
        <Pressable onPress={() => handleOpenSession(session)}>
          <View style={styles.cardHeader}>
            <View style={styles.cardInfo}>
              <Text style={styles.workoutName}>{session.name}</Text>
              <Text style={styles.workoutFocus}>{session.focus}</Text>
            </View>
            {showActions && (
              <Pressable
                onPress={() => handleFavoriteToggle(session)}
                hitSlop={10}
              >
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

          {showActions && (
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
          )}
        </Pressable>
      </Card>
    );
  };

  const renderAgendaItem = (item: CalendarItem) => {
    if (item.type === 'planned-event') {
      const event = plannedEventById.get(item.eventId);
      const meta = getKindMeta(item.kind);
      const timeLabel = item.allDay
        ? 'All day'
        : item.startsAt
        ? formatTime(new Date(item.startsAt))
        : 'Any time';
      const showGenerate =
        item.kind === 'workout' && item.localDate > formatLocalDate(new Date());

      return (
        <Pressable
          key={item.eventId}
          onPress={() => {
            if (event) {
              setEditingEvent(event);
              setShowPlanSheet(true);
            }
          }}
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
                {event?.durationMinutes
                  ? ` • ${event.durationMinutes} min`
                  : ''}
              </Text>
            </View>
            {showGenerate && event && (
              <Pressable
                style={styles.agendaAction}
                onPress={() => handleGenerateForEvent(event)}
                disabled={generatingEventId === event.id}
              >
                <Text style={styles.agendaActionText}>
                  {generatingEventId === event.id ? 'Generating…' : 'Generate'}
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
        key={item.sessionId}
        onPress={() => {
          const session = monthSessions.find((s) => s.id === item.sessionId);
          if (session) handleOpenSession(session);
        }}
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
              {completedAt}
              {item.durationMinutes ? ` • ${item.durationMinutes} min` : ''}
            </Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={20}
            color={palette.textMuted}
          />
        </View>
      </Pressable>
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
            <Card style={styles.calendarCard}>
              <View style={styles.calendarHeader}>
                <Pressable
                  style={styles.calendarNavButton}
                  onPress={handlePrevRange}
                >
                  <Ionicons
                    name="chevron-back"
                    size={20}
                    color={palette.textSecondary}
                  />
                </Pressable>
                <Pressable
                  style={styles.calendarTitleButton}
                  onPress={handleToggleCalendarView}
                  disabled={!selectedDate}
                >
                  <Text style={styles.calendarTitle}>
                    {formatMonthLabel(calendarHeaderDate)}
                  </Text>
                  {selectedDate && (
                    <Ionicons
                      name={
                        calendarView === 'week' ? 'chevron-down' : 'chevron-up'
                      }
                      size={16}
                      color={palette.textMuted}
                    />
                  )}
                </Pressable>
                <Pressable
                  style={styles.calendarNavButton}
                  onPress={handleNextRange}
                >
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={palette.textSecondary}
                  />
                </Pressable>
              </View>

              <View style={styles.weekRow}>
                {WEEKDAY_LABELS.map((label) => (
                  <Text key={label} style={styles.weekLabel}>
                    {label}
                  </Text>
                ))}
              </View>

              <View style={styles.calendarGrid}>
                {visibleCalendarCells.map((cell) => {
                  const isToday = isSameDay(cell.date, new Date());
                  const isSelected = selectedDate === cell.localDate;
                  const markerCount = Math.min(
                    itemsByDate.get(cell.localDate)?.length ?? 0,
                    3
                  );
                  return (
                    <Pressable
                      key={cell.localDate}
                      style={styles.calendarCell}
                      onPress={() => handleSelectDate(cell)}
                    >
                      <View
                        style={[
                          styles.calendarCellInner,
                          isSelected && styles.calendarCellSelected,
                          isToday && styles.calendarCellToday,
                        ]}
                      >
                        <Text
                          style={[
                            styles.calendarCellText,
                            !cell.isCurrentMonth && styles.calendarCellMuted,
                            isSelected && styles.calendarCellTextSelected,
                          ]}
                        >
                          {cell.date.getDate()}
                        </Text>
                        {markerCount > 0 && (
                          <View style={styles.markerRow}>
                            {Array.from({ length: markerCount }).map(
                              (_, index) => (
                                <View
                                  key={`${cell.localDate}-marker-${index}`}
                                  style={styles.markerDot}
                                />
                              )
                            )}
                          </View>
                        )}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </Card>

            {selectedDate ? (
              <>
                <Text style={styles.dayHeader}>
                  {formatDayHeader(selectedDate)}
                </Text>
                <View style={styles.dayActions}>
                  <Button
                    label="Quick log"
                    variant="secondary"
                    onPress={() => setShowQuickLog(true)}
                    style={{ flex: 1 }}
                  />
                  <Button
                    label="Plan event"
                    variant="outline"
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
                  agendaItems.map(renderAgendaItem)
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
                  recentSessions.map((session) =>
                    renderSessionCard(session, { showActions: false })
                  )
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
              history.map((session) =>
                renderSessionCard(session, { showActions: true })
              )
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
  calendarCard: {
    padding: 16,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  calendarNavButton: {
    padding: 6,
  },
  calendarTitleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  calendarTitle: {
    fontSize: 18,
    fontFamily: typography.fontFamilyBold,
    color: palette.textPrimary,
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  weekLabel: {
    width: 32,
    textAlign: 'center',
    fontSize: 12,
    fontFamily: typography.fontFamily,
    color: palette.textMuted,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarCell: {
    width: '14.28%',
    alignItems: 'center',
    paddingVertical: 6,
  },
  calendarCellInner: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  calendarCellToday: {
    borderWidth: 1,
    borderColor: palette.borderDark,
  },
  calendarCellSelected: {
    backgroundColor: palette.primary,
  },
  calendarCellText: {
    fontSize: 14,
    fontFamily: typography.fontFamilyBold,
    color: palette.textPrimary,
  },
  calendarCellTextSelected: {
    color: palette.textInverse,
  },
  calendarCellMuted: {
    color: palette.textMuted,
  },
  markerRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 4,
  },
  markerDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.primary,
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
