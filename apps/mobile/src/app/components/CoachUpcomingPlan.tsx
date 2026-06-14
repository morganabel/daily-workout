/**
 * Compact, coach-managed future preview rendered inline on Home.
 *
 * Home should show what is coming next without turning into a planner editor.
 * Rows are intentionally read-only; session actions live behind the main card
 * options or in Activity/detail surfaces. Pinned conflicts remain actionable
 * because they need an explicit user decision.
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
import { parseLocalDate } from '../utils/date';

const PREVIEW_SESSION_LIMIT = 3;

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
  return `${WEEKDAYS[date.getDay()]}, ${
    MONTHS[date.getMonth()]
  } ${date.getDate()}`;
};

const STATUS_META: Record<
  CoachProjectionSessionStatus,
  { label: string | null; color: string; background: string }
> = {
  projected: {
    label: null,
    color: palette.primaryDark,
    background: palette.cardSecondary,
  },
  pinned: {
    label: null,
    color: palette.primaryDark,
    background: palette.cardSecondary,
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
    label: 'Review',
    color: palette.destructive,
    background: palette.destructiveBg,
  },
};

const CONFLICT_ACTION_LABEL: Record<CoachProjectionActionType, string> = {
  'keep-pinned': 'Keep pinned',
  move: 'Move',
  unpin: 'Unpin',
  generate: 'Regenerate around conflict',
  pin: 'Pin',
  skip: 'Skip',
};

const getSessionIconName = (
  session: CoachProjectedSession
): keyof typeof Ionicons.glyphMap => {
  const label = (session.blockLabel ?? '').toLowerCase();
  if (label.includes('run') || label.includes('cardio')) {
    return 'walk-outline';
  }
  if (label.includes('rest') || !session.sourceBlockId) {
    return 'bed-outline';
  }
  return 'barbell-outline';
};

export type CoachUpcomingPlanProps = {
  coachPlan: HomeCoachPlanView;
  isBusy?: boolean;
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

const SessionRow = ({ session }: { session: CoachProjectedSession }) => {
  const status = STATUS_META[session.status];
  const blockLabel = session.blockLabel ?? 'Rest';
  const iconName = getSessionIconName(session);
  const isRest = iconName === 'bed-outline';
  const accessibilityStatus = status.label ?? 'Planned';

  return (
    <View
      style={[styles.sessionRow, isRest && styles.restSessionRow]}
      accessibilityLabel={`${formatSessionDate(
        session.localDate
      )}, ${blockLabel}, ${accessibilityStatus}`}
    >
      {!isRest ? <View style={styles.sessionAccent} /> : null}
      <View style={[styles.sessionIcon, isRest && styles.restSessionIcon]}>
        <Ionicons
          name={iconName}
          size={20}
          color={isRest ? palette.textMuted : palette.primary}
        />
      </View>
      <View style={styles.sessionTextGroup}>
        <Text style={styles.sessionLabel}>{blockLabel}</Text>
        <View style={styles.sessionMetaRow}>
          <Text style={styles.sessionDate}>
            {formatSessionDate(session.localDate)}
          </Text>
          {status.label ? (
            <>
              <Text style={styles.sessionDot}>•</Text>
              <Text style={[styles.sessionStatusText, { color: status.color }]}>
                {status.label}
              </Text>
            </>
          ) : null}
        </View>
      </View>
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
  onResolveConflict,
}: CoachUpcomingPlanProps) => {
  const { upcomingSessions, conflictWarnings, repairNotes } = coachPlan;
  const previewSessions = upcomingSessions
    .filter((session) => session.status !== 'skipped')
    .slice(0, PREVIEW_SESSION_LIMIT);

  if (
    previewSessions.length === 0 &&
    conflictWarnings.length === 0 &&
    repairNotes.length === 0
  ) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.sectionLabel}>COMING UP</Text>

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
        {previewSessions.map((session) => (
          <SessionRow key={session.id} session={session} />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
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
    position: 'relative',
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: palette.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.border,
    paddingVertical: 14,
    paddingHorizontal: 14,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  restSessionRow: {
    backgroundColor: '#F0F9FF',
    borderColor: '#BAE6FD',
    borderStyle: 'dashed',
  },
  sessionAccent: {
    position: 'absolute',
    left: 0,
    top: 14,
    bottom: 14,
    width: 4,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
    backgroundColor: palette.primary,
  },
  sessionIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E0F2FE',
  },
  restSessionIcon: {
    backgroundColor: palette.card,
  },
  sessionTextGroup: {
    flex: 1,
    gap: 4,
  },
  sessionDate: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    color: palette.textSecondary,
  },
  sessionLabel: {
    fontFamily: typography.fontFamilyBold,
    fontSize: 16,
    color: palette.textPrimary,
  },
  sessionMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sessionDot: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    color: palette.textMuted,
  },
  sessionStatusText: {
    fontFamily: typography.fontFamilyBold,
    fontSize: 13,
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
