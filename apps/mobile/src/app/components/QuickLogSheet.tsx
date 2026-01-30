import React, { useEffect, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import Toast from 'react-native-root-toast';
import { palette, typography } from '../theme';
import { Button, Chip } from './DesignSystem';

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
  initialDate?: Date | null;
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

type DateOption = 'today' | 'yesterday' | 'custom';

// Helper to get start of a day
const startOfDay = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

// Helper to format date for display
const formatDate = (date: Date): string => {
  const today = startOfDay(new Date());
  const target = startOfDay(date);
  const diffDays = Math.round(
    (today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return date.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

export const QuickLogSheet = ({
  visible,
  onSubmit,
  onClose,
  initialDate,
}: QuickLogSheetProps) => {
  const [name, setName] = useState('');
  const [focus, setFocus] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ name?: string }>({});

  // Details section (collapsed by default)
  const [showDetails, setShowDetails] = useState(false);
  const [dateOption, setDateOption] = useState<DateOption>('today');
  const [customDate, setCustomDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [durationInput, setDurationInput] = useState('');

  const resolveInitialDate = (
    date?: Date | null
  ): { option: DateOption; date: Date } => {
    const targetDate = date ?? new Date();
    const today = new Date();
    const isToday =
      startOfDay(targetDate).getTime() === startOfDay(today).getTime();
    return {
      option: isToday ? 'today' : 'custom',
      date: targetDate,
    };
  };

  const resetForm = () => {
    const { option, date } = resolveInitialDate(initialDate);
    setName('');
    setFocus('');
    setNote('');
    setErrors({});
    setShowDetails(false);
    setDateOption(option);
    setCustomDate(date);
    setShowDatePicker(false);
    setDurationInput('');
  };

  useEffect(() => {
    if (!visible) return;
    const { option, date } = resolveInitialDate(initialDate);
    setDateOption(option);
    setCustomDate(date);
  }, [initialDate, visible]);

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

  // Get the actual date based on selection
  const getSelectedDate = (): Date => {
    const now = new Date();
    switch (dateOption) {
      case 'today':
        return now;
      case 'yesterday': {
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        return yesterday;
      }
      case 'custom':
        return customDate;
    }
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    if (submitting) return;

    setSubmitting(true);

    try {
      // Parse duration - default to 60 minutes if not specified or invalid
      const parsedDuration = parseInt(durationInput, 10);
      const durationMinutes = parsedDuration > 0 ? parsedDuration : 60;

      // Use current time for "today", noon for past dates (where exact time is unknown)
      const selectedDate = getSelectedDate();
      const completedAt = new Date(selectedDate);
      if (dateOption !== 'today') {
        completedAt.setHours(12, 0, 0, 0);
      }

      const payload: QuickLogPayload = {
        name: name.trim() || focus,
        focus: focus || name.trim(),
        durationMinutes,
        completedAt: completedAt.getTime(),
        note: note.trim() || undefined,
      };

      await onSubmit(payload);

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

  const handleDateOptionPress = (option: DateOption) => {
    setDateOption(option);
    if (option === 'custom') {
      setShowDatePicker(true);
    }
  };

  const handleDateChange = (_event: any, selectedDate?: Date) => {
    // On Android, the picker closes automatically
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (selectedDate) {
      setCustomDate(selectedDate);
    }
  };

  const canSubmit = (name.trim() || focus) && !submitting;

  const hasCustomizations =
    durationInput.trim() !== '' || dateOption !== 'today';

  // Get display text for current date selection
  const getDateDisplayText = (): string => {
    switch (dateOption) {
      case 'today':
        return 'Today';
      case 'yesterday':
        return 'Yesterday';
      case 'custom':
        return formatDate(customDate);
    }
  };

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
            Tap a category and save — that's it
          </Text>

          <ScrollView
            style={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
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
                  <Chip
                    key={option}
                    label={option}
                    selected={focus === option}
                    onPress={() => setFocus(focus === option ? '' : option)}
                  />
                ))}
              </View>
              {errors.name && (
                <Text style={styles.errorText}>{errors.name}</Text>
              )}
            </View>

            {/* Edit details toggle */}
            <Pressable
              style={styles.detailsToggle}
              onPress={() => setShowDetails(!showDetails)}
            >
              <Text style={styles.detailsToggleText}>
                {showDetails ? '▾ Hide details' : '▸ Edit details'}
              </Text>
              {!showDetails && hasCustomizations && (
                <Text style={styles.detailsSummary}>
                  {getDateDisplayText()}
                  {durationInput ? ` · ${durationInput} min` : ''}
                </Text>
              )}
            </Pressable>

            {/* Collapsible details section */}
            {showDetails && (
              <View style={styles.detailsSection}>
                {/* Date selection */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>When?</Text>
                  <View style={styles.dateOptions}>
                    <Chip
                      label="Today"
                      selected={dateOption === 'today'}
                      onPress={() => handleDateOptionPress('today')}
                      style={{ flex: 1, justifyContent: 'center' }}
                    />
                    <Chip
                      label="Yesterday"
                      selected={dateOption === 'yesterday'}
                      onPress={() => handleDateOptionPress('yesterday')}
                      style={{ flex: 1, justifyContent: 'center' }}
                    />
                    <Chip
                      label={
                        dateOption === 'custom'
                          ? formatDate(customDate)
                          : 'Custom...'
                      }
                      selected={dateOption === 'custom'}
                      onPress={() => handleDateOptionPress('custom')}
                      style={{ flex: 1, justifyContent: 'center' }}
                    />
                  </View>

                  {/* Date picker for iOS (inline) or after selection on Android */}
                  {showDatePicker && Platform.OS === 'ios' && (
                    <View style={styles.datePickerContainer}>
                      <DateTimePicker
                        value={customDate}
                        mode="date"
                        display="spinner"
                        onChange={handleDateChange}
                        maximumDate={new Date()}
                        themeVariant="light"
                      />
                      <Pressable
                        style={styles.datePickerDone}
                        onPress={() => setShowDatePicker(false)}
                      >
                        <Text style={styles.datePickerDoneText}>Done</Text>
                      </Pressable>
                    </View>
                  )}
                  {showDatePicker && Platform.OS === 'android' && (
                    <DateTimePicker
                      value={customDate}
                      mode="date"
                      display="default"
                      onChange={handleDateChange}
                      maximumDate={new Date()}
                    />
                  )}
                </View>

                {/* Duration input */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>
                    Duration{' '}
                    <Text style={styles.labelHint}>
                      (minutes, defaults to 60)
                    </Text>
                  </Text>
                  <TextInput
                    style={[styles.textInput, styles.durationInput]}
                    placeholder="60"
                    placeholderTextColor={palette.textMuted}
                    value={durationInput}
                    onChangeText={setDurationInput}
                    keyboardType="number-pad"
                    maxLength={3}
                  />
                </View>

                {/* Note */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>
                    Note <Text style={styles.labelHint}>(optional)</Text>
                  </Text>
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
              </View>
            )}
          </ScrollView>

          {/* Actions */}
          <View style={styles.actions}>
            <Button
              label="Cancel"
              onPress={handleClose}
              variant="secondary"
              style={{ flex: 1 }}
            />
            <Button
              label={submitting ? 'Saving...' : 'Save log'}
              onPress={handleSubmit}
              disabled={!canSubmit}
              variant="primary"
              style={{ flex: 1 }}
            />
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
    maxHeight: '90%',
  },
  scrollContent: {
    flexGrow: 0,
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
    fontFamily: typography.fontFamilyExtraBold,
  },
  subtitle: {
    color: palette.textSecondary,
    fontSize: 15,
    fontFamily: typography.fontFamily,
    marginTop: 4,
    marginBottom: 16,
  },
  fieldGroup: {
    gap: 8,
    marginBottom: 16,
  },
  label: {
    color: palette.textPrimary,
    fontSize: 15,
    fontFamily: typography.fontFamilyBold,
  },
  labelHint: {
    color: palette.textMuted,
    fontSize: 13,
    fontWeight: '400',
    fontFamily: typography.fontFamily,
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
    fontFamily: typography.fontFamily,
  },
  textInputMultiline: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  durationInput: {
    width: 100,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dateOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  errorText: {
    color: palette.warning,
    fontSize: 13,
    marginTop: 4,
  },
  detailsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    marginBottom: 8,
  },
  detailsToggleText: {
    color: palette.primary,
    fontSize: 14,
    fontFamily: typography.fontFamilyBold,
  },
  detailsSummary: {
    color: palette.textMuted,
    fontSize: 13,
    fontFamily: typography.fontFamily,
  },
  detailsSection: {
    borderTopWidth: 1,
    borderTopColor: palette.border,
    paddingTop: 16,
  },
  datePickerContainer: {
    backgroundColor: palette.cardSecondary,
    borderRadius: 12,
    marginTop: 8,
    overflow: 'hidden',
  },
  datePickerDone: {
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: palette.border,
  },
  datePickerDoneText: {
    color: palette.primary,
    fontSize: 16,
    fontFamily: typography.fontFamilyBold,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: palette.border,
  },
});
