import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  GYM_EQUIPMENT,
  adaptiveTrainingPlanSchema,
  normalizeEquipmentSelection,
  type AdaptiveTargetRange,
  type UserPreferences,
} from '@workout-agent/shared';
import { BottomNavigation } from './components/BottomNavigation';
import { userRepository } from './db/repositories/UserRepository';
import {
  ConstraintsEditor,
  EquipmentEditor,
  ProfileEditor,
  RhythmEditor,
} from './settings/SettingsEditors';
import { SettingsSummary } from './settings/SettingsSummary';
import { getConstraintItems, getTrainingTargets } from './settings/settingsHelpers';
import { styles } from './settings/settingsStyles';
import { EDITOR_TITLES, type EditorKey } from './settings/settingsTypes';
import { palette } from './theme';

const INITIAL_PREFERENCES: UserPreferences = {
  equipment: [],
  injuries: [],
  focusBias: [],
  avoid: [],
};

export const SettingsScreen = () => {
  const [preferences, setPreferences] =
    useState<UserPreferences>(INITIAL_PREFERENCES);
  const [activeEditor, setActiveEditor] = useState<EditorKey | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [injuryInput, setInjuryInput] = useState('');
  const [avoidInput, setAvoidInput] = useState('');

  useEffect(() => {
    let cancelled = false;

    const loadPreferences = async () => {
      const prefs = await userRepository.getPreferences();
      if (cancelled) return;
      setPreferences({
        ...prefs,
        equipment: normalizeEquipmentSelection(prefs.equipment),
      });
    };

    void loadPreferences();

    return () => {
      cancelled = true;
    };
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
        ? current.filter((equipment) => equipment !== item)
        : [...current.filter((equipment) => equipment !== GYM_EQUIPMENT), item];
      return { ...prev, equipment: normalizeEquipmentSelection(updated) };
    });
    setHasChanges(true);
  }, []);

  const addInjury = useCallback(() => {
    const trimmed = injuryInput.trim();
    if (!trimmed) return;
    if (preferences.injuries.length >= 3) {
      Alert.alert('Limit reached', 'You can add up to 3 safety notes.');
      return;
    }
    if (preferences.injuries.includes(trimmed)) {
      Alert.alert('Already added', 'This note is already in your list.');
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
      injuries: prev.injuries.filter((item) => item !== injury),
    }));
    setHasChanges(true);
  }, []);

  const addAvoid = useCallback(() => {
    const trimmed = avoidInput.trim();
    if (!trimmed) return;
    if (preferences.avoid.length >= 5) {
      Alert.alert('Limit reached', 'You can add up to 5 things to avoid.');
      return;
    }
    if (preferences.avoid.includes(trimmed)) {
      Alert.alert('Already added', 'This item is already in your list.');
      return;
    }

    setPreferences((prev) => ({
      ...prev,
      avoid: [...prev.avoid, trimmed],
    }));
    setAvoidInput('');
    setHasChanges(true);
  }, [avoidInput, preferences.avoid]);

  const removeAvoid = useCallback((item: string) => {
    setPreferences((prev) => ({
      ...prev,
      avoid: prev.avoid.filter((avoidItem) => avoidItem !== item),
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
        return { ...prev, adaptiveTrainingPlan: result.data };
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
                : Math.min(
                    Math.max(next.idealCount, next.minCount),
                    next.maxCount
                  ),
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

  const trainingTargets = useMemo(
    () => getTrainingTargets(preferences.adaptiveTrainingPlan),
    [preferences.adaptiveTrainingPlan]
  );
  const constraintItems = useMemo(
    () => getConstraintItems(preferences),
    [preferences]
  );

  const renderEditorContent = () => {
    switch (activeEditor) {
      case 'profile':
        return (
          <ProfileEditor preferences={preferences} updateField={updateField} />
        );
      case 'rhythm':
        return (
          <RhythmEditor
            plan={preferences.adaptiveTrainingPlan}
            updateTargetRange={updateTargetRange}
          />
        );
      case 'constraints':
        return (
          <ConstraintsEditor
            preferences={preferences}
            injuryInput={injuryInput}
            avoidInput={avoidInput}
            setInjuryInput={setInjuryInput}
            setAvoidInput={setAvoidInput}
            addInjury={addInjury}
            removeInjury={removeInjury}
            addAvoid={addAvoid}
            removeAvoid={removeAvoid}
          />
        );
      case 'equipment':
        return (
          <EquipmentEditor
            equipment={preferences.equipment}
            toggleEquipment={toggleEquipment}
          />
        );
      default:
        return (
          <SettingsSummary
            preferences={preferences}
            trainingTargets={trainingTargets}
            constraintItems={constraintItems}
            onOpenEditor={setActiveEditor}
          />
        );
    }
  };

  const saveLabel = isSaving ? 'Saving...' : hasChanges ? 'Save' : 'Saved';

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.screenTitle}>Profile</Text>
          <Text style={styles.screenSubtitle}>
            {activeEditor ? EDITOR_TITLES[activeEditor] : 'What your coach knows'}
          </Text>
        </View>
        <Pressable
          style={[
            styles.saveButton,
            hasChanges && styles.saveButtonActive,
            isSaving && styles.saveButtonDisabled,
          ]}
          onPress={handleSave}
          disabled={!hasChanges || isSaving}
          accessibilityRole="button"
          accessibilityLabel={saveLabel}
        >
          <Text
            style={[
              styles.saveButtonText,
              hasChanges && styles.saveButtonTextActive,
            ]}
          >
            {saveLabel}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {activeEditor && (
          <Pressable
            style={styles.backButton}
            onPress={() => setActiveEditor(null)}
            accessibilityRole="button"
            accessibilityLabel="Back to profile summary"
          >
            <Ionicons name="chevron-back" size={18} color={palette.primary} />
            <Text style={styles.backButtonText}>Profile summary</Text>
          </Pressable>
        )}
        {renderEditorContent()}
        <View style={styles.bottomSpacer} />
      </ScrollView>
      <BottomNavigation />
    </View>
  );
};
