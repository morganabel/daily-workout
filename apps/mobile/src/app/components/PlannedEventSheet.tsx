import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
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
import type {
  PlannedEvent,
  PlannedEventInput,
  PlannedEventPatch,
} from '@workout-agent/shared';
import { canonicalEventKinds } from '@workout-agent/shared';
import { Button, Chip } from './DesignSystem';
import { palette, typography } from '../theme';
import {
  formatLocalDate,
  getDeviceTimezone,
  isSameDay,
  parseLocalDate,
} from '../utils/date';

const EVENT_KIND_OPTIONS = canonicalEventKinds.filter(
  (kind) => kind !== 'other'
);
const INTENSITY_OPTIONS: Array<NonNullable<PlannedEventInput['intensity']>> = [
  'low',
  'moderate',
  'high',
];

type PlannedEventSheetProps = {
  visible: boolean;
  initialDate: Date;
  event?: PlannedEvent | null;
  onSave: (payload: PlannedEventInput | PlannedEventPatch) => Promise<void>;
  onDelete?: (eventId: string) => Promise<void>;
  onClose: () => void;
};

const formatTime = (date: Date) =>
  date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

export const PlannedEventSheet = ({
  visible,
  initialDate,
  event,
  onSave,
  onDelete,
  onClose,
}: PlannedEventSheetProps) => {
  const isEditing = Boolean(event);
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<'other' | string>('workout');
  const [customKind, setCustomKind] = useState('');
  const [notes, setNotes] = useState('');
  const [durationInput, setDurationInput] = useState('');
  const [intensity, setIntensity] = useState<PlannedEventInput['intensity']>();
  const [allDay, setAllDay] = useState(true);
  const [eventDate, setEventDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ title?: string }>({});

  const selectedKind = useMemo(() => {
    if (
      EVENT_KIND_OPTIONS.includes(kind as (typeof EVENT_KIND_OPTIONS)[number])
    ) {
      return kind;
    }
    return 'other';
  }, [kind]);

  const effectiveKind =
    selectedKind === 'other' ? customKind.trim() || 'other' : selectedKind;

  useEffect(() => {
    if (!visible) return;

    if (event) {
      setTitle(event.title);
      if (
        EVENT_KIND_OPTIONS.includes(
          event.kind as (typeof EVENT_KIND_OPTIONS)[number]
        )
      ) {
        setKind(event.kind);
        setCustomKind('');
      } else {
        setKind('other');
        setCustomKind(event.kind);
      }
      setNotes(event.notes ?? '');
      setDurationInput(
        event.durationMinutes ? String(event.durationMinutes) : ''
      );
      setIntensity(event.intensity);
      setAllDay(Boolean(event.allDay || !event.startsAt));
      if (event.startsAt) {
        setEventDate(new Date(event.startsAt));
      } else {
        const baseDate = parseLocalDate(event.localDate);
        baseDate.setHours(12, 0, 0, 0);
        setEventDate(baseDate);
      }
    } else {
      const base = new Date(initialDate);
      if (!isSameDay(base, new Date())) {
        base.setHours(12, 0, 0, 0);
      }
      setTitle('');
      setKind('workout');
      setCustomKind('');
      setNotes('');
      setDurationInput('');
      setIntensity(undefined);
      setAllDay(true);
      setEventDate(base);
      setErrors({});
    }
  }, [event, initialDate, visible]);

  const handleDateChange = (_event: unknown, selected?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (!selected) return;
    const next = new Date(eventDate);
    next.setFullYear(
      selected.getFullYear(),
      selected.getMonth(),
      selected.getDate()
    );
    setEventDate(next);
  };

  const handleTimeChange = (_event: unknown, selected?: Date) => {
    if (Platform.OS === 'android') {
      setShowTimePicker(false);
    }
    if (!selected) return;
    const next = new Date(eventDate);
    next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
    setEventDate(next);
  };

  const handleSave = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setErrors({ title: 'Please enter a title' });
      return;
    }

    setSubmitting(true);
    setErrors({});

    const parsedDuration = Number.parseInt(durationInput, 10);
    const durationMinutes =
      Number.isFinite(parsedDuration) && parsedDuration > 0
        ? parsedDuration
        : undefined;

    const payloadBase: PlannedEventInput = {
      kind: effectiveKind,
      title: trimmedTitle,
      localDate: formatLocalDate(eventDate),
      createdAtTimezone: event?.createdAtTimezone ?? getDeviceTimezone(),
      startsAt: allDay ? undefined : eventDate.getTime(),
      allDay,
      durationMinutes,
      notes: notes.trim() ? notes.trim() : undefined,
      intensity,
      status: event?.status ?? 'planned',
      linkedWorkoutId: event?.linkedWorkoutId,
      details: event?.details,
      metadata: event?.metadata,
    };

    try {
      if (event) {
        const payload: PlannedEventPatch = {
          id: event.id,
          ...payloadBase,
        };
        await onSave(payload);
      } else {
        await onSave(payloadBase);
      }
      onClose();
    } catch (error) {
      console.error('Failed to save planned event', error);
      Alert.alert('Unable to save', 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!event || !onDelete) return;
    Alert.alert(
      'Delete event?',
      'This will remove the plan from your calendar.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await onDelete(event.id);
              onClose();
            } catch (error) {
              console.error('Failed to delete planned event', error);
              Alert.alert('Unable to delete', 'Please try again.');
            }
          },
        },
      ]
    );
  };

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
          <Text style={styles.title}>
            {isEditing ? 'Edit plan' : 'Plan activity'}
          </Text>
          <Text style={styles.subtitle}>
            Add upcoming events to guide your workouts.
          </Text>

          <ScrollView
            style={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Type</Text>
              <View style={styles.chipGrid}>
                {EVENT_KIND_OPTIONS.map((option) => (
                  <Chip
                    key={option}
                    label={option.charAt(0).toUpperCase() + option.slice(1)}
                    selected={selectedKind === option}
                    onPress={() => {
                      setKind(option);
                      setCustomKind('');
                    }}
                    role="radio"
                  />
                ))}
                <Chip
                  label="Other"
                  selected={selectedKind === 'other'}
                  onPress={() => setKind('other')}
                  role="radio"
                />
              </View>
              {selectedKind === 'other' && (
                <TextInput
                  style={styles.textInput}
                  placeholder="Custom type"
                  placeholderTextColor={palette.textMuted}
                  value={customKind}
                  onChangeText={setCustomKind}
                />
              )}
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Title</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g., Trail run or Rest day"
                placeholderTextColor={palette.textMuted}
                value={title}
                onChangeText={setTitle}
                autoCapitalize="sentences"
              />
              {errors.title && (
                <Text style={styles.errorText}>{errors.title}</Text>
              )}
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Date</Text>
              <View style={styles.row}>
                <Pressable
                  style={styles.selectButton}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Text style={styles.selectButtonText}>
                    {formatLocalDate(eventDate)}
                  </Text>
                </Pressable>
                <Chip
                  label="All day"
                  selected={allDay}
                  onPress={() => setAllDay((prev) => !prev)}
                />
              </View>
              {showDatePicker && Platform.OS === 'ios' && (
                <View style={styles.pickerContainer}>
                  <DateTimePicker
                    value={eventDate}
                    mode="date"
                    display="spinner"
                    onChange={handleDateChange}
                    themeVariant="light"
                  />
                  <Pressable
                    style={styles.pickerDone}
                    onPress={() => setShowDatePicker(false)}
                  >
                    <Text style={styles.pickerDoneText}>Done</Text>
                  </Pressable>
                </View>
              )}
              {showDatePicker && Platform.OS === 'android' && (
                <DateTimePicker
                  value={eventDate}
                  mode="date"
                  display="default"
                  onChange={handleDateChange}
                />
              )}
            </View>

            {!allDay && (
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Time</Text>
                <Pressable
                  style={styles.selectButton}
                  onPress={() => setShowTimePicker(true)}
                >
                  <Text style={styles.selectButtonText}>
                    {formatTime(eventDate)}
                  </Text>
                </Pressable>
                {showTimePicker && Platform.OS === 'ios' && (
                  <View style={styles.pickerContainer}>
                    <DateTimePicker
                      value={eventDate}
                      mode="time"
                      display="spinner"
                      onChange={handleTimeChange}
                      themeVariant="light"
                    />
                    <Pressable
                      style={styles.pickerDone}
                      onPress={() => setShowTimePicker(false)}
                    >
                      <Text style={styles.pickerDoneText}>Done</Text>
                    </Pressable>
                  </View>
                )}
                {showTimePicker && Platform.OS === 'android' && (
                  <DateTimePicker
                    value={eventDate}
                    mode="time"
                    display="default"
                    onChange={handleTimeChange}
                  />
                )}
              </View>
            )}

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Duration (minutes)</Text>
              <TextInput
                style={[styles.textInput, styles.durationInput]}
                placeholder="45"
                placeholderTextColor={palette.textMuted}
                value={durationInput}
                onChangeText={setDurationInput}
                keyboardType="number-pad"
                maxLength={3}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Intensity</Text>
              <View style={styles.chipGrid}>
                {INTENSITY_OPTIONS.map((option) => (
                  <Chip
                    key={option}
                    label={option.charAt(0).toUpperCase() + option.slice(1)}
                    selected={intensity === option}
                    onPress={() =>
                      setIntensity(intensity === option ? undefined : option)
                    }
                    role="radio"
                  />
                ))}
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Notes</Text>
              <TextInput
                style={[styles.textInput, styles.textInputMultiline]}
                placeholder="Optional notes"
                placeholderTextColor={palette.textMuted}
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={2}
              />
            </View>
          </ScrollView>

          <View style={styles.actions}>
            <Button
              label="Cancel"
              onPress={onClose}
              variant="secondary"
              style={{ flex: 1 }}
            />
            {isEditing && onDelete ? (
              <Button
                label="Delete"
                onPress={handleDelete}
                variant="destructive"
                style={{ flex: 1 }}
              />
            ) : null}
            <Button
              label={submitting ? 'Saving...' : 'Save'}
              onPress={handleSave}
              disabled={submitting}
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
    width: 120,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  selectButton: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.cardSecondary,
  },
  selectButtonText: {
    color: palette.textPrimary,
    fontSize: 14,
    fontFamily: typography.fontFamily,
  },
  pickerContainer: {
    backgroundColor: palette.cardSecondary,
    borderRadius: 12,
    marginTop: 8,
    overflow: 'hidden',
  },
  pickerDone: {
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: palette.border,
  },
  pickerDoneText: {
    color: palette.primary,
    fontSize: 16,
    fontFamily: typography.fontFamilyBold,
  },
  errorText: {
    color: palette.warning,
    fontSize: 13,
    marginTop: 4,
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
