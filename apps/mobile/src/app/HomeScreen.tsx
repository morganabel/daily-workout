import React, { useMemo, useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  buildGenerationRequestFromQuickActions,
  type QuickActionPreset,
  type TodayPlan,
  type WorkoutSessionSummary,
  type GenerationRequest,
  type GenerationStatus,
} from '@workout-agent/shared';
import { useHomeData } from './hooks/useHomeData';
import { generateWorkout, type ApiError } from './services/api';
import {
  getByokApiKey,
  setByokApiKey,
  removeByokApiKey,
} from './storage/byokKey';
import { RootStackParamList } from './navigation';
import { workoutRepository } from './db/repositories/WorkoutRepository';

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

// Quick actions will come from the API snapshot

type HeroCardProps = {
  status: 'loading' | 'ready' | 'empty';
  plan: TodayPlan | null;
  isOffline: boolean;
  generating?: boolean;
  logging?: boolean;
  generationStatus: GenerationStatus;
  showPendingOverlay?: boolean;
  onGenerate: () => void;
  onCustomize: () => void;
  onStart: () => void;
  onPreview: () => void;
  onConfigure: () => void;
};

const HeroCard = ({
  status,
  plan,
  isOffline,
  generating = false,
  logging = false,
  generationStatus,
  showPendingOverlay = false,
  onGenerate,
  onCustomize,
  onStart,
  onPreview,
  onConfigure,
}: HeroCardProps) => {
  const isPending = generationStatus.state === 'pending' || generating;
  const overlayMessage =
    generationStatus.state === 'pending'
      ? `Crafting your workout${
          generationStatus.etaSeconds
            ? ` (~${generationStatus.etaSeconds}s)`
            : ' — this can take ~20s'
        }`
      : 'Processing your request…';
  const errorMessage =
    generationStatus.state === 'error'
      ? generationStatus.message ?? 'Something went wrong. Please try again.'
      : null;

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
        {errorMessage && (
          <View style={styles.errorPill}>
            <Text style={styles.errorPillText}>{errorMessage}</Text>
          </View>
        )}
        {isOffline ? (
          <InlineWarning onConfigure={onConfigure} />
        ) : (
          <View style={styles.heroActions}>
            <PrimaryButton
              label={
                isPending
                  ? 'Generating...'
                  : errorMessage
                    ? 'Retry generation'
                    : 'Generate workout'
              }
              onPress={onGenerate}
              disabled={isPending}
            />
            <SecondaryButton
              label="Customize"
              onPress={onCustomize}
              disabled={isPending}
            />
          </View>
        )}
        {showPendingOverlay && (
          <View style={styles.heroOverlay}>
            <ActivityIndicator color={palette.textPrimary} />
            <Text style={styles.heroOverlayText}>{overlayMessage}</Text>
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
      {errorMessage && (
        <View style={styles.errorPill}>
          <Text style={styles.errorPillText}>{errorMessage}</Text>
        </View>
      )}
      {isOffline ? (
        <InlineWarning onConfigure={onConfigure} />
      ) : (
        <View style={styles.heroActions}>
          <PrimaryButton
            label={logging ? 'Logging...' : 'Log done'}
            onPress={onStart}
            disabled={logging || isPending}
          />
          <SecondaryButton
            label="Preview"
            onPress={onPreview}
            disabled={logging || isPending}
          />
        </View>
      )}
      {showPendingOverlay && (
        <View style={styles.heroOverlay}>
          <ActivityIndicator color={palette.textPrimary} />
          <Text style={styles.heroOverlayText}>{overlayMessage}</Text>
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
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) => (
  <Pressable
    accessibilityRole='button'
    onPress={onPress}
    disabled={disabled}
    style={({ pressed }) => [
      styles.secondaryButton,
      pressed && { backgroundColor: palette.border },
      disabled && { opacity: 0.4 },
    ]}
  >
    <Text style={styles.secondaryButtonText}>{label}</Text>
  </Pressable>
);

type QuickActionRailProps = {
  onActionPress: (action: QuickActionPreset) => void;
  quickActions: QuickActionPreset[];
  disabled?: boolean;
  onReset: () => void;
  hasOverrides: boolean;
  pendingMessage?: string | null;
};

const QuickActionRail = ({
  onActionPress,
  quickActions,
  disabled = false,
  onReset,
  hasOverrides,
  pendingMessage,
}: QuickActionRailProps) => (
  <View style={styles.card}>
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>Quick actions</Text>
      <View style={styles.sectionHeaderMeta}>
        <Text style={styles.sectionHint} numberOfLines={2}>
          {pendingMessage || 'Tweak context without leaving'}
        </Text>
        {hasOverrides && (
          <Pressable onPress={onReset} style={styles.resetButton}>
            <Text style={styles.resetButtonText}>Reset</Text>
          </Pressable>
        )}
      </View>
    </View>
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.quickActionScroll}
      style={disabled ? { opacity: 0.5 } : undefined}
      pointerEvents={disabled ? 'none' : 'auto'}
    >
      {quickActions.map((action) => {
        const staged = Boolean(action.stagedValue);
        const displayValue = action.stagedValue ?? action.description;
        return (
          <Pressable
            key={action.key}
            style={({ pressed }) => [
              styles.actionChip,
              staged && styles.actionChipStaged,
              pressed && { opacity: 0.8 },
            ]}
            onPress={() => onActionPress(action)}
          >
            <View style={styles.actionChipHeader}>
              <Text style={styles.actionChipLabel} numberOfLines={1}>
                {action.label}
              </Text>
              {staged && <View style={styles.actionChipDot} />}
            </View>
            <Text style={styles.actionChipValue} numberOfLines={1}>
              {displayValue}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  </View>
);

type ActivitySectionProps = {
  sessions: WorkoutSessionSummary[];
  loading: boolean;
  onViewHistory: () => void;
};

const ActivitySection = ({ sessions, loading, onViewHistory }: ActivitySectionProps) => {
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
        <Pressable style={styles.historyLink} onPress={onViewHistory}>
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
  quickActions,
  onClose,
  onGenerate,
  onUpdateStagedValue,
  generating,
  isOffline,
}: {
  action: QuickActionPreset | null;
  quickActions: QuickActionPreset[];
  onClose: () => void;
  onGenerate: () => void;
  onUpdateStagedValue: (key: QuickActionPreset['key'], value: string | null) => void;
  generating: boolean;
  isOffline: boolean;
}) => {
  const currentStagedValue = action?.stagedValue ?? action?.value ?? '';
  const [localValue, setLocalValue] = useState<string>(currentStagedValue);
  const disabled = generating || isOffline;

  // Update local value when action changes
  useEffect(() => {
    if (action) {
      const newValue = action.stagedValue ?? action.value ?? '';
      setLocalValue(newValue);
    }
  }, [action]);

  if (!action) return null;

  const handleApply = () => {
    onUpdateStagedValue(action.key, localValue);
    onClose();
  };

  const handleGenerate = () => {
    onUpdateStagedValue(action.key, localValue);
    onGenerate();
    onClose();
  };

  const handleReset = () => {
    setLocalValue(action.value ?? '');
    onUpdateStagedValue(action.key, null);
  };

  const renderContent = () => {
    switch (action.key) {
      case 'time': {
        const timeOptions = [15, 20, 30, 45, 60];
        return (
          <View style={styles.sheetOptions}>
            {timeOptions.map((minutes) => (
              <Pressable
                key={minutes}
                style={[
                  styles.optionButton,
                  localValue === String(minutes) && styles.optionButtonSelected,
                ]}
                onPress={() => setLocalValue(String(minutes))}
              >
                <Text
                  style={[
                    styles.optionButtonText,
                    localValue === String(minutes) && styles.optionButtonTextSelected,
                  ]}
                >
                  {minutes} min
                </Text>
              </Pressable>
            ))}
          </View>
        );
      }
      case 'focus': {
        const focusOptions = [
          'Full Body',
          'Upper Body',
          'Lower Body',
          'Core',
          'Cardio',
          'Strength',
          'Mobility',
        ];
        return (
          <View style={styles.sheetOptions}>
            {focusOptions.map((focus) => (
              <Pressable
                key={focus}
                style={[
                  styles.optionButton,
                  localValue === focus && styles.optionButtonSelected,
                ]}
                onPress={() => setLocalValue(focus)}
              >
                <Text
                  style={[
                    styles.optionButtonText,
                    localValue === focus && styles.optionButtonTextSelected,
                  ]}
                >
                  {focus}
                </Text>
              </Pressable>
            ))}
          </View>
        );
      }
      case 'equipment': {
        const equipmentOptions = [
          'Bodyweight',
          'Dumbbells',
          'Barbell',
          'Resistance Bands',
          'Kettlebells',
          'Pull-up Bar',
          'Yoga Mat',
        ];
        const selectedEquipment = localValue ? localValue.split(',').map((e) => e.trim()) : [];

        const toggleEquipment = (equip: string) => {
          const isSelected = selectedEquipment.includes(equip);
          const newSelection = isSelected
            ? selectedEquipment.filter((e) => e !== equip)
            : [...selectedEquipment, equip];
          setLocalValue(newSelection.length > 0 ? newSelection.join(', ') : 'Bodyweight');
        };

        return (
          <View style={styles.sheetOptions}>
            {equipmentOptions.map((equip) => {
              const isSelected = selectedEquipment.includes(equip);
              return (
                <Pressable
                  key={equip}
                  style={[
                    styles.optionButton,
                    isSelected && styles.optionButtonSelected,
                  ]}
                  onPress={() => toggleEquipment(equip)}
                >
                  <Text
                    style={[
                      styles.optionButtonText,
                      isSelected && styles.optionButtonTextSelected,
                    ]}
                  >
                    {equip}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        );
      }
      case 'energy': {
        const energyOptions = [
          { value: 'easy', label: 'Easy' },
          { value: 'moderate', label: 'Moderate' },
          { value: 'intense', label: 'Intense' },
        ];
        return (
          <View style={styles.sheetOptions}>
            {energyOptions.map((option) => (
              <Pressable
                key={option.value}
                style={[
                  styles.optionButton,
                  localValue === option.value && styles.optionButtonSelected,
                ]}
                onPress={() => setLocalValue(option.value)}
              >
                <Text
                  style={[
                    styles.optionButtonText,
                    localValue === option.value && styles.optionButtonTextSelected,
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>
        );
      }
      case 'backfill': {
        // For backfill, we'll show a simple message for now
        // TODO: Implement date picker and quick log form
        return (
          <View>
            <Text style={styles.sheetBody}>
              Log a past workout session. This feature will allow you to backfill your workout history.
            </Text>
            <Text style={[styles.sheetBody, { marginTop: 12, fontSize: 13 }]}>
              Coming soon: Date picker and quick log form.
            </Text>
          </View>
        );
      }
      default:
        return (
          <Text style={styles.sheetBody}>
            Select a value for {action.label.toLowerCase()}.
          </Text>
        );
    }
  };

  return (
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
          <Text style={styles.sheetTitle}>{action.label}</Text>
          {renderContent()}
          {action.key !== 'backfill' && !disabled && (
            <Pressable onPress={handleReset}>
              <Text style={styles.resetLink}>Reset to defaults</Text>
            </Pressable>
          )}
          {disabled && action.key !== 'backfill' && (
            <Text style={styles.sheetBody}>
              Finish configuring your API key or wait for the current generation to complete before changing presets.
            </Text>
          )}
          <View style={styles.sheetActions}>
            {action.key !== 'backfill' && (
              <>
                <SecondaryButton
                  label="Apply"
                  onPress={handleApply}
                  disabled={disabled}
                />
                <PrimaryButton
                  label={generating ? 'Generating...' : 'Apply & Generate'}
                  onPress={handleGenerate}
                  disabled={disabled}
                />
              </>
            )}
            {action.key === 'backfill' && (
              <PrimaryButton label="Close" onPress={onClose} />
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const OfflineBanner = ({
  visible,
  offlineHint,
  onConfigure,
}: {
  visible: boolean;
  offlineHint: { offline: boolean; requiresApiKey: boolean; message?: string };
  onConfigure: () => void;
}) => {
  if (!visible) return null;
  return (
    <View style={styles.offlineBanner}>
      <View style={{ flex: 1 }}>
        <Text style={styles.offlineTitle}>
          {offlineHint.requiresApiKey ? 'API Key Required' : 'Offline mode'}
        </Text>
        <Text style={styles.offlineBody}>
          {offlineHint.message ||
            'Add your API key or reconnect to unlock AI workouts anywhere.'}
        </Text>
      </View>
      {offlineHint.requiresApiKey && (
        <Pressable onPress={onConfigure} style={styles.offlineButton}>
          <Text style={styles.offlineButtonText}>Configure</Text>
        </Pressable>
      )}
    </View>
  );
};

const TopBar = ({
  onConfigure,
  hasByokKey,
  onOpenMenu,
}: {
  onConfigure: () => void;
  hasByokKey: boolean;
  onOpenMenu: () => void;
}) => (
  <View style={styles.topBar}>
    <View>
      <Text style={styles.topBarEyebrow}>Workout Agent</Text>
      <Text style={styles.topBarTitle}>Feel ready in seconds</Text>
    </View>
    <View style={styles.topBarActions}>
      <Pressable style={styles.byokPill} onPress={onConfigure}>
        <Text style={styles.byokPillText}>
          {hasByokKey ? 'BYOK ✓' : 'BYOK'}
        </Text>
      </Pressable>
      <Pressable style={styles.iconButton} onPress={onOpenMenu}>
        <Text style={styles.iconButtonText}>⋯</Text>
      </Pressable>
    </View>
  </View>
);

const ByokSheet = ({
  visible,
  value,
  onChangeValue,
  onClose,
  onSave,
  onRemove,
  hasKey,
}: {
  visible: boolean;
  value: string;
  onChangeValue: (val: string) => void;
  onClose: () => void;
  onSave: () => void;
  onRemove?: () => void;
  hasKey: boolean;
}) => (
  <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <View style={styles.sheetOverlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 32 : 0}
        style={styles.byokSheetContainer}
      >
        <View style={styles.byokSheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Add your API key</Text>
          <Text style={styles.sheetBody}>
            Paste your OpenAI API key to unlock AI workouts even when the hosted key isn't available.
          </Text>
          <TextInput
            value={value}
            onChangeText={onChangeValue}
            placeholder="sk-..."
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
            style={styles.byokInput}
          />
          <View style={styles.sheetActions}>
            {onRemove && (
              <SecondaryButton label="Remove key" onPress={onRemove} />
            )}
            <PrimaryButton
              label={hasKey ? 'Update key' : 'Save key'}
              onPress={onSave}
              disabled={!value.trim()}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  </Modal>
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

type HomeScreenNavigation = NativeStackNavigationProp<
  RootStackParamList,
  'Home'
>;

export const HomeScreen = () => {
  const {
    status,
    plan,
    recentSessions,
    quickActions,
    isOffline,
    offlineHint,
    refetch,
    updateStagedValue,
    generationStatus,
    clearStagedValues,
  } = useHomeData();
  const [selectedAction, setSelectedAction] =
    useState<QuickActionPreset | null>(null);
  const [generating, setGenerating] = useState(false);
  const [logging, setLogging] = useState(false);
  const [byokSheetVisible, setByokSheetVisible] = useState(false);
  const [byokInput, setByokInput] = useState('');
  const [hasByokKey, setHasByokKey] = useState(false);
  const [showPendingOverlay, setShowPendingOverlay] = useState(false);
  const navigation = useNavigation<HomeScreenNavigation>();

  const heroStatus = useMemo(() => {
    if (status === 'ready' && plan) return 'ready';
    if (status === 'ready' && !plan) return 'empty';
    return status === 'error' ? 'empty' : status;
  }, [status, plan]);

  useEffect(() => {
    if (generating || generationStatus.state === 'pending') {
      const timeout = setTimeout(() => setShowPendingOverlay(true), 400);
      return () => clearTimeout(timeout);
    }
    setShowPendingOverlay(false);
  }, [generating, generationStatus.state]);

  const quickActionsLocked = generating || generationStatus.state === 'pending';
  const pendingMessage = quickActionsLocked
    ? 'Hang tight while this workout finishes generating…'
    : undefined;
  const hasOverrides = quickActions.some((action) => Boolean(action.stagedValue));

  useEffect(() => {
    const checkByok = async () => {
      try {
        const existing = await getByokApiKey();
        setHasByokKey(Boolean(existing));
      } catch (error) {
        console.warn('Failed to read BYOK key', error);
      }
    };
    checkByok();
  }, []);

  const openByokSheet = async () => {
    try {
      const existing = await getByokApiKey();
      setByokInput(existing ?? '');
    } catch {
      setByokInput('');
    }
    setByokSheetVisible(true);
  };

  const handleSaveByok = async () => {
    if (!byokInput.trim()) return;
    try {
      await setByokApiKey(byokInput.trim());
      setHasByokKey(true);
      setByokSheetVisible(false);
      await refetch();
    } catch (error) {
      Alert.alert(
        'Failed to Save Key',
        'Could not store your API key. Please try again.',
      );
      console.error('Failed to store BYOK key:', error);
    }
  };

  const handleRemoveByok = async () => {
    try {
      await removeByokApiKey();
      setHasByokKey(false);
      setByokInput('');
      setByokSheetVisible(false);
      await refetch();
    } catch (error) {
      Alert.alert(
        'Failed to Remove Key',
        'Could not remove your API key. Please try again.',
      );
      console.error('Failed to remove BYOK key:', error);
    }
  };

  const handleConfigure = async () => {
    openByokSheet();
  };

  const handleOpenSettings = () => {
    navigation.navigate('Settings');
  };

  const handleOpenHistory = () => {
    navigation.navigate('History');
  };

  const handlePreviewNavigation = () => {
    if (plan) {
      navigation.navigate('WorkoutPreview', { plan });
    } else {
      navigation.navigate('WorkoutPreview');
    }
  };

  const handleGenerate = async () => {
    if (generating || isOffline || generationStatus.state === 'pending') return;

    setGenerating(true);

    try {
      const baseRequest: Partial<GenerationRequest> = {
        timeMinutes: 30,
        focus: 'Full Body',
        equipment: ['Bodyweight'],
        energy: 'moderate',
      };

      const request = buildGenerationRequestFromQuickActions(
        quickActions,
        baseRequest,
      );

      const quickActionMap = Object.fromEntries(
        quickActions.map((action) => [action.key, action]),
      );

      const focusValue =
        quickActionMap['focus']?.stagedValue || quickActionMap['focus']?.value;
      const energyValue =
        quickActionMap['energy']?.stagedValue || quickActionMap['energy']?.value;
      const equipmentValue =
        quickActionMap['equipment']?.stagedValue ||
        quickActionMap['equipment']?.description ||
        quickActionMap['equipment']?.value;

      const recentSummary = recentSessions.slice(0, 2).map((session) => {
        const parts = [
          session.focus,
          `${session.durationMinutes}m`,
          session.source ? session.source : null,
        ].filter(Boolean);
        return parts.join(' ');
      });

      const noteParts = [
        focusValue ? `Preference: ${focusValue}` : null,
        energyValue ? `Energy: ${energyValue}` : null,
        equipmentValue ? `Equipment: ${equipmentValue}` : null,
        recentSummary.length
          ? `Recent: ${recentSummary.join(' | ')}`
          : null,
      ].filter(Boolean);

      if (noteParts.length) {
        request.notes = noteParts.join(' • ');
      }

      console.log('Generating workout with request:', request);
      await generateWorkout(request);
      console.log('Workout plan persisted locally');

      clearStagedValues();

    } catch (err) {
      const apiError = err as ApiError;
      console.error('Failed to generate workout:', apiError);
      Alert.alert(
        'Failed to Generate Workout',
        apiError.message ||
          'An error occurred while generating your workout. Please try again.',
        [{ text: 'OK' }],
      );
    } finally {
      setGenerating(false);
    }
  };

  const handleLogDone = async () => {
    if (!plan || logging) return;

    setLogging(true);

    try {
      await workoutRepository.completeWorkoutById(plan.id);
    } catch (err) {
      console.error('Failed to log workout:', err);

      // Show error alert to user
      Alert.alert(
        'Failed to Log Workout',
        'An error occurred while logging your workout. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setLogging(false);
    }
  };

  return (
    <View style={styles.screen}>
      <TopBar
        onConfigure={handleConfigure}
        hasByokKey={hasByokKey}
        onOpenMenu={handleOpenSettings}
      />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.screenEyebrow}>Today</Text>
        <Text style={styles.screenTitle}>Your workout hub</Text>
        <OfflineBanner
          visible={isOffline || offlineHint.offline}
          offlineHint={offlineHint}
          onConfigure={handleConfigure}
        />
        <HeroCard
          status={heroStatus as HeroCardProps['status']}
          plan={plan}
          isOffline={isOffline}
          generating={generating}
          logging={logging}
          generationStatus={generationStatus}
          showPendingOverlay={showPendingOverlay}
          onGenerate={handleGenerate}
          onCustomize={() => setSelectedAction(quickActions[1] ?? null)}
          onStart={handleLogDone}
          onPreview={handlePreviewNavigation}
          onConfigure={handleConfigure}
        />
        <QuickActionRail
          onActionPress={(action) => setSelectedAction(action)}
          quickActions={quickActions}
          disabled={quickActionsLocked}
          onReset={clearStagedValues}
          hasOverrides={hasOverrides}
          pendingMessage={pendingMessage}
        />
        <ActivitySection
          sessions={recentSessions}
          loading={status === 'loading'}
          onViewHistory={handleOpenHistory}
        />
      </ScrollView>
      <BottomActionBar onQuickLog={() => setSelectedAction(quickActions[4] ?? null)} />
      <ActionSheet
        action={selectedAction}
        quickActions={quickActions}
        onClose={() => setSelectedAction(null)}
        onGenerate={handleGenerate}
        onUpdateStagedValue={updateStagedValue}
        generating={generating}
        isOffline={isOffline}
      />
      <ByokSheet
        visible={byokSheetVisible}
        value={byokInput}
        onChangeValue={setByokInput}
        onClose={() => setByokSheetVisible(false)}
        onSave={handleSaveByok}
        onRemove={hasByokKey ? handleRemoveByok : undefined}
        hasKey={hasByokKey}
      />
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
  heroOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 20,
    backgroundColor: '#030914dd',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  heroOverlayText: {
    color: palette.textPrimary,
    fontSize: 15,
  },
  errorPill: {
    marginTop: 4,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.warning,
    backgroundColor: `${palette.warning}22`,
  },
  errorPillText: {
    color: palette.warning,
    fontSize: 13,
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
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  sectionHeaderMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexShrink: 1,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  sectionTitle: {
    color: palette.textPrimary,
    fontSize: 18,
    fontWeight: '600',
  },
  sectionHint: {
    color: palette.textMuted,
    fontSize: 13,
    flexShrink: 1,
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
    minWidth: 110,
  },
  actionChipStaged: {
    borderColor: palette.accent,
  },
  actionChipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionChipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: palette.accent,
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
    flexShrink: 1,
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
  byokSheet: {
    backgroundColor: palette.card,
    padding: 24,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    gap: 16,
  },
  byokSheetContainer: {
    justifyContent: 'flex-end',
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
  resetLink: {
    color: palette.accent,
    fontSize: 13,
    fontWeight: '600',
    marginTop: -4,
  },
  byokInput: {
    backgroundColor: palette.cardSecondary,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: palette.textPrimary,
    fontSize: 16,
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
  sheetOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginVertical: 12,
  },
  optionButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.cardSecondary,
  },
  optionButtonSelected: {
    borderColor: palette.accent,
    backgroundColor: `${palette.accent}22`,
  },
  optionButtonText: {
    color: palette.textPrimary,
    fontSize: 15,
    fontWeight: '500',
  },
  optionButtonTextSelected: {
    color: palette.accent,
    fontWeight: '600',
  },
  sheetActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  resetButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  resetButtonText: {
    color: palette.accent,
    fontSize: 13,
    fontWeight: '600',
  },
});
