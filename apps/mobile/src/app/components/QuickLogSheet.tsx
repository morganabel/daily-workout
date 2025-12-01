import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Toast from 'react-native-root-toast';

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

export type QuickLogPayload = {
  name: string;
  focus: string;
  durationMinutes: number;
  completedAt?: number;
  note?: string;
};

type QuickLogSheetProps = {
  visible: boolean;
  onSubmit: (payload: QuickLogPayload) => Promise<void>;
  onClose: () => void;
};

const FOCUS_OPTIONS = [
  'Cardio',
  'Strength',
  'Full Body',
  'Upper Body',
  'Lower Body',
  'Core',
  'Mobility',
  'Other',
];

const DURATION_OPTIONS = [10, 15, 20, 30, 45, 60, 90];

const WHEN_OPTIONS = [
  { label: 'Just now', value: 'now' },
  { label: 'Earlier today', value: 'earlier' },
];

export const QuickLogSheet = ({
  visible,
  onSubmit,
  onClose,
}: QuickLogSheetProps) => {
  const [name, setName] = useState('');
  const [focus, setFocus] = useState('');
  const [durationMinutes, setDurationMinutes] = useState<number | null>(null);
  const [when, setWhen] = useState<'now' | 'earlier'>('now');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ name?: string }>({});

  const resetForm = () => {
    setName('');
    setFocus('');
    setDurationMinutes(null);
    setWhen('now');
    setNote('');
    setErrors({});
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const validate = (): boolean => {
    const newErrors: { name?: string } = {};

    if (!name.trim() && !focus) {
      newErrors.name = 'Please enter what you did or select a focus';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    if (submitting) return;

    setSubmitting(true);

    try {
      // Calculate completedAt based on "when" selection
      let completedAt: number | undefined;
      if (when === 'earlier') {
        // Backdate by 2 hours for "earlier today"
        completedAt = Date.now() - 2 * 60 * 60 * 1000;
      }

      const payload: QuickLogPayload = {
        name: name.trim() || focus,
        focus: focus || name.trim(),
        durationMinutes: durationMinutes ?? 60, // Default to 1 hour if not specified
        completedAt,
        note: note.trim() || undefined,
      };

      await onSubmit(payload);

      // Show success toast
      Toast.show('Workout logged!', {
        duration: Toast.durations.SHORT,
        position: Toast.positions.BOTTOM,
        shadow: true,
        animation: true,
        backgroundColor: palette.card,
        textColor: palette.textPrimary,
      });

      resetForm();
      onClose();
    } catch (error) {
      console.error('Failed to log workout:', error);
      Toast.show('Failed to log workout. Please try again.', {
        duration: Toast.durations.LONG,
        position: Toast.positions.BOTTOM,
        backgroundColor: palette.destructive,
        textColor: palette.textPrimary,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = (name.trim() || focus) && !submitting;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>Quick log</Text>
          <Text style={styles.subtitle}>
            Record an ad-hoc workout in seconds
          </Text>

          {/* What did you do? */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>What did you do?</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g., Morning run, Yoga session..."
              placeholderTextColor={palette.textMuted}
              value={name}
              onChangeText={setName}
              autoCapitalize="sentences"
            />
            <View style={styles.chipGrid}>
              {FOCUS_OPTIONS.map((option) => (
                <Pressable
                  key={option}
                  style={[
                    styles.chip,
                    focus === option && styles.chipSelected,
                  ]}
                  onPress={() => setFocus(focus === option ? '' : option)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      focus === option && styles.chipTextSelected,
                    ]}
                  >
                    {option}
                  </Text>
                </Pressable>
              ))}
            </View>
            {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
          </View>

          {/* Duration (optional) */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>How long? <Text style={styles.labelHint}>(optional, defaults to 1 hr)</Text></Text>
            <View style={styles.chipGrid}>
              {DURATION_OPTIONS.map((minutes) => (
                <Pressable
                  key={minutes}
                  style={[
                    styles.chip,
                    durationMinutes === minutes && styles.chipSelected,
                  ]}
                  onPress={() => setDurationMinutes(minutes)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      durationMinutes === minutes && styles.chipTextSelected,
                    ]}
                  >
                    {minutes} min
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* When */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>When?</Text>
            <View style={styles.chipRow}>
              {WHEN_OPTIONS.map((option) => (
                <Pressable
                  key={option.value}
                  style={[
                    styles.chip,
                    styles.chipWide,
                    when === option.value && styles.chipSelected,
                  ]}
                  onPress={() => setWhen(option.value as 'now' | 'earlier')}
                >
                  <Text
                    style={[
                      styles.chipText,
                      when === option.value && styles.chipTextSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Note (optional) */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Note (optional)</Text>
            <TextInput
              style={[styles.textInput, styles.textInputMultiline]}
              placeholder="Any details to remember..."
              placeholderTextColor={palette.textMuted}
              value={note}
              onChangeText={setNote}
              multiline
              numberOfLines={2}
            />
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <Pressable
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed && { opacity: 0.7 },
              ]}
              onPress={handleClose}
            >
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && { opacity: 0.9 },
                !canSubmit && styles.primaryButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={!canSubmit}
            >
              <Text style={styles.primaryButtonText}>
                {submitting ? 'Saving...' : 'Save log'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

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
    padding: 20,
    paddingBottom: 32,
    gap: 16,
    maxHeight: '90%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.border,
    alignSelf: 'center',
    marginBottom: 8,
  },
  title: {
    color: palette.textPrimary,
    fontSize: 22,
    fontWeight: '600',
  },
  subtitle: {
    color: palette.textSecondary,
    fontSize: 15,
    marginTop: -8,
  },
  fieldGroup: {
    gap: 8,
  },
  label: {
    color: palette.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  labelHint: {
    color: palette.textMuted,
    fontSize: 13,
    fontWeight: '400',
  },
  textInput: {
    backgroundColor: palette.cardSecondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: palette.textPrimary,
    fontSize: 15,
  },
  textInputMultiline: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 12,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.cardSecondary,
  },
  chipWide: {
    flex: 1,
    alignItems: 'center',
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
    fontWeight: '600',
  },
  errorText: {
    color: palette.warning,
    fontSize: 13,
    marginTop: 4,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: palette.accent,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.4,
  },
  primaryButtonText: {
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
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: palette.textPrimary,
    fontSize: 16,
    fontWeight: '500',
  },
});

