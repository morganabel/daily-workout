import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { CalendarItem } from '@workout-agent/shared';
import { Card } from './DesignSystem';
import { palette, typography } from '../theme';
import { isSameDay } from '../utils/date';
import {
  type CalendarCell,
  type CalendarView,
  WEEKDAY_LABELS,
  formatMonthLabel,
} from '../utils/historyCalendar';

type HistoryCalendarProps = {
  calendarView: CalendarView;
  calendarHeaderDate: Date;
  selectedDate: string | null;
  visibleCalendarCells: CalendarCell[];
  itemsByDate: Map<string, CalendarItem[]>;
  onPrevRange: () => void;
  onNextRange: () => void;
  onToggleView: () => void;
  onSelectDate: (cell: CalendarCell) => void;
};

export const HistoryCalendar = ({
  calendarView,
  calendarHeaderDate,
  selectedDate,
  visibleCalendarCells,
  itemsByDate,
  onPrevRange,
  onNextRange,
  onToggleView,
  onSelectDate,
}: HistoryCalendarProps) => (
  <Card style={styles.calendarCard}>
    <View style={styles.calendarHeader}>
      <Pressable style={styles.calendarNavButton} onPress={onPrevRange}>
        <Ionicons name="chevron-back" size={20} color={palette.textSecondary} />
      </Pressable>
      <Pressable
        style={styles.calendarTitleButton}
        onPress={onToggleView}
        disabled={!selectedDate}
      >
        <Text style={styles.calendarTitle}>
          {formatMonthLabel(calendarHeaderDate)}
        </Text>
        {selectedDate && (
          <Ionicons
            name={calendarView === 'week' ? 'chevron-down' : 'chevron-up'}
            size={16}
            color={palette.textMuted}
          />
        )}
      </Pressable>
      <Pressable style={styles.calendarNavButton} onPress={onNextRange}>
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
            onPress={() => onSelectDate(cell)}
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
                  {Array.from({ length: markerCount }).map((_, index) => (
                    <View
                      key={`${cell.localDate}-marker-${index}`}
                      style={styles.markerDot}
                    />
                  ))}
                </View>
              )}
            </View>
          </Pressable>
        );
      })}
    </View>
  </Card>
);

const styles = StyleSheet.create({
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
});
