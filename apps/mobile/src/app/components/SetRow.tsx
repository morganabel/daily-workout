import React from 'react';
import { View, Text, StyleSheet, Pressable, TextInput } from 'react-native';
import type { WorkoutSetLog } from '@workout-agent/shared';

const palette = {
  background: '#030914',
  card: '#0d1322',
  cardSecondary: '#111a30',
  border: '#1d2943',
  textPrimary: '#f5f6fb',
  textSecondary: '#9cabc4',
  textMuted: '#5c6a85',
  success: '#4ade80',
  destructive: '#ff6b6b',
};

/**
 * Parse a string value to an optional number.
 * Returns null for empty/invalid input.
 */
export const parseOptionalNumber = (
  value: string,
  allowFloat = false
): number | null => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = allowFloat
    ? Number.parseFloat(trimmed)
    : Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return parsed;
};

export type SetRowProps = {
  index: number;
  setLog: WorkoutSetLog;
  canRemove: boolean;
  isEditing?: boolean;
  onToggle: () => void;
  onUpdate: (updates: {
    reps?: number | null;
    weight?: number | null;
    weightUnit?: WorkoutSetLog['weightUnit'] | null;
    rpe?: number | null;
  }) => void;
  onRemove: () => void;
};

export const SetRow = ({
  index,
  setLog,
  canRemove,
  isEditing = true,
  onToggle,
  onUpdate,
  onRemove,
}: SetRowProps) => {
  const weightUnit = setLog.weightUnit ?? 'lb';

  const handleWeightChange = (value: string) => {
    const weight = parseOptionalNumber(value, true);
    const updates: {
      weight?: number | null;
      weightUnit?: WorkoutSetLog['weightUnit'] | null;
    } = {
      weight,
    };
    if (weight !== null && setLog.weightUnit === undefined) {
      updates.weightUnit = 'lb';
    }
    onUpdate(updates);
  };

  const handleRepsChange = (value: string) => {
    onUpdate({ reps: parseOptionalNumber(value) });
  };

  const handleRpeChange = (value: string) => {
    const rpe = parseOptionalNumber(value);
    onUpdate({ rpe });
  };

  return (
    <View style={styles.setRow}>
      <Pressable
        onPress={isEditing ? onToggle : undefined}
        style={[
          styles.setCheckbox,
          setLog.completed && styles.setCheckboxChecked,
        ]}
      >
        {setLog.completed && <Text style={styles.checkmark}>✓</Text>}
      </Pressable>
      <Text style={styles.setLabel}>Set {index + 1}</Text>
      <View style={styles.setInputs}>
        <TextInput
          value={setLog.weight !== undefined ? `${setLog.weight}` : ''}
          onChangeText={handleWeightChange}
          placeholder="Wt"
          placeholderTextColor={palette.textMuted}
          keyboardType="decimal-pad"
          editable={isEditing}
          style={styles.setInput}
        />
        <Pressable
          onPress={
            isEditing
              ? () =>
                  onUpdate({ weightUnit: weightUnit === 'lb' ? 'kg' : 'lb' })
              : undefined
          }
          style={styles.unitToggle}
        >
          <Text style={styles.unitToggleText}>{weightUnit}</Text>
        </Pressable>
        <TextInput
          value={setLog.reps !== undefined ? `${setLog.reps}` : ''}
          onChangeText={handleRepsChange}
          placeholder="Reps"
          placeholderTextColor={palette.textMuted}
          keyboardType="number-pad"
          editable={isEditing}
          style={styles.setInput}
        />
        <TextInput
          value={setLog.rpe !== undefined ? `${setLog.rpe}` : ''}
          onChangeText={handleRpeChange}
          placeholder="RPE"
          placeholderTextColor={palette.textMuted}
          keyboardType="number-pad"
          editable={isEditing}
          style={styles.setInput}
        />
      </View>
      {canRemove ? (
        <Pressable onPress={onRemove} style={styles.removeSetButton}>
          <Text style={styles.removeSetText}>×</Text>
        </Pressable>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  setCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: palette.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setCheckboxChecked: {
    backgroundColor: palette.success,
    borderColor: palette.success,
  },
  checkmark: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 14,
  },
  setLabel: {
    color: palette.textSecondary,
    fontSize: 12,
    width: 50,
  },
  setInputs: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  setInput: {
    flex: 1,
    minWidth: 50,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    color: palette.textPrimary,
    backgroundColor: palette.cardSecondary,
  },
  unitToggle: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.cardSecondary,
  },
  unitToggleText: {
    color: palette.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  removeSetButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeSetText: {
    color: palette.destructive,
    fontSize: 16,
    fontWeight: '700',
  },
});
