import React, { useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  Platform,
} from 'react-native';
import type {
  TodayPlan,
  GenerationRequest,
  RegenerationFeedback,
  WorkoutEnergy,
  QuickActionPreset,
} from '@workout-agent/shared';
import { palette, typography, layout } from '../theme';
import { Button, Chip } from './DesignSystem';

const DURATION_OPTIONS = [15, 30, 45, 60, 90]; // Standardized
const FOCUS_OPTIONS = [
  { id: 'Smart', label: 'Auto' },
  { id: 'Full Body', label: 'Full Body' },
  { id: 'Upper Body', label: 'Upper Body' },
  { id: 'Lower Body', label: 'Lower Body' },
  { id: 'Core', label: 'Core' },
  { id: 'Cardio', label: 'Cardio' },
  { id: 'Strength', label: 'Strength' },
  { id: 'Mobility', label: 'Mobility' },
];
const EQUIPMENT_OPTIONS = [
  'Bodyweight',
  'Dumbbells',
  'Barbell',
  'Kettlebells',
  'Pull-up Bar',
  'Resistance Bands',
  'Bench',
];
const ENERGY_OPTIONS: { value: WorkoutEnergy; label: string }[] = [
  { value: 'easy', label: 'Easy' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'intense', label: 'Intense' },
];
const FEEDBACK_OPTIONS: { value: RegenerationFeedback; label: string }[] = [
  { value: 'too-hard', label: 'Too hard' },
  { value: 'too-easy', label: 'Too easy' },
  { value: 'different-exercises', label: 'Different exercises' },
  { value: 'just-try-again', label: 'Just try again' },
];

// ... (Helpers remain the same)
const getQuickActionValue = (
  quickActions: QuickActionPreset[] | undefined,
  key: QuickActionPreset['key']
): string | undefined => {
  const action = quickActions?.find((item) => item.key === key);
  return action?.stagedValue ?? action?.value ?? action?.description;
};

const normalizeFocusSelection = (
  value: string | undefined
): string | undefined => {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const normalized = trimmed.toLowerCase();
  const exactMatch = FOCUS_OPTIONS.find(
    (option) => option.id.toLowerCase() === normalized || option.label.toLowerCase() === normalized
  );
  if (exactMatch) {
    return exactMatch.id;
  }
  const candidateMatches = FOCUS_OPTIONS.filter((option) => {
    const words = option.id.toLowerCase().split(/\s+/);
    return words.includes(normalized);
  });
  if (candidateMatches.length === 1) {
    return candidateMatches[0].id;
  }
  return trimmed;
};

const parseEquipmentSelection = (value: string | undefined): string[] => {
  if (!value) return [];
  return value
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean);
};

const normalizeEnergySelection = (value: string | undefined): WorkoutEnergy => {
  if (!value) return 'moderate';
  const normalized = value.trim().toLowerCase();
  if (
    normalized === 'easy' ||
    normalized === 'moderate' ||
    normalized === 'intense'
  ) {
    return normalized;
  }
  return 'moderate';
};

export type CustomizeSheetProps = {
  visible: boolean;
  currentPlan?: TodayPlan | null;
  quickActions?: QuickActionPreset[];
  loading?: boolean;
  /** Initial values to sync with parent state */
  initialDuration?: number;
  initialEquipment?: string[];
  initialEnergy?: WorkoutEnergy;
  initialFocus?: string;
  onSubmit: (request: GenerationRequest) => void;
  onUpdateStagedValue?: (
    key: QuickActionPreset['key'],
    value: string | null
  ) => void;
  onClose: () => void;
};

export const CustomizeSheet = ({
  visible,
  currentPlan,
  quickActions,
  loading = false,
  initialDuration,
  initialEquipment,
  initialEnergy,
  initialFocus,
  onSubmit,
  onUpdateStagedValue,
  onClose,
}: CustomizeSheetProps) => {
  const isRegeneration = Boolean(currentPlan?.responseId);
  const showFeedback = Boolean(currentPlan?.responseId);
  const primaryLabel = isRegeneration
    ? 'Regenerate workout'
    : 'Generate workout';
  const canStageValues = Boolean(onUpdateStagedValue);

  const [feedback, setFeedback] = useState<RegenerationFeedback[]>([]);
  const [duration, setDuration] = useState(DURATION_OPTIONS[2]);
  const [focus, setFocus] = useState(FOCUS_OPTIONS[1].id);
  const [equipment, setEquipment] = useState<string[]>(['Bodyweight']);
  const [energy, setEnergy] = useState<WorkoutEnergy>('moderate');
  const [notes, setNotes] = useState('');
  const [freeFormMode, setFreeFormMode] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const timeValue = getQuickActionValue(quickActions, 'time');
    const focusValue = getQuickActionValue(quickActions, 'focus');
    const equipmentValue = getQuickActionValue(quickActions, 'equipment');
    const energyValue = getQuickActionValue(quickActions, 'energy');

    const parsedDuration = Number.parseInt(timeValue ?? '', 10);
    const nextDuration =
      currentPlan?.durationMinutes ??
      (!Number.isNaN(parsedDuration) ? parsedDuration : null) ??
      initialDuration ??
      DURATION_OPTIONS[2];
    const nextFocus =
      currentPlan?.focus ??
      normalizeFocusSelection(focusValue) ??
      initialFocus ??
      FOCUS_OPTIONS[1].id;
    const nextEquipment =
      currentPlan?.equipment ??
      (equipmentValue ? parseEquipmentSelection(equipmentValue) : null) ??
      initialEquipment ??
      ['Bodyweight'];
    const nextEnergy =
      currentPlan?.energy ??
      (energyValue ? normalizeEnergySelection(energyValue) : null) ??
      initialEnergy ??
      'moderate';

    setFeedback([]);
    setDuration(nextDuration);
    setFocus(nextFocus);
    setEquipment(nextEquipment);
    setEnergy(nextEnergy);
    setNotes('');
    setFreeFormMode(false);
  }, [visible, currentPlan, quickActions, initialDuration, initialEquipment, initialEnergy, initialFocus]);

  const toggleFeedback = (value: RegenerationFeedback) => {
    setFeedback((prev) =>
      prev.includes(value) ? prev.filter((f) => f !== value) : [...prev, value]
    );
  };

  const toggleEquipment = (value: string) => {
    setEquipment((prev) => {
      if (prev.includes(value)) {
        const next = prev.filter((e) => e !== value);
        return next.length > 0 ? next : ['Bodyweight'];
      }
      return [...prev, value];
    });
  };

  const applyStagedValues = () => {
    if (!onUpdateStagedValue) return;
    onUpdateStagedValue('time', String(duration));
    onUpdateStagedValue('focus', focus);
    onUpdateStagedValue('equipment', equipment.join(', '));
    onUpdateStagedValue('energy', energy);
  };

  const handleApply = () => {
    if (!canStageValues) {
      onClose();
      return;
    }
    applyStagedValues();
    onClose();
  };

  const handleSubmit = () => {
    const normalizedNotes = notes.trim() || undefined;
    const normalizedFocus = focus === 'Smart' ? undefined : focus;

    if (canStageValues) {
      applyStagedValues();
    }

    if (freeFormMode) {
      onSubmit({
        notes: normalizedNotes,
        previousResponseId: currentPlan?.responseId,
      });
      return;
    }

    const request: GenerationRequest = {
      timeMinutes: duration,
      equipment,
      energy,
    };

    if (normalizedFocus) {
      request.focus = normalizedFocus;
    }

    if (normalizedNotes) {
      request.notes = normalizedNotes;
    }

    if (isRegeneration && currentPlan?.responseId) {
      request.previousResponseId = currentPlan.responseId;
    }

    if (showFeedback && feedback.length > 0) {
      request.feedback = feedback;
    }

    onSubmit(request);
  };

  const closestDuration = DURATION_OPTIONS.reduce((prev, curr) =>
    Math.abs(curr - duration) < Math.abs(prev - duration) ? curr : prev
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.headerRow}>
            <Text style={styles.title}>Customize</Text>
            <View style={styles.headerAction}>
              <Text style={styles.freeFormLabel}>Free form</Text>
              <Switch
                value={freeFormMode}
                onValueChange={setFreeFormMode}
                trackColor={{ false: palette.border, true: palette.primary }}
                thumbColor={palette.card}
              />
            </View>
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {!freeFormMode && (
              <View style={styles.sectionGroup}>
                {showFeedback && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>
                      What would you like to change?
                    </Text>
                    <Text style={styles.sectionHint}>
                      Optional - helps the AI understand your feedback
                    </Text>
                    <View style={styles.chipsRow}>
                      {FEEDBACK_OPTIONS.map((option) => (
                        <Chip
                          key={option.value}
                          label={option.label}
                          selected={feedback.includes(option.value)}
                          onPress={() => toggleFeedback(option.value)}
                        />
                      ))}
                    </View>
                  </View>
                )}

                {/* Duration Section */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Duration</Text>
                  <View style={styles.segmentedRow}>
                    {DURATION_OPTIONS.map((mins) => (
                      <SegmentedButton
                        key={mins}
                        label={`${mins}`}
                        selected={closestDuration === mins}
                        onPress={() => setDuration(mins)}
                      />
                    ))}
                  </View>
                </View>

                {/* Focus Section */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Focus</Text>
                  <View style={styles.chipsRow}>
                    {FOCUS_OPTIONS.map((f) => (
                      <Chip
                        key={f.id}
                        label={f.label}
                        selected={focus === f.id}
                        onPress={() => setFocus(f.id)}
                      />
                    ))}
                  </View>
                </View>

                {/* Equipment Section */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Equipment</Text>
                  <Text style={styles.sectionHint}>Select all that apply</Text>
                  <View style={styles.chipsRow}>
                    {EQUIPMENT_OPTIONS.map((e) => (
                      <Chip
                        key={e}
                        label={e}
                        selected={equipment.includes(e)}
                        onPress={() => toggleEquipment(e)}
                      />
                    ))}
                  </View>
                </View>

                {/* Energy Section */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Energy Level</Text>
                  <View style={styles.segmentedRow}>
                    {ENERGY_OPTIONS.map((option) => (
                      <SegmentedButton
                        key={option.value}
                        label={option.label}
                        selected={energy === option.value}
                        onPress={() => setEnergy(option.value)}
                      />
                    ))}
                  </View>
                </View>
              </View>
            )}

            {/* Notes Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {freeFormMode ? 'Instructions' : 'Other Instructions'}
              </Text>
              <Text style={styles.sectionHint}>
                Describe goals, limits, equipment, or any requests for this
                workout.
              </Text>
              <TextInput
                style={styles.textArea}
                placeholder="Type any extra guidance for the workout..."
                placeholderTextColor={palette.textMuted}
                multiline
                value={notes}
                onChangeText={setNotes}
                textAlignVertical="top"
              />
            </View>
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.actions}>
            {canStageValues && (
              <Button
                label="Save for next"
                onPress={handleApply}
                disabled={loading}
                variant="secondary"
                style={{ flex: 1 }}
              />
            )}
            <Button
              label={primaryLabel}
              onPress={handleSubmit}
              loading={loading}
              variant="primary"
              style={{ flex: 2 }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const SegmentedButton = ({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) => (
  <Pressable
    onPress={onPress}
    style={({ pressed }) => [
      styles.segmentedButton,
      selected && styles.segmentedButtonSelected,
      pressed && { opacity: 0.8 },
    ]}
  >
    <Text
      style={[
        styles.segmentedButtonText,
        selected && styles.segmentedButtonTextSelected,
      ]}
    >
      {label}
    </Text>
  </Pressable>
);

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: '#000000aa',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: palette.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.border,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  title: {
    color: palette.textPrimary,
    fontSize: 20,
    fontFamily: typography.fontFamilyExtraBold,
  },
  headerRow: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  freeFormLabel: {
    color: palette.textSecondary,
    fontSize: 14,
    fontFamily: typography.fontFamily,
  },
  scrollView: {
    maxHeight: 500,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 24,
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    color: palette.textPrimary,
    fontSize: 16,
    fontFamily: typography.fontFamilyBold,
  },
  sectionHint: {
    color: palette.textMuted,
    fontSize: 13,
    fontFamily: typography.fontFamily,
    marginBottom: 4,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  segmentedRow: {
    flexDirection: 'row',
    gap: 8,
  },
  segmentedButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.cardSecondary,
    alignItems: 'center',
  },
  segmentedButtonSelected: {
    borderColor: palette.primary,
    backgroundColor: `${palette.primary}22`,
  },
  segmentedButtonText: {
    color: palette.textPrimary,
    fontSize: 14,
    fontFamily: typography.fontFamilyBold,
  },
  segmentedButtonTextSelected: {
    color: palette.primary,
  },
  sectionGroup: {
    gap: 24,
  },
  textArea: {
    backgroundColor: palette.cardSecondary,
    borderColor: palette.border,
    borderRadius: 12,
    borderWidth: 1,
    color: palette.textPrimary,
    fontSize: 14,
    fontFamily: typography.fontFamily,
    minHeight: 96,
    padding: 14,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: palette.border,
  },
});
