import React, { useState, useEffect } from 'react';
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

export const SettingsScreen = () => {
  const [preferences, setPreferences] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const subscription = userRepository.observeUser().subscribe((users) => {
      const user = users.length > 0 ? users[0] : null;
      if (user && user.preferences) {
        try {
          setPreferences(JSON.parse(user.preferences));
        } catch (e) {
          console.error('Failed to parse preferences', e);
        }
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSave = async (key: string, value: string) => {
    const newPreferences = { ...preferences, [key]: value };
    setPreferences(newPreferences);
    await userRepository.updatePreferences(newPreferences);
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.screenTitle}>Settings</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences</Text>
          <View style={styles.card}>
            <Text style={styles.label}>Experience Level</Text>
            <TextInput
              style={styles.input}
              value={preferences.experienceLevel || ''}
              onChangeText={(text) => handleSave('experienceLevel', text)}
              placeholder="Beginner, Intermediate, Advanced"
              placeholderTextColor={palette.textMuted}
            />

            <Text style={styles.label}>Primary Goal</Text>
            <TextInput
              style={styles.input}
              value={preferences.primaryGoal || ''}
              onChangeText={(text) => handleSave('primaryGoal', text)}
              placeholder="e.g. Build Muscle"
              placeholderTextColor={palette.textMuted}
            />
          </View>
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
  screenTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: palette.textPrimary,
    marginBottom: 24,
    marginTop: 60,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: palette.textPrimary,
    marginBottom: 12,
  },
  card: {
    backgroundColor: palette.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: palette.border,
  },
  label: {
    fontSize: 14,
    color: palette.textSecondary,
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: palette.cardSecondary,
    borderRadius: 8,
    padding: 12,
    color: palette.textPrimary,
    fontSize: 16,
    borderWidth: 1,
    borderColor: palette.border,
  },
});
