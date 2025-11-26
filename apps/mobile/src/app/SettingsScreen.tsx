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
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from './navigation';
import {
  UserPreferences,
  EQUIPMENT_OPTIONS,
  ExperienceLevel,
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
  warning: '#ffb347',
  destructive: '#ff6b6b',
  success: '#6efacc',
};

type SettingsNav = NativeStackNavigationProp<RootStackParamList, 'Settings'>;

const EXPERIENCE_LEVELS: { value: ExperienceLevel; label: string; description: string }[] = [
  { value: 'beginner', label: 'Beginner', description: 'New to fitness or returning after a long break' },
  { value: 'intermediate', label: 'Intermediate', description: '1-3 years of consistent training' },
  { value: 'advanced', label: 'Advanced', description: '3+ years with solid technique' },
];

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
  const navigation = useNavigation<SettingsNav>();

  useEffect(() => {
    const loadPreferences = async () => {
      const prefs = await userRepository.getPreferences();
      setPreferences(prefs);
    };
    loadPreferences();
  }, []);

  const updateField = useCallback(<K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K],
  ) => {
    setPreferences((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  }, []);

  const toggleEquipment = useCallback((item: string) => {
    setPreferences((prev) => {
      const current = prev.equipment;
      const updated = current.includes(item)
        ? current.filter((e) => e !== item)
        : [...current, item];
      return { ...prev, equipment: updated };
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

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await userRepository.updatePreferences(preferences);
      setHasChanges(false);
      Alert.alert('Saved', 'Your profile has been updated.');
    } catch (e) {
      console.error('Failed to save preferences', e);
      Alert.alert('Error', 'Failed to save your preferences. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    if (hasChanges) {
      Alert.alert(
        'Unsaved Changes',
        'You have unsaved changes. Are you sure you want to leave?',
        [
          { text: 'Stay', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: () => navigation.goBack() },
        ],
      );
    } else {
      navigation.goBack();
    }
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.headerRow}>
          <Pressable
            style={styles.closeButton}
            onPress={handleClose}
            accessibilityRole="button"
            accessibilityLabel="Close settings"
          >
            <Text style={styles.closeButtonText}>Close</Text>
          </Pressable>
          <Text style={styles.screenTitle}>Profile</Text>
          <Pressable
            style={[
              styles.saveButton,
              hasChanges && styles.saveButtonActive,
              isSaving && styles.saveButtonDisabled,
            ]}
            onPress={handleSave}
            disabled={!hasChanges || isSaving}
            accessibilityRole="button"
            accessibilityLabel="Save profile changes"
            accessibilityState={{ disabled: !hasChanges || isSaving }}
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

        {/* Equipment Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>My Equipment</Text>
          <Text style={styles.sectionDescription}>
            Select the equipment you have access to. This helps generate workouts tailored to your setup.
          </Text>
          <View style={styles.chipContainer}>
            {EQUIPMENT_OPTIONS.map((item) => {
              const isSelected = preferences.equipment.includes(item);
              return (
                <Pressable
                  key={item}
                  style={[styles.chip, isSelected && styles.chipSelected]}
                  onPress={() => toggleEquipment(item)}
                  accessibilityRole="checkbox"
                  accessibilityLabel={item}
                  accessibilityState={{ checked: isSelected }}
                >
                  <Text
                    style={[
                      styles.chipText,
                      isSelected && styles.chipTextSelected,
                    ]}
                  >
                    {item}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Experience Level Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Experience Level</Text>
          <Text style={styles.sectionDescription}>
            This helps calibrate workout intensity and exercise complexity.
          </Text>
          <View style={styles.levelContainer}>
            {EXPERIENCE_LEVELS.map((level) => {
              const isSelected = preferences.experienceLevel === level.value;
              return (
                <Pressable
                  key={level.value}
                  style={[styles.levelCard, isSelected && styles.levelCardSelected]}
                  onPress={() => updateField('experienceLevel', level.value)}
                  accessibilityRole="radio"
                  accessibilityLabel={`${level.label}: ${level.description}`}
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
        </View>

        {/* Primary Goal Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Primary Goal</Text>
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
            accessibilityLabel="Primary fitness goal"
          />
        </View>

        {/* Injuries Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Injuries & Constraints</Text>
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
              accessibilityLabel="Add injury or constraint"
            />
            <Pressable
              style={[
                styles.addButton,
                !injuryInput.trim() && styles.addButtonDisabled,
              ]}
              onPress={addInjury}
              disabled={!injuryInput.trim()}
              accessibilityRole="button"
              accessibilityLabel="Add injury"
              accessibilityState={{ disabled: !injuryInput.trim() }}
            >
              <Text style={styles.addButtonText}>Add</Text>
            </Pressable>
          </View>
          {preferences.injuries.length > 0 && (
            <View style={styles.injuryList}>
              {preferences.injuries.map((injury) => (
                <View key={injury} style={styles.injuryTag}>
                  <Text style={styles.injuryTagText}>{injury}</Text>
                  <Pressable
                    onPress={() => removeInjury(injury)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${injury}`}
                  >
                    <Text style={styles.injuryRemove}>×</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Preferred Style Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferred Style</Text>
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
            accessibilityLabel="Preferred workout style"
          />
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.background,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 24,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: palette.textPrimary,
  },
  closeButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.border,
  },
  closeButtonText: {
    color: palette.textSecondary,
    fontWeight: '600',
  },
  saveButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.border,
  },
  saveButtonActive: {
    backgroundColor: palette.accent,
    borderColor: palette.accent,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: palette.textMuted,
    fontWeight: '600',
  },
  saveButtonTextActive: {
    color: palette.background,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: palette.textPrimary,
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: palette.textSecondary,
    marginBottom: 16,
    lineHeight: 20,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.border,
  },
  chipSelected: {
    backgroundColor: palette.accentMuted,
    borderColor: palette.accent,
  },
  chipText: {
    color: palette.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
  chipTextSelected: {
    color: palette.accent,
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
    backgroundColor: palette.accentMuted,
    borderColor: palette.accent,
  },
  levelLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: palette.textPrimary,
    marginBottom: 4,
  },
  levelLabelSelected: {
    color: palette.accent,
  },
  levelDescription: {
    fontSize: 13,
    color: palette.textSecondary,
    lineHeight: 18,
  },
  textInput: {
    backgroundColor: palette.card,
    borderRadius: 12,
    padding: 16,
    color: palette.textPrimary,
    fontSize: 16,
    borderWidth: 1,
    borderColor: palette.border,
  },
  injuryInputRow: {
    flexDirection: 'row',
    gap: 12,
  },
  injuryInput: {
    flex: 1,
  },
  addButton: {
    backgroundColor: palette.accent,
    paddingHorizontal: 20,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonDisabled: {
    backgroundColor: palette.card,
  },
  addButtonText: {
    color: palette.background,
    fontWeight: '600',
    fontSize: 14,
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
  },
  injuryTagText: {
    color: palette.textPrimary,
    fontSize: 14,
  },
  injuryRemove: {
    color: palette.textMuted,
    fontSize: 20,
    fontWeight: '300',
    lineHeight: 20,
  },
});
