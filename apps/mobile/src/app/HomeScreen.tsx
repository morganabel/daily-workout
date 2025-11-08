import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  QuickActionMetadata,
  TodayPlan,
  WorkoutSessionSummary,
} from './types/home';

const palette = {
  background: '#030914',
  card: '#0d1322',
  cardSecondary: '#111a30',
  border: '#1d2943',
  accent: '#6efacc',
  accentMuted: '#233746',
  textPrimary: '#f5f6fb',
  textSecondary: '#9cabc4',
  textMuted: '#5c6a85',
  warning: '#ffb347',
  destructive: '#ff6b6b',
};

const quickActions: QuickActionMetadata[] = [
  {
    key: 'time',
    label: 'Time',
    description: '15 min',
  },
  {
    key: 'focus',
    label: 'Focus',
    description: 'Upper body',
  },
  {
    key: 'equipment',
    label: 'Equipment',
    description: 'Dumbbells',
  },
  {
    key: 'energy',
    label: 'Energy',
    description: 'Medium',
  },
  {
    key: 'backfill',
    label: 'Backfill',
    description: 'Log later',
  },
];

type HomeDataState = {
  status: 'loading' | 'ready' | 'empty';
  plan: TodayPlan | null;
  recentSessions: WorkoutSessionSummary[];
  isOffline: boolean;
};

const useMockedHomeData = (): HomeDataState => {
  const [state, setState] = useState<HomeDataState>({
    status: 'loading',
    plan: null,
    recentSessions: [],
    isOffline: false,
  });

  useEffect(() => {
    const timeout = setTimeout(() => {
      setState({
        status: 'ready',
        plan: {
          id: 'plan-1',
          focus: 'Upper Body Push',
          durationMinutes: 32,
          equipment: ['Dumbbells', 'Bench'],
          source: 'ai',
          energy: 'moderate',
        },
        recentSessions: [
          {
            id: 'session-1',
            name: 'Lower Body Reset',
            completedAt: new Date().toISOString(),
            durationMinutes: 38,
            focus: 'Legs',
          },
          {
            id: 'session-2',
            name: 'Intervals + Core',
            completedAt: new Date(Date.now() - 86400000).toISOString(),
            durationMinutes: 24,
            focus: 'Conditioning',
          },
          {
            id: 'session-3',
            name: 'Push Day Primer',
            completedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
            durationMinutes: 30,
            focus: 'Upper Body',
          },
        ],
        isOffline: false,
      });
    }, 600);

    return () => clearTimeout(timeout);
  }, []);

  return state;
};

type HeroCardProps = {
  status: 'loading' | 'ready' | 'empty';
  plan: TodayPlan | null;
  isOffline: boolean;
  onGenerate: () => void;
  onCustomize: () => void;
  onStart: () => void;
  onLogDone: () => void;
  onConfigure: () => void;
};

const HeroCard = ({
  status,
  plan,
  isOffline,
  onGenerate,
  onCustomize,
  onStart,
  onLogDone,
  onConfigure,
}: HeroCardProps) => {
  if (status === 'loading') {
    return (
      <View style={[styles.card, styles.heroCard]}>
        <View style={styles.heroLoadingRow}>
          <View style={[styles.skeleton, { width: '40%', height: 16 }]} />
          <View style={[styles.skeleton, { width: 60, height: 16 }]} />
        </View>
        <View style={[styles.skeleton, { width: '70%', height: 32 }]} />
        <View style={[styles.skeleton, { width: '50%', height: 28 }]} />
        <View
          style={{
            flexDirection: 'row',
            gap: 12,
            width: '100%',
            marginTop: 24,
          }}
        >
          <View style={[styles.skeleton, { flex: 1, height: 48 }]} />
          <View style={[styles.skeleton, { flex: 1, height: 48 }]} />
        </View>
      </View>
    );
  }

  if (!plan || status === 'empty') {
    return (
      <View style={[styles.card, styles.heroCard]}>
        <Text style={styles.heroEyebrow}>No workout queued</Text>
        <Text style={styles.heroHeadline}>Let’s generate today’s plan</Text>
        <Text style={styles.heroBody}>
          Pick your focus, set the time box, and we’ll handle the rest.
        </Text>
        {isOffline ? (
          <InlineWarning onConfigure={onConfigure} />
        ) : (
          <View style={styles.heroActions}>
            <PrimaryButton label="Generate workout" onPress={onGenerate} />
            <SecondaryButton label="Customize" onPress={onCustomize} />
          </View>
        )}
      </View>
    );
  }

  const equipment = plan.equipment.join(' • ');
  const sourceLabel = plan.source === 'ai' ? 'AI generated' : 'Manual entry';

  return (
    <View style={[styles.card, styles.heroCard]}>
      <Text style={styles.heroEyebrow}>Today’s workout</Text>
      <Text style={styles.heroHeadline}>{plan.focus}</Text>
      <Text style={styles.heroBody}>
        {plan.durationMinutes} min · {equipment}
      </Text>
      <View style={styles.heroBadgeRow}>
        <Badge text={sourceLabel} />
        <Badge text={`Energy: ${plan.energy}`} variant="muted" />
      </View>
      {isOffline ? (
        <InlineWarning onConfigure={onConfigure} />
      ) : (
        <View style={styles.heroActions}>
          <PrimaryButton label="Start workout" onPress={onStart} />
          <SecondaryButton label="Log done" onPress={onLogDone} />
        </View>
      )}
    </View>
  );
};

const InlineWarning = ({ onConfigure }: { onConfigure: () => void }) => (
  <View style={styles.warningBanner}>
    <Text style={styles.warningText}>
      Connect to the internet or add your own API key to generate workouts.
    </Text>
    <Pressable onPress={onConfigure} style={styles.linkButton}>
      <Text style={styles.linkButtonText}>Open BYOK setup</Text>
    </Pressable>
  </View>
);

const Badge = ({
  text,
  variant = 'default',
}: {
  text: string;
  variant?: 'default' | 'muted';
}) => (
  <View
    style={[
      styles.badge,
      variant === 'muted' && { backgroundColor: palette.accentMuted },
    ]}
  >
    <Text style={styles.badgeText}>{text}</Text>
  </View>
);

const PrimaryButton = ({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) => (
  <Pressable
    accessibilityRole="button"
    onPress={onPress}
    disabled={disabled}
    style={({ pressed }) => [
      styles.primaryButton,
      pressed && { opacity: 0.9 },
      disabled && { opacity: 0.4 },
    ]}
  >
    <Text style={styles.primaryButtonText}>{label}</Text>
  </Pressable>
);

const SecondaryButton = ({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) => (
  <Pressable
    accessibilityRole='button'
    onPress={onPress}
    style={({ pressed }) => [
      styles.secondaryButton,
      pressed && { backgroundColor: palette.border },
    ]}
  >
    <Text style={styles.secondaryButtonText}>{label}</Text>
  </Pressable>
);

type QuickActionRailProps = {
  onActionPress: (action: QuickActionMetadata) => void;
};

const QuickActionRail = ({ onActionPress }: QuickActionRailProps) => (
  <View style={styles.card}>
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>Quick actions</Text>
      <Text style={styles.sectionHint}>Tweak context without leaving</Text>
    </View>
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.quickActionScroll}
    >
      {quickActions.map((action) => (
        <Pressable
          key={action.key}
          style={({ pressed }) => [
            styles.actionChip,
            pressed && { opacity: 0.8 },
          ]}
          onPress={() => onActionPress(action)}
        >
          <Text style={styles.actionChipLabel}>{action.label}</Text>
          <Text style={styles.actionChipValue}>{action.description}</Text>
        </Pressable>
      ))}
    </ScrollView>
  </View>
);

type ActivitySectionProps = {
  sessions: WorkoutSessionSummary[];
  loading: boolean;
};

const ActivitySection = ({ sessions, loading }: ActivitySectionProps) => {
  if (loading) {
    return (
      <View style={styles.card}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent activity</Text>
        </View>
        <View style={styles.activityLoading}>
          <ActivityIndicator color={palette.accent} />
          <Text style={styles.sectionHint}>Fetching your history…</Text>
        </View>
      </View>
    );
  }

  if (!sessions.length) {
    return (
      <View style={styles.card}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent activity</Text>
        </View>
        <Text style={styles.emptyCopy}>
          Your completed workouts will land here after you finish the first
          session. Tap “Generate workout” above to get started.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent activity</Text>
        <Pressable style={styles.historyLink}>
          <Text style={styles.historyLinkText}>View history</Text>
        </Pressable>
      </View>
      <View style={styles.activityList}>
        {sessions.slice(0, 3).map((session) => (
          <View key={session.id} style={styles.activityItem}>
            <View>
              <Text style={styles.activityName}>{session.name}</Text>
              <Text style={styles.activityMeta}>
                {session.focus} • {session.durationMinutes} min
              </Text>
              <Text style={styles.activityTime}>
                {new Date(session.completedAt).toLocaleDateString([], {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                })}
              </Text>
            </View>
            <View style={styles.activityIndicator} />
          </View>
        ))}
      </View>
    </View>
  );
};

const ActionSheet = ({
  action,
  onClose,
}: {
  action: QuickActionMetadata | null;
  onClose: () => void;
}) => (
  <Modal
    visible={Boolean(action)}
    transparent
    animationType="slide"
    onRequestClose={onClose}
  >
    <View style={styles.sheetOverlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.sheetHandle} />
        <Text style={styles.sheetTitle}>{action?.label}</Text>
        <Text style={styles.sheetBody}>
          {action
            ? `This is a placeholder control for adjusting ${action.label.toLowerCase()}. Wire it up to the real preset sheet when backend hooks are ready.`
            : ''}
        </Text>
        <PrimaryButton label="Close" onPress={onClose} />
      </View>
    </View>
  </Modal>
);

const OfflineBanner = ({
  visible,
  onConfigure,
}: {
  visible: boolean;
  onConfigure: () => void;
}) => {
  if (!visible) return null;
  return (
    <View style={styles.offlineBanner}>
      <View style={{ flex: 1 }}>
        <Text style={styles.offlineTitle}>Offline mode</Text>
        <Text style={styles.offlineBody}>
          Add your API key or reconnect to unlock AI workouts anywhere.
        </Text>
      </View>
      <Pressable onPress={onConfigure} style={styles.offlineButton}>
        <Text style={styles.offlineButtonText}>Configure</Text>
      </Pressable>
    </View>
  );
};

const TopBar = ({
  onConfigure,
}: {
  onConfigure: () => void;
}) => (
  <View style={styles.topBar}>
    <View>
      <Text style={styles.topBarEyebrow}>Workout Agent</Text>
      <Text style={styles.topBarTitle}>Feel ready in seconds</Text>
    </View>
    <View style={styles.topBarActions}>
      <Pressable style={styles.byokPill} onPress={onConfigure}>
        <Text style={styles.byokPillText}>BYOK</Text>
      </Pressable>
      <Pressable style={styles.iconButton}>
        <Text style={styles.iconButtonText}>⋯</Text>
      </Pressable>
    </View>
  </View>
);

const bottomActions = [
  { key: 'home', label: 'Home', active: true },
  { key: 'plan', label: 'Plan', active: false },
  { key: 'history', label: 'History', active: false },
  { key: 'profile', label: 'Profile', active: false },
];

const BottomActionBar = ({
  onQuickLog,
}: {
  onQuickLog: () => void;
}) => (
  <View style={styles.bottomBar}>
    {bottomActions.map((action) => (
      <Pressable
        key={action.key}
        style={[
          styles.bottomAction,
          action.active && styles.bottomActionActive,
        ]}
      >
        <Text
          style={[
            styles.bottomActionLabel,
            action.active && styles.bottomActionLabelActive,
          ]}
        >
          {action.label}
        </Text>
      </Pressable>
    ))}
    <Pressable style={styles.quickLogButton} onPress={onQuickLog}>
      <Text style={styles.quickLogButtonText}>Quick log</Text>
    </Pressable>
  </View>
);

export const HomeScreen = () => {
  const { status, plan, recentSessions, isOffline } = useMockedHomeData();
  const [selectedAction, setSelectedAction] =
    useState<QuickActionMetadata | null>(null);

  const heroStatus = useMemo(() => {
    if (status === 'ready' && plan) return 'ready';
    if (status === 'ready' && !plan) return 'empty';
    return status;
  }, [status, plan]);

  const handleConfigure = () => {
    // For now we just close the offline notice; actual implementation will open onboarding.
  };

  return (
    <View style={styles.screen}>
      <TopBar onConfigure={handleConfigure} />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.screenEyebrow}>Today</Text>
        <Text style={styles.screenTitle}>Your workout hub</Text>
        <OfflineBanner visible={isOffline} onConfigure={handleConfigure} />
        <HeroCard
          status={heroStatus as HeroCardProps['status']}
          plan={plan}
          isOffline={isOffline}
          onGenerate={() => setSelectedAction(quickActions[1])}
          onCustomize={() => setSelectedAction(quickActions[1])}
          onStart={() => setSelectedAction(quickActions[1])}
          onLogDone={() => setSelectedAction(quickActions[4])}
          onConfigure={handleConfigure}
        />
        <QuickActionRail
          onActionPress={(action) => setSelectedAction(action)}
        />
        <ActivitySection
          sessions={recentSessions}
          loading={status === 'loading'}
        />
      </ScrollView>
      <BottomActionBar onQuickLog={() => setSelectedAction(quickActions[4])} />
      <ActionSheet action={selectedAction} onClose={() => setSelectedAction(null)} />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.background,
    paddingTop: 10,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 160,
    gap: 16,
  },
  screenEyebrow: {
    color: palette.textMuted,
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  screenTitle: {
    color: palette.textPrimary,
    fontSize: 28,
    fontWeight: '600',
  },
  card: {
    backgroundColor: palette.card,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: palette.border,
  },
  heroCard: {
    gap: 12,
  },
  heroEyebrow: {
    color: palette.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontSize: 12,
  },
  heroHeadline: {
    color: palette.textPrimary,
    fontSize: 26,
    fontWeight: '600',
  },
  heroBody: {
    color: palette.textSecondary,
    fontSize: 16,
  },
  heroBadgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  heroActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: palette.accentMuted,
    borderRadius: 999,
  },
  badgeText: {
    color: palette.textPrimary,
    fontSize: 13,
  },
  warningBanner: {
    backgroundColor: `${palette.warning}22`,
    borderColor: palette.warning,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  warningText: {
    color: palette.warning,
    fontSize: 14,
    lineHeight: 18,
  },
  linkButton: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  linkButtonText: {
    color: palette.textPrimary,
    fontWeight: '600',
  },
  primaryButton: {
    flex: 1,
    backgroundColor: palette.accent,
    paddingVertical: 14,
    borderRadius: 14,
  },
  primaryButtonText: {
    textAlign: 'center',
    color: '#031b1b',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.border,
    paddingVertical: 14,
  },
  secondaryButtonText: {
    textAlign: 'center',
    color: palette.textPrimary,
    fontSize: 16,
    fontWeight: '500',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    color: palette.textPrimary,
    fontSize: 18,
    fontWeight: '600',
  },
  sectionHint: {
    color: palette.textMuted,
    fontSize: 13,
  },
  quickActionScroll: {
    gap: 12,
  },
  actionChip: {
    backgroundColor: palette.cardSecondary,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
    borderColor: palette.border,
    borderWidth: 1,
    marginRight: 12,
  },
  actionChipLabel: {
    color: palette.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  actionChipValue: {
    color: palette.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
  activityLoading: {
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  emptyCopy: {
    color: palette.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
  historyLink: {
    paddingVertical: 4,
  },
  historyLinkText: {
    color: palette.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  activityList: {
    gap: 16,
  },
  activityItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  activityName: {
    color: palette.textPrimary,
    fontSize: 16,
    fontWeight: '500',
  },
  activityMeta: {
    color: palette.textSecondary,
    fontSize: 14,
  },
  activityTime: {
    color: palette.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
  activityIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: palette.accent,
  },
  sheetOverlay: {
    flex: 1,
    backgroundColor: '#000000aa',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: palette.card,
    padding: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    gap: 12,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.border,
    alignSelf: 'center',
    marginBottom: 8,
  },
  sheetTitle: {
    color: palette.textPrimary,
    fontSize: 20,
    fontWeight: '600',
  },
  sheetBody: {
    color: palette.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
  heroLoadingRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  skeleton: {
    backgroundColor: palette.cardSecondary,
    borderRadius: 8,
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.cardSecondary,
  },
  offlineTitle: {
    color: palette.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  offlineBody: {
    color: palette.textSecondary,
    fontSize: 14,
    marginTop: 4,
  },
  offlineButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: palette.accent,
  },
  offlineButtonText: {
    color: '#031b1b',
    fontWeight: '600',
  },
  linkText: {
    color: palette.textPrimary,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  topBarEyebrow: {
    color: palette.textMuted,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  topBarTitle: {
    color: palette.textPrimary,
    fontSize: 20,
    fontWeight: '600',
  },
  topBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  byokPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  byokPillText: {
    color: palette.textPrimary,
    fontWeight: '600',
    fontSize: 13,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderColor: palette.border,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonText: {
    color: palette.textPrimary,
    fontSize: 20,
    lineHeight: 20,
    marginTop: -2,
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: palette.cardSecondary,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: palette.border,
  },
  bottomAction: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: palette.border,
  },
  bottomActionActive: {
    borderColor: palette.accent,
  },
  bottomActionLabel: {
    color: palette.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  bottomActionLabelActive: {
    color: palette.textPrimary,
  },
  quickLogButton: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: palette.accent,
  },
  quickLogButtonText: {
    color: '#031b1b',
    fontWeight: '700',
  },
});
