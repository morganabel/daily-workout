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
} from 'react-native';
import type {
  TodayPlan,
  GenerationRequest,
  RegenerationFeedback,
  WorkoutEnergy,
} from '@workout-agent/shared';

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
};

const DURATION_OPTIONS = [15, 20, 30, 45, 60];
const FOCUS_OPTIONS = [
  'Smart',
  'Full Body',
  'Upper Body',
  'Lower Body',
  'Core',
  'Cardio',
  'Strength',
  'Mobility',
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

export type CustomizeSheetProps = {
  visible: boolean;
  currentPlan: TodayPlan;
  loading?: boolean;
  onRegenerate: (request: GenerationRequest) => void;
  onClose: () => void;
};

export const CustomizeSheet = ({
  visible,
  currentPlan,
  loading = false,
  onRegenerate,
  onClose,
}: CustomizeSheetProps) => {
  // State for selections
  const [feedback, setFeedback] = useState<RegenerationFeedback[]>([]);
  const [duration, setDuration] = useState(currentPlan.durationMinutes);
  const [focus, setFocus] = useState(currentPlan.focus);
  const [equipment, setEquipment] = useState<string[]>(currentPlan.equipment);
  const [energy, setEnergy] = useState<WorkoutEnergy>(currentPlan.energy);
  const [notes, setNotes] = useState('');
  const [freeFormMode, setFreeFormMode] = useState(false);

  // Reset state when sheet opens with new plan
  useEffect(() => {
    if (visible) {
      setFeedback([]);
      setDuration(currentPlan.durationMinutes);
      setFocus(currentPlan.focus);
      setEquipment(currentPlan.equipment.length > 0 ? currentPlan.equipment : ['Bodyweight']);
      setEnergy(currentPlan.energy);
      setNotes('');
      setFreeFormMode(false);
    }
  }, [visible, currentPlan]);

  const toggleFeedback = (value: RegenerationFeedback) => {
    setFeedback((prev) =>
      prev.includes(value) ? prev.filter((f) => f !== value) : [...prev, value],
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

  const handleRegenerate = () => {
    const normalizedNotes = notes.trim() || undefined;

    if (freeFormMode) {
      onRegenerate({
        notes: normalizedNotes,
      });
      return;
    }

    const request: GenerationRequest = {
      timeMinutes: duration,
      focus,
      equipment,
      energy,
      previousResponseId: currentPlan.responseId,
      feedback: feedback.length > 0 ? feedback : undefined,
      notes: normalizedNotes,
    };
    onRegenerate(request);
  };

  // Find closest duration option
  const closestDuration = DURATION_OPTIONS.reduce((prev, curr) =>
    Math.abs(curr - duration) < Math.abs(prev - duration) ? curr : prev,
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
                trackColor={{ false: palette.border, true: palette.accent }}
                thumbColor="#031b1b"
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
                {/* Feedback Section */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>What would you like to change?</Text>
                  <Text style={styles.sectionHint}>Optional - helps the AI understand your feedback</Text>
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
                        key={f}
                        label={f}
                        selected={focus === f}
                        onPress={() => setFocus(f)}
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
                Describe goals, limits, equipment, or any requests for this workout.
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
            <Pressable
              onPress={onClose}
              disabled={loading}
              style={({ pressed }) => [
                styles.cancelButton,
                pressed && { opacity: 0.8 },
                loading && { opacity: 0.5 },
              ]}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleRegenerate}
              disabled={loading}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && { opacity: 0.9 },
                loading && { opacity: 0.7 },
              ]}
            >
              {loading ? (
                <ActivityIndicator color="#031b1b" size="small" />
              ) : (
                <Text style={styles.primaryButtonText}>Get New Workout</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const Chip = ({
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
      styles.chip,
      selected && styles.chipSelected,
      pressed && { opacity: 0.8 },
    ]}
  >
    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
      {label}
    </Text>
  </Pressable>
);

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
    maxHeight: '85%',
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
    fontWeight: '600',
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
  },
  scrollView: {
    maxHeight: 400,
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
    fontWeight: '600',
  },
  sectionHint: {
    color: palette.textMuted,
    fontSize: 13,
    marginBottom: 4,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.cardSecondary,
  },
  chipSelected: {
    borderColor: palette.accent,
    backgroundColor: `${palette.accent}22`,
  },
  chipText: {
    color: palette.textPrimary,
    fontSize: 14,
    fontWeight: '500',
  },
  chipTextSelected: {
    color: palette.accent,
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
    borderColor: palette.accent,
    backgroundColor: `${palette.accent}22`,
  },
  segmentedButtonText: {
    color: palette.textPrimary,
    fontSize: 14,
    fontWeight: '500',
  },
  segmentedButtonTextSelected: {
    color: palette.accent,
    fontWeight: '600',
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
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: palette.textPrimary,
    fontSize: 16,
    fontWeight: '500',
  },
  primaryButton: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#031b1b',
    fontSize: 16,
    fontWeight: '600',
  },
});

