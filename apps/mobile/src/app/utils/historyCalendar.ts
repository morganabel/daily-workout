import { Ionicons } from '@expo/vector-icons';
import type { CalendarItem } from '@leveza/shared';
import { palette } from '../theme';
import { endOfDay, formatLocalDate, parseLocalDate, startOfDay } from './date';

export type CalendarView = 'month' | 'week';

export type CalendarCell = {
  date: Date;
  localDate: string;
  isCurrentMonth: boolean;
};

type EventKindMeta = {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  background: string;
};

export const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const EVENT_KIND_META: Record<string, EventKindMeta> = {
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

export const getKindMeta = (kind: string): EventKindMeta =>
  EVENT_KIND_META[kind] ?? {
    ...EVENT_KIND_META.other,
    icon: 'calendar',
  };

export const formatMonthLabel = (date: Date) =>
  date.toLocaleDateString([], { month: 'long', year: 'numeric' });

export const formatDayHeader = (localDate: string) => {
  const date = parseLocalDate(localDate);
  return date
    .toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })
    .toUpperCase();
};

export const formatTime = (date: Date) =>
  date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

export const getMonthStart = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), 1);

const getMonthEnd = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth() + 1, 0);

export const getMonthRange = (date: Date) => {
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

export const buildCalendarCells = (currentMonth: Date): CalendarCell[] => {
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

export const buildWeekCells = (anchorDate: Date): CalendarCell[] => {
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

export const sortAgendaItems = (items: CalendarItem[]) => {
  const getSortMeta = (item: CalendarItem) => {
    if (item.type === 'planned-event') {
      const hasTime = Boolean(item.startsAt) && !item.allDay;
      return {
        allDay: !hasTime,
        timestamp:
          hasTime && item.startsAt ? new Date(item.startsAt).getTime() : 0,
      };
    }
    if (item.type === 'planned-workout') {
      return {
        allDay: false,
        timestamp: item.scheduledAt ? new Date(item.scheduledAt).getTime() : 0,
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
