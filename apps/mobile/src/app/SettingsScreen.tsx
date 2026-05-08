import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { userRepository } from './db/repositories/UserRepository';
import {
  EQUIPMENT_OPTIONS,
  GYM_EQUIPMENT,
  adaptiveTrainingPlanSchema,
  normalizeEquipmentSelection,
  type AdaptiveTargetRange,
  type ExperienceLevel,
  type UserPreferences,
} from '@workout-agent/shared';
import { palette, typography } from './theme';
import { BottomNavigation } from './components/BottomNavigation';
import { Chip, Button, SectionHeader } from './components/DesignSystem';

const EXPERIENCE_LEVELS: {
  value: ExperienceLevel;
  label: string;
  description: string;
}[] = [
  {
    value: 'beginner',
    label: 'Beginner',
    description: 'New to fitness or returning after a long break',
  },
  {
    value: 'intermediate',
    label: 'Intermediate',
    description: '1-3 years of consistent training',
  },
  {
    value: 'advanced',
    label: 'Advanced',
    description: '3+ years with solid technique',
  },
];

const formatLabel = (value: string): string =>
  value
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const formatRange = (target: AdaptiveTargetRange): string =>
  `${target.minCount}-${target.maxCount} in ${target.windowDays} days`;

export const SettingsScreen = () => {
  const [preferences, setPreferences] = useState<UserPreferences>({
    equipment: [],
    injuries: [],
    focusBias: [],
    avoid: [],
  });
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [injuryInput, setInjuryInput] = useState('');

  useEffect(() => {
    const loadPreferences = async () => {
      const prefs = await userRepository.getPreferences();
      setPreferences({
        ...prefs,
        equipment: normalizeEquipmentSelection(prefs.equipment),
      });
    };
    loadPreferences();
  }, []);

  const updateField = useCallback(
    <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
      setPreferences((prev) => ({ ...prev, [key]: value }));
      setHasChanges(true);
    },
    []
  );

  const toggleEquipment = useCallback((item: string) => {
    setPreferences((prev) => {
      const current = prev.equipment;
      if (item === GYM_EQUIPMENT) {
        return {
          ...prev,
          equipment: current.includes(GYM_EQUIPMENT) ? [] : [GYM_EQUIPMENT],
        };
      }

      const updated = current.includes(item)
        ? current.filter((e) => e !== item)
        : [...current.filter((e) => e !== GYM_EQUIPMENT), item];
      return { ...prev, equipment: normalizeEquipmentSelection(updated) };
    });
    setHasChanges(true);
  }, []);

  const addInjury = useCallback(() => {
    const trimmed = injuryInput.trim();
    if (!trimmed) return;
    if (preferences.injuries.length >= 3) {
      Alert.alert('Limit Reached', 'You can add up to 3 injuries/constraints.');
      return;
    }
    if (preferences.injuries.includes(trimmed)) {
      Alert.alert('Duplicate', 'This injury is already in your list.');
      return;
    }
    setPreferences((prev) => ({
      ...prev,
      injuries: [...prev.injuries, trimmed],
    }));
    setInjuryInput('');
    setHasChanges(true);
  }, [injuryInput, preferences.injuries]);

  const removeInjury = useCallback((injury: string) => {
    setPreferences((prev) => ({
      ...prev,
      injuries: prev.injuries.filter((i) => i !== injury),
    }));
    setHasChanges(true);
  }, []);

  const updateAdaptivePlan = useCallback(
    (
      updater: (
        plan: NonNullable<UserPreferences['adaptiveTrainingPlan']>
      ) => NonNullable<UserPreferences['adaptiveTrainingPlan']>
    ) => {
      setPreferences((prev) => {
        if (!prev.adaptiveTrainingPlan) return prev;
        const result = adaptiveTrainingPlanSchema.safeParse({
          ...updater(prev.adaptiveTrainingPlan),
          updatedAt: new Date().toISOString(),
        });
        if (!result.success) {
          console.error('Invalid adaptive plan settings update:', result.error);
          return prev;
        }
        return {
          ...prev,
          adaptiveTrainingPlan: result.data,
        };
      });
      setHasChanges(true);
    },
    []
  );

  const updateTargetRange = useCallback(
    (targetId: string, updates: Partial<AdaptiveTargetRange>) => {
      updateAdaptivePlan((plan) => ({
        ...plan,
        targetRanges: plan.targetRanges.map((target) => {
          if (target.id !== targetId) return target;
          const next = { ...target, ...updates };
          return {
            ...next,
            idealCount:
              next.idealCount === undefined
                ? undefined
                : Math.min(Math.max(next.idealCount, next.minCount), next.maxCount),
          };
        }),
      }));
    },
    [updateAdaptivePlan]
  );

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await userRepository.updatePreferences(preferences);
      setHasChanges(false);
      Alert.alert('Saved', 'Your profile has been updated.');
    } catch (e) {
      console.error('Failed to save preferences', e);
      Alert.alert(
        'Error',
        'Failed to save your preferences. Please try again.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.screenTitle}>Profile</Text>
        <Pressable
          style={[
            styles.saveButton,
            hasChanges && styles.saveButtonActive,
            isSaving && styles.saveButtonDisabled,
          ]}
          onPress={handleSave}
          disabled={!hasChanges || isSaving}
        >
          <Text
            style={[
              styles.saveButtonText,
              hasChanges && styles.saveButtonTextActive,
            ]}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Equipment Section */}
        <View style={styles.section}>
          <SectionHeader title="My Equipment" />
          <Text style={styles.sectionDescription}>
            Select the equipment you have access to. This helps generate
            workouts tailored to your setup.
          </Text>
          <View style={styles.chipContainer}>
            {EQUIPMENT_OPTIONS.map((item) => {
              const isSelected = preferences.equipment.includes(item);
              return (
                <Chip
                  key={item}
                  label={item}
                  selected={isSelected}
                  onPress={() => toggleEquipment(item)}
                />
              );
            })}
          </View>
        </View>

        {/* Experience Level Section */}
        <View style={styles.section}>
          <SectionHeader title="Experience Level" />
          <Text style={styles.sectionDescription}>
            This helps calibrate workout intensity and exercise complexity.
          </Text>
          <View style={styles.levelContainer}>
            {EXPERIENCE_LEVELS.map((level) => {
              const isSelected = preferences.experienceLevel === level.value;
              return (
                <Pressable
                  key={level.value}
                  style={[
                    styles.levelCard,
                    isSelected && styles.levelCardSelected,
                  ]}
                  onPress={() => updateField('experienceLevel', level.value)}
                >
                  <Text
                    style={[
                      styles.levelLabel,
                      isSelected && styles.levelLabelSelected,
                    ]}
                  >
                    {level.label}
                  </Text>
                  <Text style={styles.levelDescription}>
                    {level.description}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Primary Goal Section */}
        <View style={styles.section}>
          <SectionHeader title="Primary Goal" />
          <Text style={styles.sectionDescription}>
            What are you working towards? (optional)
          </Text>
          <TextInput
            style={styles.textInput}
            value={preferences.primaryGoal || ''}
            onChangeText={(text) => updateField('primaryGoal', text)}
            placeholder="e.g. Build muscle, Lose weight, Improve endurance"
            placeholderTextColor={palette.textMuted}
            maxLength={100}
          />
        </View>

        {/* Injuries Section */}
        <View style={styles.section}>
          <SectionHeader title="Injuries & Constraints" />
          <Text style={styles.sectionDescription}>
            Any injuries or limitations to work around? (up to 3)
          </Text>
          <View style={styles.injuryInputRow}>
            <TextInput
              style={[styles.textInput, styles.injuryInput]}
              value={injuryInput}
              onChangeText={setInjuryInput}
              placeholder="e.g. Lower back pain"
              placeholderTextColor={palette.textMuted}
              maxLength={50}
              onSubmitEditing={addInjury}
              returnKeyType="done"
            />
            <Button
              label="Add"
              onPress={addInjury}
              disabled={!injuryInput.trim()}
              style={styles.addButton}
              variant="secondary"
            />
          </View>
          {preferences.injuries.length > 0 && (
            <View style={styles.injuryList}>
              {preferences.injuries.map((injury) => (
                <View key={injury} style={styles.injuryTag}>
                  <Text style={styles.injuryTagText}>{injury}</Text>
                  <Pressable onPress={() => removeInjury(injury)} hitSlop={8}>
                    <Text style={styles.injuryRemove}>×</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Preferred Style Section */}
        <View style={styles.section}>
          <SectionHeader title="Preferred Style" />
          <Text style={styles.sectionDescription}>
            What type of training do you enjoy? (optional)
          </Text>
          <TextInput
            style={styles.textInput}
            value={preferences.preferredStyle || ''}
            onChangeText={(text) => updateField('preferredStyle', text)}
            placeholder="e.g. Strength training, HIIT, Yoga, Hybrid"
            placeholderTextColor={palette.textMuted}
            maxLength={100}
          />
        </View>

        {preferences.adaptiveTrainingPlan && (
          <View style={styles.section}>
            <SectionHeader title="Training Rhythm" />
            <Text style={styles.sectionDescription}>
              Edit the adaptive blocks and target ranges Home uses for coach
              recommendations. Projected sessions can reflow; pinned sessions
              should stay put until you change them.
            </Text>

            <View style={styles.planCard}>
              <Text style={styles.planCardLabel}>Blocks</Text>
              <View style={styles.miniChipWrap}>
                {preferences.adaptiveTrainingPlan.blocks.map((block) => (
                  <View key={block.id} style={styles.blockPill}>
                    <Text style={styles.blockPillTitle}>{block.label}</Text>
                    <Text style={styles.blockPillMeta}>
                      {formatLabel(block.category)} · {block.defaultDurationMinutes} min
                    </Text>
                  </View>
                ))}
              </View>

              <Text style={styles.planCardLabel}>Target Ranges</Text>
              {preferences.adaptiveTrainingPlan.targetRanges.map((target) => (
                <View key={target.id} style={styles.targetRangeCard}>
                  <View style={styles.targetRangeHeader}>
                    <View>
                      <Text style={styles.slotEditorTitle}>{target.label}</Text>
                      <Text style={styles.blockPillMeta}>{formatRange(target)}</Text>
                    </View>
                    <Text style={styles.projectionBadge}>Projected</Text>
                  </View>
                  <View style={styles.rangeControlRow}>
                    <Text style={styles.rangeControlLabel}>Min</Text>
                    <Button
                      label="-"
                      variant="secondary"
                      onPress={() =>
                        updateTargetRange(target.id, {
                          minCount: Math.max(0, target.minCount - 1),
                        })
                      }
                      disabled={target.minCount <= 0}
                      style={styles.rangeButton}
                    />
                    <Text style={styles.rangeValue}>{target.minCount}</Text>
                    <Button
                      label="+"
                      variant="secondary"
                      onPress={() =>
                        updateTargetRange(target.id, {
                          minCount: Math.min(target.maxCount, target.minCount + 1),
                        })
                      }
                      disabled={target.minCount >= target.maxCount}
                      style={styles.rangeButton}
                    />
                    <Text style={styles.rangeControlLabel}>Max</Text>
                    <Button
                      label="-"
                      variant="secondary"
                      onPress={() =>
                        updateTargetRange(target.id, {
                          maxCount: Math.max(target.minCount, target.maxCount - 1),
                        })
                      }
                      disabled={target.maxCount <= target.minCount}
                      style={styles.rangeButton}
                    />
                    <Text style={styles.rangeValue}>{target.maxCount}</Text>
                    <Button
                      label="+"
                      variant="secondary"
                      onPress={() =>
                        updateTargetRange(target.id, {
                          maxCount: target.maxCount + 1,
                        })
                      }
                      style={styles.rangeButton}
                    />
                  </View>
                </View>
              ))}

              <Text style={styles.planCardLabel}>Typical Week Preferences</Text>
              {preferences.adaptiveTrainingPlan.typicalWeekPreferences.map(
                (preference) => (
                  <View
                    key={`${preference.dayOfWeek}-${preference.preferredBlockIds.join('-')}`}
                    style={styles.preferenceRow}
                  >
                    <Text style={styles.preferenceDay}>
                      {formatLabel(preference.dayOfWeek)}
                    </Text>
                    <Text style={styles.preferenceBlocks}>
                      {preference.preferredBlockIds
                        .map(
                          (blockId) =>
                            preferences.adaptiveTrainingPlan?.blocks.find(
                              (block) => block.id === blockId
                            )?.label ?? blockId
                        )
                        .join(', ')}
                    </Text>
                    <Text style={styles.projectionBadge}>
                      {preference.flexibility === 'pinned' ? 'Pinned' : 'Preferred'}
                    </Text>
                  </View>
                )
              )}
            </View>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
      <BottomNavigation />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 0,
  },
  screenTitle: {
    fontFamily: typography.fontFamilyExtraBold,
    fontSize: 28,
    color: palette.textPrimary,
  },
  saveButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.card,
  },
  saveButtonActive: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: palette.textMuted,
    fontFamily: typography.fontFamilyBold,
    fontSize: 14,
  },
  saveButtonTextActive: {
    color: palette.textInverse,
  },
  section: {
    marginBottom: 32,
  },
  sectionDescription: {
    fontSize: 14,
    color: palette.textSecondary,
    marginBottom: 16,
    lineHeight: 20,
    fontFamily: typography.fontFamily,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  levelContainer: {
    gap: 12,
  },
  levelCard: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.border,
  },
  levelCardSelected: {
    backgroundColor: palette.cardSecondary,
    borderColor: palette.primary,
  },
  levelLabel: {
    fontSize: 16,
    fontFamily: typography.fontFamilyBold,
    color: palette.textPrimary,
    marginBottom: 4,
  },
  levelLabelSelected: {
    color: palette.primary,
  },
  levelDescription: {
    fontSize: 13,
    color: palette.textSecondary,
    lineHeight: 18,
    fontFamily: typography.fontFamily,
  },
  textInput: {
    backgroundColor: palette.card,
    borderRadius: 12,
    padding: 16,
    color: palette.textPrimary,
    fontSize: 16,
    borderWidth: 1,
    borderColor: palette.border,
    fontFamily: typography.fontFamily,
  },
  injuryInputRow: {
    flexDirection: 'row',
    gap: 12,
  },
  injuryInput: {
    flex: 1,
  },
  addButton: {
    paddingVertical: 0,
  },
  injuryList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 12,
  },
  injuryTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.cardSecondary,
    paddingVertical: 8,
    paddingLeft: 14,
    paddingRight: 10,
    borderRadius: 999,
    gap: 8,
    borderWidth: 1,
    borderColor: palette.border,
  },
  injuryTagText: {
    color: palette.textPrimary,
    fontSize: 14,
    fontFamily: typography.fontFamily,
  },
  injuryRemove: {
    color: palette.textMuted,
    fontSize: 20,
    fontWeight: '300',
    lineHeight: 20,
  },
  planCard: {
    backgroundColor: palette.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 16,
    gap: 14,
  },
  planCardLabel: {
    fontSize: 13,
    fontFamily: typography.fontFamilyBold,
    color: palette.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  planFieldRow: {
    gap: 14,
  },
  planField: {
    gap: 8,
  },
  miniChipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  slotEditorCard: {
    backgroundColor: palette.cardSecondary,
    borderRadius: 14,
    padding: 12,
    gap: 10,
  },
  slotEditorTitle: {
    fontSize: 14,
    fontFamily: typography.fontFamilyBold,
    color: palette.textPrimary,
  },
  blockPill: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: palette.cardSecondary,
    borderWidth: 1,
    borderColor: palette.border,
    gap: 2,
  },
  blockPillTitle: {
    fontSize: 13,
    fontFamily: typography.fontFamilyBold,
    color: palette.textPrimary,
  },
  blockPillMeta: {
    fontSize: 12,
    fontFamily: typography.fontFamily,
    color: palette.textSecondary,
  },
  targetRangeCard: {
    padding: 12,
    borderRadius: 14,
    backgroundColor: palette.cardSecondary,
    gap: 12,
  },
  targetRangeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  projectionBadge: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: '#E0F2FE',
    color: palette.primary,
    fontFamily: typography.fontFamilyBold,
    fontSize: 11,
  },
  rangeControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  rangeControlLabel: {
    fontSize: 12,
    fontFamily: typography.fontFamilyBold,
    color: palette.textSecondary,
    textTransform: 'uppercase',
  },
  rangeButton: {
    minWidth: 38,
    paddingHorizontal: 0,
  },
  rangeValue: {
    minWidth: 18,
    textAlign: 'center',
    fontSize: 14,
    fontFamily: typography.fontFamilyBold,
    color: palette.textPrimary,
  },
  preferenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: palette.cardSecondary,
  },
  preferenceDay: {
    width: 86,
    fontSize: 13,
    fontFamily: typography.fontFamilyBold,
    color: palette.textPrimary,
  },
  preferenceBlocks: {
    flex: 1,
    fontSize: 13,
    fontFamily: typography.fontFamily,
    color: palette.textSecondary,
  },
});
