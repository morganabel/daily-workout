import React from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import {
  EQUIPMENT_OPTIONS,
  type AdaptiveTargetRange,
  type UpcomingEventContext,
  type UserPreferences,
} from '@workout-agent/shared';
import { Button, Card, Chip } from '../components/DesignSystem';
import { palette } from '../theme';
import { styles } from './settingsStyles';
import type { PreferenceUpdater } from './settingsTypes';
import { EXPERIENCE_LEVELS } from './settingsTypes';
import {
  formatCountRange,
  formatLabel,
  getBlockLabel,
  humanTargetLabel,
  summarizeBlockLabel,
} from './settingsHelpers';

type ProfileEditorProps = {
  preferences: UserPreferences;
  updateField: PreferenceUpdater;
};

export const ProfileEditor = ({
  preferences,
  updateField,
}: ProfileEditorProps) => (
  <View style={styles.editorSection}>
    <Text style={styles.editorLabel}>Experience</Text>
    <View style={styles.levelContainer}>
      {EXPERIENCE_LEVELS.map((level) => {
        const isSelected = preferences.experienceLevel === level.value;
        return (
          <Pressable
            key={level.value}
            style={[styles.levelCard, isSelected && styles.levelCardSelected]}
            onPress={() => updateField('experienceLevel', level.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: isSelected }}
          >
            <Text
              style={[
                styles.levelLabel,
                isSelected && styles.levelLabelSelected,
              ]}
            >
              {level.label}
            </Text>
            <Text style={styles.levelDescription}>{level.description}</Text>
          </Pressable>
        );
      })}
    </View>

    <Text style={styles.editorLabel}>Goal</Text>
    <TextInput
      style={styles.textInput}
      value={preferences.primaryGoal || ''}
      onChangeText={(text) => updateField('primaryGoal', text)}
      placeholder="Build muscle, lose fat, improve endurance"
      placeholderTextColor={palette.textMuted}
      maxLength={100}
    />

    <Text style={styles.editorLabel}>Training style</Text>
    <TextInput
      style={styles.textInput}
      value={preferences.preferredStyle || ''}
      onChangeText={(text) => updateField('preferredStyle', text)}
      placeholder="Strength + conditioning"
      placeholderTextColor={palette.textMuted}
      maxLength={100}
    />
  </View>
);

export const GenerationEditor = ({
  preferences,
  updateField,
}: ProfileEditorProps) => (
  <View style={styles.editorSection}>
    <Pressable
      style={[
        styles.levelCard,
        preferences.aiFeaturesEnabled !== false && styles.levelCardSelected,
      ]}
      onPress={() => updateField('aiFeaturesEnabled', true)}
      accessibilityRole="radio"
      accessibilityState={{ selected: preferences.aiFeaturesEnabled !== false }}
    >
      <Text
        style={[
          styles.levelLabel,
          preferences.aiFeaturesEnabled !== false && styles.levelLabelSelected,
        ]}
      >
        AI + catalog
      </Text>
    </Pressable>
    <Pressable
      style={[
        styles.levelCard,
        preferences.aiFeaturesEnabled === false && styles.levelCardSelected,
      ]}
      onPress={() => updateField('aiFeaturesEnabled', false)}
      accessibilityRole="radio"
      accessibilityState={{ selected: preferences.aiFeaturesEnabled === false }}
    >
      <Text
        style={[
          styles.levelLabel,
          preferences.aiFeaturesEnabled === false && styles.levelLabelSelected,
        ]}
      >
        Catalog only
      </Text>
    </Pressable>
  </View>
);

type RhythmEditorProps = {
  plan: UserPreferences['adaptiveTrainingPlan'];
  updateTargetRange: (
    targetId: string,
    updates: Partial<AdaptiveTargetRange>
  ) => void;
};

export const RhythmEditor = ({
  plan,
  updateTargetRange,
}: RhythmEditorProps) => {
  if (!plan) {
    return (
      <Card style={styles.emptyCard}>
        <Text style={styles.summaryTitle}>No plan yet</Text>
        <Text style={styles.summaryBody}>
          Finish setup from Today to add your weekly rhythm.
        </Text>
      </Card>
    );
  }

  return (
    <View style={styles.editorSection}>
      <Text style={styles.editorLabel}>Weekly guidance</Text>
      <View style={styles.targetList}>
        {plan.targetRanges.map((target) => (
          <View key={target.id} style={styles.targetEditorCard}>
            <View style={styles.targetEditorHeader}>
              <View style={styles.targetEditorCopy}>
                <Text style={styles.targetEditorTitle}>
                  {humanTargetLabel(target)}
                </Text>
                <Text style={styles.targetEditorMeta}>
                  {formatCountRange(target.minCount, target.maxCount)}/week
                </Text>
              </View>
            </View>
            <View style={styles.stepperGrid}>
              <View style={styles.stepperRow}>
                <Text style={styles.stepperLabel}>At least</Text>
                <View style={styles.stepperControls}>
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
                  <Text style={styles.rangeValue}>{target.minCount}x</Text>
                  <Button
                    label="+"
                    variant="secondary"
                    onPress={() =>
                      updateTargetRange(target.id, {
                        minCount: Math.min(
                          target.maxCount,
                          target.minCount + 1
                        ),
                      })
                    }
                    disabled={target.minCount >= target.maxCount}
                    style={styles.rangeButton}
                  />
                </View>
              </View>
              <View style={styles.stepperRow}>
                <Text style={styles.stepperLabel}>Up to</Text>
                <View style={styles.stepperControls}>
                  <Button
                    label="-"
                    variant="secondary"
                    onPress={() =>
                      updateTargetRange(target.id, {
                        maxCount: Math.max(
                          target.minCount,
                          target.maxCount - 1
                        ),
                      })
                    }
                    disabled={target.maxCount <= target.minCount}
                    style={styles.rangeButton}
                  />
                  <Text style={styles.rangeValue}>{target.maxCount}x</Text>
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
            </View>
          </View>
        ))}
      </View>

      <Text style={styles.editorLabel}>Usually</Text>
      <View style={styles.weekPreferenceList}>
        {plan.typicalWeekPreferences.map((preference) => (
          <View
            key={`${preference.dayOfWeek}-${preference.preferredBlockIds.join(
              '-'
            )}`}
            style={styles.preferenceRow}
          >
            <View style={styles.preferenceCopy}>
              <Text style={styles.preferenceDay}>
                {formatLabel(preference.dayOfWeek)}
              </Text>
              <Text style={styles.preferenceBlocks}>
                {preference.preferredBlockIds
                  .map((blockId) =>
                    summarizeBlockLabel(getBlockLabel(plan.blocks, blockId))
                  )
                  .join(', ')}
              </Text>
            </View>
            <Text style={styles.preferenceBadge}>
              {preference.flexibility === 'pinned'
                ? 'Pinned'
                : preference.flexibility === 'preferred'
                  ? 'Usually'
                  : 'Flexible'}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
};

type ConstraintsEditorProps = {
  preferences: UserPreferences;
  injuryInput: string;
  avoidInput: string;
  setInjuryInput: (value: string) => void;
  setAvoidInput: (value: string) => void;
  addInjury: () => void;
  removeInjury: (injury: string) => void;
  addAvoid: () => void;
  removeAvoid: (item: string) => void;
};

export const ConstraintsEditor = ({
  preferences,
  injuryInput,
  avoidInput,
  setInjuryInput,
  setAvoidInput,
  addInjury,
  removeInjury,
  addAvoid,
  removeAvoid,
}: ConstraintsEditorProps) => (
  <View style={styles.editorSection}>
    <Text style={styles.editorIntro}>
      Injuries, movements, or equipment to work around.
    </Text>

    <Text style={styles.editorLabel}>Safety notes</Text>
    <View style={styles.inputActionRow}>
      <TextInput
        style={[styles.textInput, styles.inputWithAction]}
        value={injuryInput}
        onChangeText={setInjuryInput}
        placeholder="Lower back sensitivity"
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
    <View style={styles.tagList}>
      {preferences.injuries.map((injury) => (
        <View key={injury} style={styles.removableTag}>
          <Text style={styles.removableTagText}>{injury}</Text>
          <Pressable onPress={() => removeInjury(injury)} hitSlop={8}>
            <Text style={styles.removeText}>×</Text>
          </Pressable>
        </View>
      ))}
    </View>

    <Text style={styles.editorLabel}>Things to avoid</Text>
    <View style={styles.inputActionRow}>
      <TextInput
        style={[styles.textInput, styles.inputWithAction]}
        value={avoidInput}
        onChangeText={setAvoidInput}
        placeholder="High-impact jumping"
        placeholderTextColor={palette.textMuted}
        maxLength={50}
        onSubmitEditing={addAvoid}
        returnKeyType="done"
      />
      <Button
        label="Add"
        onPress={addAvoid}
        disabled={!avoidInput.trim()}
        style={styles.addButton}
        variant="secondary"
      />
    </View>
    <View style={styles.tagList}>
      {preferences.avoid.map((item) => (
        <View key={item} style={styles.removableTag}>
          <Text style={styles.removableTagText}>{item}</Text>
          <Pressable onPress={() => removeAvoid(item)} hitSlop={8}>
            <Text style={styles.removeText}>×</Text>
          </Pressable>
        </View>
      ))}
    </View>
  </View>
);

type EquipmentEditorProps = {
  equipment: string[];
  toggleEquipment: (item: string) => void;
};

export const EquipmentEditor = ({
  equipment,
  toggleEquipment,
}: EquipmentEditorProps) => (
  <View style={styles.editorSection}>
    <Text style={styles.editorIntro}>Select what you usually have.</Text>
    <View style={styles.chipContainer}>
      {EQUIPMENT_OPTIONS.map((item) => (
        <Chip
          key={item}
          label={item}
          selected={equipment.includes(item)}
          onPress={() => toggleEquipment(item)}
        />
      ))}
    </View>
  </View>
);

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_LABELS = [
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

const formatCommitmentDate = (localDate: string): string => {
  const [year, month, day] = localDate.split('-').map((part) => Number(part));
  if (!year || !month || !day) return localDate;
  const date = new Date(year, month - 1, day);
  return `${WEEKDAY_LABELS[date.getDay()]}, ${MONTH_LABELS[month - 1]} ${day}`;
};

type CommitmentsEditorProps = {
  plan: UserPreferences['adaptiveTrainingPlan'];
  upcomingEvents: UpcomingEventContext[];
  removePinnedCommitment: (id: string) => void;
  onManageCalendar: () => void;
};

export const CommitmentsEditor = ({
  plan,
  upcomingEvents,
  removePinnedCommitment,
  onManageCalendar,
}: CommitmentsEditorProps) => {
  const pinnedCommitments = (plan?.sessionPreferences ?? []).filter(
    (preference) => preference.status === 'pinned'
  );

  return (
    <View style={styles.editorSection}>
      <Text style={styles.editorIntro}>
        Sessions you&apos;ve locked in and major events to plan around. Your
        coach schedules everything else automatically.
      </Text>

      <Text style={styles.editorLabel}>Pinned sessions</Text>
      {pinnedCommitments.length > 0 ? (
        <View style={styles.weekPreferenceList}>
          {pinnedCommitments.map((commitment) => (
            <View key={commitment.id} style={styles.preferenceRow}>
              <View style={styles.preferenceCopy}>
                <Text style={styles.preferenceDay}>
                  {formatCommitmentDate(commitment.localDate)}
                </Text>
                <Text style={styles.preferenceBlocks}>
                  {commitment.blockIds
                    .map((blockId) =>
                      summarizeBlockLabel(
                        getBlockLabel(plan?.blocks ?? [], blockId)
                      )
                    )
                    .join(', ')}
                </Text>
              </View>
              <Pressable
                onPress={() => removePinnedCommitment(commitment.id)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`Unpin ${formatCommitmentDate(
                  commitment.localDate
                )}`}
              >
                <Text style={styles.removeText}>×</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.summaryBody}>
          No pinned sessions. Pin a session from Today to lock it in.
        </Text>
      )}

      <Text style={styles.editorLabel}>Major events</Text>
      {upcomingEvents.length > 0 ? (
        <View style={styles.weekPreferenceList}>
          {upcomingEvents.map((event) => (
            <View
              key={`${event.localDate}-${event.title}`}
              style={styles.preferenceRow}
            >
              <View style={styles.preferenceCopy}>
                <Text style={styles.preferenceDay}>
                  {formatCommitmentDate(event.localDate)}
                </Text>
                <Text style={styles.preferenceBlocks}>{event.title}</Text>
              </View>
              {event.intensity ? (
                <Text style={styles.preferenceBadge}>
                  {formatLabel(event.intensity)}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.summaryBody}>
          No upcoming events. Add races, trips, or commitments in the calendar.
        </Text>
      )}

      <Button
        label="Manage in calendar"
        variant="secondary"
        onPress={onManageCalendar}
        style={styles.addButton}
      />
    </View>
  );
};
