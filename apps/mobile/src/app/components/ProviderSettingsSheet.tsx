import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Modal,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';

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

type ProviderOption = {
  id: string;
  label: string;
};

const PROVIDERS: ProviderOption[] = [
  { id: 'openai', label: 'OpenAI' },
  { id: 'gemini', label: 'Gemini' },
  { id: 'deepseek', label: 'DeepSeek' },
  { id: 'mistral', label: 'Mistral' },
  { id: 'groq', label: 'Groq' },
];

export const ProviderSettingsSheet = ({
  visible,
  apiKey,
  providerId,
  onClose,
  onSave,
  onRemove,
}: {
  visible: boolean;
  apiKey: string;
  providerId: string;
  onClose: () => void;
  onSave: (key: string, provider: string) => void;
  onRemove?: () => void;
}) => {
  const [localKey, setLocalKey] = useState(apiKey);
  const [localProvider, setLocalProvider] = useState(providerId || 'openai');

  useEffect(() => {
    if (visible) {
      setLocalKey(apiKey);
      setLocalProvider(providerId || 'openai');
    }
  }, [visible, apiKey, providerId]);

  const handleSave = () => {
    onSave(localKey, localProvider);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.sheetOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 32 : 0}
          style={styles.sheetContainer}
        >
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Provider Settings</Text>

            <View>
              <Text style={styles.label}>AI Provider</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.providerScroll}
              >
                {PROVIDERS.map((p) => (
                  <Pressable
                    key={p.id}
                    style={[
                      styles.providerChip,
                      localProvider === p.id && styles.providerChipSelected,
                    ]}
                    onPress={() => setLocalProvider(p.id)}
                  >
                    <Text
                      style={[
                        styles.providerText,
                        localProvider === p.id && styles.providerTextSelected,
                      ]}
                    >
                      {p.label}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            <View>
              <Text style={styles.label}>API Key</Text>
              <TextInput
                value={localKey}
                onChangeText={setLocalKey}
                placeholder="sk-..."
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
                style={styles.input}
              />
              <Text style={styles.hint}>
                {localProvider === 'openai'
                  ? 'Your OpenAI API key.'
                  : localProvider === 'gemini'
                    ? 'Your Google AI Studio API key.'
                    : `Your ${PROVIDERS.find((p) => p.id === localProvider)?.label} API key.`}
              </Text>
            </View>

            <View style={styles.actions}>
              {onRemove && (
                <Pressable style={styles.secondaryButton} onPress={onRemove}>
                  <Text style={styles.secondaryButtonText}>Remove Key</Text>
                </Pressable>
              )}
              <Pressable
                style={[
                  styles.primaryButton,
                  !localKey.trim() && { opacity: 0.5 },
                ]}
                onPress={handleSave}
                disabled={!localKey.trim()}
              >
                <Text style={styles.primaryButtonText}>Save Settings</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  sheetOverlay: {
    flex: 1,
    backgroundColor: '#000000aa',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: palette.card,
    padding: 24,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    gap: 20,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.border,
    alignSelf: 'center',
    marginBottom: 0,
  },
  sheetTitle: {
    color: palette.textPrimary,
    fontSize: 20,
    fontWeight: '600',
  },
  label: {
    color: palette.textSecondary,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
  },
  hint: {
    color: palette.textMuted,
    fontSize: 13,
    marginTop: 8,
  },
  providerScroll: {
    flexGrow: 0,
    marginBottom: 0,
  },
  providerChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.cardSecondary,
    marginRight: 10,
  },
  providerChipSelected: {
    borderColor: palette.accent,
    backgroundColor: `${palette.accent}22`,
  },
  providerText: {
    color: palette.textSecondary,
    fontWeight: '500',
  },
  providerTextSelected: {
    color: palette.accent,
    fontWeight: '600',
  },
  input: {
    backgroundColor: palette.cardSecondary,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: palette.textPrimary,
    fontSize: 16,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: palette.accent,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#031b1b',
    fontWeight: '600',
    fontSize: 16,
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
    fontWeight: '500',
    fontSize: 16,
  },
});
