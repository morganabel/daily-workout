/**
 * Compact, coach-managed upcoming plan rendered inline on Home.
 *
 * Surfaces the forward coach projection as a scannable list: each session shows
 * its date, block, and status (projected / pinned / skipped / repaired /
 * conflict) with low-friction actions (skip, pin, unpin, move, generate).
 * Pinned conflicts surface explicit repair actions and never silently move a
 * pinned session. Internal strategy ids and slot mechanics are intentionally
 * kept out of the copy — only outcome-level labels are shown.
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type {
  CoachProjectedSession,
  CoachProjectionActionType,
  CoachProjectionConflictWarning,
  CoachProjectionSessionStatus,
} from '@workout-agent/shared';
import type { HomeCoachPlanView } from '../hooks/useHomeData';
import { palette, typography } from '../theme';
import { Card } from './DesignSystem';
import { formatLocalDate, parseLocalDate } from '../utils/date';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const formatSessionDate = (localDate: string): string => {
  const date = parseLocalDate(localDate);
  return `${WEEKDAYS[date.getDay()]}, ${MONTHS[date.getMonth()]} ${date.getDate()}`;
};

const addDaysToLocalDate = (localDate: string, days: number): string => {
  const date = parseLocalDate(localDate);
  date.setDate(date.getDate() + days);
  return formatLocalDate(date);
};

const STATUS_META: Record<
  CoachProjectionSessionStatus,
  { label: string; color: string; background: string }
> = {
  projected: {
    label: 'Projected',
    color: palette.primaryDark,
    background: palette.cardSecondary,
  },
  pinned: {
    label: 'Pinned',
    color: palette.accentIndigo,
    background: '#EEF2FF',
  },
  skipped: {
    label: 'Skipped',
    color: palette.textMuted,
    background: palette.cardSecondary,
  },
  repaired: {
    label: 'Adjusted',
    color: palette.warning,
    background: palette.warningBg,
  },
  conflict: {
    label: 'Conflict',
    color: palette.destructive,
    background: palette.destructiveBg,
  },
};

const ACTION_META: Record<
  Exclude<CoachProjectionActionType, 'keep-pinned'>,
  { label: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  generate: { label: 'Generate', icon: 'flash-outline' },
  pin: { label: 'Pin', icon: 'bookmark-outline' },
  unpin: { label: 'Unpin', icon: 'bookmark' },
  move: { label: 'Move to next day', icon: 'arrow-forward-outline' },
  skip: { label: 'Skip', icon: 'play-skip-forward-outline' },
};

const CONFLICT_ACTION_LABEL: Record<CoachProjectionActionType, string> = {
  'keep-pinned': 'Keep pinned',
  move: 'Move',
  unpin: 'Unpin',
  generate: 'Regenerate around conflict',
  pin: 'Pin',
  skip: 'Skip',
};

export type CoachUpcomingPlanProps = {
  coachPlan: HomeCoachPlanView;
  isBusy?: boolean;
  onSkip: (projectionId: string) => void;
  onPin: (projectionId: string) => void;
  onUnpin: (projectionId: string) => void;
  onMove: (projectionId: string, localDate: string) => void;
  onGenerate: (projectionId: string) => void;
  onResolveConflict: (
    warning: CoachProjectionConflictWarning,
    action: CoachProjectionActionType
  ) => void;
};

const ActionPill = ({
  label,
  icon,
  disabled,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  onPress: () => void;
}) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={label}
    accessibilityState={{ disabled: Boolean(disabled) }}
    disabled={disabled}
    onPress={onPress}
    style={({ pressed }) => [
      styles.actionPill,
      pressed && styles.actionPillPressed,
      disabled && styles.actionPillDisabled,
    ]}
  >
    <Ionicons name={icon} size={14} color={palette.textSecondary} />
    <Text style={styles.actionPillText}>{label}</Text>
  </Pressable>
);

const SessionRow = ({
  session,
  isBusy,
  onSkip,
  onPin,
  onUnpin,
  onMove,
  onGenerate,
}: {
  session: CoachProjectedSession;
} & Omit<CoachUpcomingPlanProps, 'coachPlan' | 'onResolveConflict'>) => {
  const status = STATUS_META[session.status];
  const blockLabel = session.blockLabel ?? 'Rest';
  const rationale =
    session.rationale.find((entry) => entry.message)?.message ??
    session.coachNotes.find((note) => note) ??
    null;

  const handleAction = (action: CoachProjectionActionType) => {
    switch (action) {
      case 'skip':
        onSkip(session.id);
        break;
      case 'pin':
        onPin(session.id);
        break;
      case 'unpin':
        onUnpin(session.id);
        break;
      case 'move':
        onMove(session.id, addDaysToLocalDate(session.localDate, 1));
        break;
      case 'generate':
        onGenerate(session.id);
        break;
      default:
        break;
    }
  };

  const rowActions = session.availableActions.filter(
    (action): action is Exclude<CoachProjectionActionType, 'keep-pinned'> =>
      action !== 'keep-pinned'
  );

  return (
    <View
      style={styles.sessionRow}
      accessibilityLabel={`${formatSessionDate(session.localDate)}, ${blockLabel}, ${status.label}`}
    >
      <View style={styles.sessionHeader}>
        <View style={styles.sessionHeaderText}>
          <Text style={styles.sessionDate}>
            {formatSessionDate(session.localDate)}
          </Text>
          <Text style={styles.sessionLabel}>{blockLabel}</Text>
        </View>
        <View
          style={[styles.statusBadge, { backgroundColor: status.background }]}
        >
          <Text style={[styles.statusBadgeText, { color: status.color }]}>
            {status.label}
          </Text>
        </View>
      </View>

      {rationale ? (
        <Text style={styles.sessionRationale} numberOfLines={2}>
          {rationale}
        </Text>
      ) : null}

      {rowActions.length > 0 ? (
        <View style={styles.actionRow}>
          {rowActions.map((action) => (
            <ActionPill
              key={action}
              label={ACTION_META[action].label}
              icon={ACTION_META[action].icon}
              disabled={isBusy}
              onPress={() => handleAction(action)}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
};

const ConflictWarning = ({
  warning,
  isBusy,
  onResolveConflict,
}: {
  warning: CoachProjectionConflictWarning;
  isBusy?: boolean;
  onResolveConflict: CoachUpcomingPlanProps['onResolveConflict'];
}) => (
  <View
    style={styles.conflictCard}
    accessibilityLabel={`Conflict: ${warning.message}`}
  >
    <View style={styles.conflictHeader}>
      <Ionicons name="warning-outline" size={16} color={palette.destructive} />
      <Text style={styles.conflictMessage}>{warning.message}</Text>
    </View>
    {warning.actions.length > 0 ? (
      <View style={styles.actionRow}>
        {warning.actions.map((action) => (
          <ActionPill
            key={action}
            label={CONFLICT_ACTION_LABEL[action]}
            icon="construct-outline"
            disabled={isBusy}
            onPress={() => onResolveConflict(warning, action)}
          />
        ))}
      </View>
    ) : null}
  </View>
);

export const CoachUpcomingPlan = ({
  coachPlan,
  isBusy,
  onSkip,
  onPin,
  onUnpin,
  onMove,
  onGenerate,
  onResolveConflict,
}: CoachUpcomingPlanProps) => {
  const { upcomingSessions, conflictWarnings, repairNotes } = coachPlan;

  if (
    upcomingSessions.length === 0 &&
    conflictWarnings.length === 0 &&
    repairNotes.length === 0
  ) {
    return null;
  }

  return (
    <Card style={styles.card} variant="flat">
      <Text style={styles.sectionLabel}>UPCOMING</Text>

      {conflictWarnings.map((warning) => (
        <ConflictWarning
          key={warning.id}
          warning={warning}
          isBusy={isBusy}
          onResolveConflict={onResolveConflict}
        />
      ))}

      {repairNotes.length > 0 ? (
        <Text style={styles.repairNote}>{repairNotes[0]}</Text>
      ) : null}

      <View style={styles.sessionList}>
        {upcomingSessions.map((session) => (
          <SessionRow
            key={session.id}
            session={session}
            isBusy={isBusy}
            onSkip={onSkip}
            onPin={onPin}
            onUnpin={onUnpin}
            onMove={onMove}
            onGenerate={onGenerate}
          />
        ))}
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginTop: 16,
    gap: 12,
  } as ViewStyle,
  sectionLabel: {
    fontFamily: typography.fontFamilyBold,
    fontSize: 12,
    color: palette.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  sessionList: {
    gap: 10,
  },
  sessionRow: {
    backgroundColor: palette.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 12,
    gap: 8,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sessionHeaderText: {
    flex: 1,
    gap: 2,
  },
  sessionDate: {
    fontFamily: typography.fontFamily,
    fontSize: 12,
    color: palette.textSecondary,
  },
  sessionLabel: {
    fontFamily: typography.fontFamilyBold,
    fontSize: 15,
    color: palette.textPrimary,
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  statusBadgeText: {
    fontFamily: typography.fontFamilyBold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sessionRationale: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    color: palette.textSecondary,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.background,
  },
  actionPillPressed: {
    opacity: 0.7,
  },
  actionPillDisabled: {
    opacity: 0.5,
  },
  actionPillText: {
    fontFamily: typography.fontFamilyBold,
    fontSize: 12,
    color: palette.textSecondary,
  },
  conflictCard: {
    backgroundColor: palette.destructiveBg,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  conflictHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  conflictMessage: {
    flex: 1,
    fontFamily: typography.fontFamilyBold,
    fontSize: 13,
    color: palette.textPrimary,
  },
  repairNote: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    color: palette.textSecondary,
    fontStyle: 'italic',
  },
});
