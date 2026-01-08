/**
 * Launch Screen
 *
 * Goals:
 * - Returning users who don't need setup should be routed to Home immediately.
 * - New users should clearly see: "Explore" (anonymous session) OR "Sign up".
 * - BYOK is an advanced/power-user option and should be visually de-emphasized.
 * - Do not block the UI while /api/meta is slow; assume auth is enabled by default.
 * - Only create an anonymous account/session when the user explicitly chooses "Explore".
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AiProvider } from '@workout-agent/shared';

import type { RootStackParamList } from './navigation';
import { getByokConfig, setByokConfig, type ByokConfig } from './storage/byokKey';
import { getLaunchCompleted, setLaunchCompleted } from './storage/launchState';
import {
  authClient,
  fetchServerCapabilities,
  getSessionCookie,
  signInAnonymously,
} from './services/auth-client';

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

const AUTH_ENABLED_DEFAULT =
  (process.env.EXPO_PUBLIC_AUTH_ENABLED ?? 'true').toLowerCase() !== 'false';

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => resolve(null), timeoutMs);
    promise
      .then((value) => {
        clearTimeout(timeoutId);
        resolve(value);
      })
      .catch(() => {
        clearTimeout(timeoutId);
        resolve(null);
      });
  });
}

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type LaunchState = {
  phase: 'checking' | 'showing';
  launchCompleted: boolean;
  auth: {
    enabled: boolean;
    known: boolean;
  };
  hasSession: boolean;
  byok: ByokConfig | null;
};

export const LaunchScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();

  const [state, setState] = useState<LaunchState>({
    phase: 'checking',
    launchCompleted: false,
    auth: { enabled: AUTH_ENABLED_DEFAULT, known: false },
    hasSession: Boolean(getSessionCookie()),
    byok: null,
  });

  const [provider, setProvider] = useState<AiProvider['name']>('openai');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isSavingKey, setIsSavingKey] = useState(false);
  const [isExploring, setIsExploring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const goHome = useCallback(() => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'Home' }],
    });
  }, [navigation]);

  const shouldShowAccountActions = useMemo(() => {
    // Until we know otherwise, assume accounts exist so the UI is not blocked by /api/meta.
    if (!state.auth.known) return true;
    return state.auth.enabled;
  }, [state.auth.enabled, state.auth.known]);

  const bootstrap = useCallback(async () => {
    setError(null);

    const cookie = getSessionCookie();
    const hasSessionCookie = Boolean(cookie);

    const [launchCompleted, byok] = await Promise.all([
      getLaunchCompleted(),
      getByokConfig(),
    ]);

    if (byok?.apiKey) {
      setProvider(byok.provider);
      setApiKeyInput(byok.apiKey);
    }

    // Decide whether to show Launch immediately based on local state only.
    // We don't want /api/meta slowness to block the UI.
    if (hasSessionCookie) {
      void setLaunchCompleted(true);
      goHome();
      return;
    }

    // Returning users should never see Launch unless we can quickly confirm
    // that auth is enabled and a session is required.
    if (launchCompleted) {
      // Respect build-time override first.
      if (!AUTH_ENABLED_DEFAULT) {
        goHome();
        return;
      }

      const metaQuick = await withTimeout(fetchServerCapabilities(), 300);
      if (!metaQuick || !metaQuick.auth.enabled) {
        goHome();
        return;
      }

      // Auth is enabled: show launch so the user can choose Explore / Sign up / Sign in.
      setState((prev) => ({
        ...prev,
        phase: 'showing',
        launchCompleted,
        byok,
        hasSession: hasSessionCookie,
        auth: { enabled: true, known: true },
      }));
      return;
    }

    // New users: show Launch immediately (even if /api/meta is slow).
    setState((prev) => ({
      ...prev,
      phase: 'showing',
      launchCompleted,
      byok,
      hasSession: hasSessionCookie,
    }));

    // Fetch meta in the background (non-blocking).
    void (async () => {
      const meta = await fetchServerCapabilities();
      if (!meta) return;

      setState((prev) => ({
        ...prev,
        auth: { enabled: meta.auth.enabled, known: true },
      }));

      if (meta.auth.enabled) {
        try {
          const session = await authClient.getSession();
          const hasSession = Boolean(session.data?.session);
          if (hasSession) {
            await setLaunchCompleted(true);
            goHome();
          }
        } catch {
          // Ignore; user can still choose "Explore" or sign in.
        }
      }
    })();
  }, [goHome]);

  useFocusEffect(
    useCallback(() => {
      void bootstrap();
    }, [bootstrap]),
  );

  const handleExplore = async () => {
    setError(null);
    setIsExploring(true);
    try {
      // Only create an anonymous session when the user explicitly chooses to explore.
      if (state.auth.enabled) {
        const ok = await signInAnonymously();
        if (!ok) {
          if (state.auth.known) {
            setError(
              'Could not start a session. Please try again, or sign in with email.',
            );
            return;
          }
          // Auth might not actually be enabled; allow the user to proceed.
        }
      }

      await setLaunchCompleted(true);
      goHome();
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsExploring(false);
    }
  };

  const handleSignUp = () => navigation.navigate('SignUp');
  const handleSignIn = () => navigation.navigate('SignIn');

  const handleSaveByok = async () => {
    if (!apiKeyInput.trim()) return;
    setError(null);
    setIsSavingKey(true);
    try {
      const nextByok: ByokConfig = { apiKey: apiKeyInput.trim(), provider };
      await setByokConfig(nextByok);
      setState((prev) => ({ ...prev, byok: nextByok }));
      setShowAdvanced(false);
    } catch {
      setError('Could not save your API key. Please try again.');
    } finally {
      setIsSavingKey(false);
    }
  };

  if (state.phase === 'checking') {
    return (
      <View style={styles.checkingContainer} accessibilityLabel="launch-checking" />
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.hero}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {state.auth.known ? 'Welcome' : 'Connecting…'}
            </Text>
          </View>

          <Text style={styles.title}>Workout Agent</Text>

          <Text style={styles.subtitle}>
            Create an account to sync across devices, or explore instantly with a
            temporary session.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Get started</Text>
          <Text style={styles.cardBody}>
            Explore first, then decide if you want to sign up.
          </Text>

          <View style={styles.primaryActions}>
            <TouchableOpacity
              style={[
                styles.button,
                styles.buttonPrimary,
                isExploring && styles.buttonDisabled,
              ]}
              onPress={handleExplore}
              disabled={isExploring}
              accessibilityLabel="launch-explore"
            >
              {isExploring ? (
                <ActivityIndicator color={palette.background} />
              ) : (
                <Text style={styles.buttonPrimaryText}>Explore</Text>
              )}
            </TouchableOpacity>

            {shouldShowAccountActions ? (
              <TouchableOpacity
                style={[styles.button, styles.buttonSecondary]}
                onPress={handleSignUp}
                disabled={isExploring}
                accessibilityLabel="launch-sign-up"
              >
                <Text style={styles.buttonSecondaryText}>Create account</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {shouldShowAccountActions ? (
            <TouchableOpacity
              style={styles.linkButton}
              onPress={handleSignIn}
              disabled={isExploring}
              accessibilityLabel="launch-sign-in"
            >
              <Text style={styles.linkText}>Already have an account? Sign in</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.caption}>
              Accounts aren’t enabled on this server. You can still explore.
            </Text>
          )}
        </View>

        <View style={styles.advancedWrap}>
          <TouchableOpacity
            style={styles.advancedToggle}
            onPress={() => setShowAdvanced((v) => !v)}
            accessibilityLabel="launch-advanced-toggle"
          >
            <Text style={styles.advancedTitle}>Advanced</Text>
            <Text style={styles.advancedLink}>
              {showAdvanced ? 'Hide' : 'Bring your own AI key'}
            </Text>
          </TouchableOpacity>

          {showAdvanced ? (
            <View style={styles.advancedCard}>
              <Text style={styles.cardTitle}>Bring your own AI key</Text>
              <Text style={styles.cardBody}>
                Optional. Recommended only if you know what you’re doing.
              </Text>

              <View style={styles.providerRow}>
                <TouchableOpacity
                  onPress={() => setProvider('openai')}
                  style={[
                    styles.providerPill,
                    provider === 'openai' ? styles.providerPillActive : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.providerPillText,
                      provider === 'openai' ? styles.providerPillTextActive : null,
                    ]}
                  >
                    OpenAI
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setProvider('gemini')}
                  style={[
                    styles.providerPill,
                    provider === 'gemini' ? styles.providerPillActive : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.providerPillText,
                      provider === 'gemini' ? styles.providerPillTextActive : null,
                    ]}
                  >
                    Gemini
                  </Text>
                </TouchableOpacity>
              </View>

              <TextInput
                style={styles.input}
                value={apiKeyInput}
                onChangeText={setApiKeyInput}
                placeholder={provider === 'openai' ? 'sk-…' : 'AIza…'}
                placeholderTextColor={palette.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isSavingKey}
              />

              <TouchableOpacity
                style={[
                  styles.button,
                  styles.buttonSecondary,
                  (!apiKeyInput.trim() || isSavingKey) && styles.buttonDisabled,
                ]}
                onPress={handleSaveByok}
                disabled={!apiKeyInput.trim() || isSavingKey}
                accessibilityLabel="launch-save-byok"
              >
                {isSavingKey ? (
                  <ActivityIndicator color={palette.textPrimary} />
                ) : (
                  <Text style={styles.buttonSecondaryText}>
                    Save key{state.byok?.apiKey ? ' (update)' : ''}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          ) : null}
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default LaunchScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
  },
  checkingContainer: {
    flex: 1,
    backgroundColor: palette.background,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 28,
    paddingBottom: 40,
  },
  hero: {
    marginBottom: 18,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: palette.cardSecondary,
    borderColor: palette.border,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 12,
  },
  badgeText: {
    color: palette.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  title: {
    fontSize: 34,
    fontWeight: '700',
    color: palette.textPrimary,
    letterSpacing: -0.6,
    marginBottom: 8,
  },
  subtitle: {
    color: palette.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 10,
  },
  caption: {
    color: palette.textMuted,
    fontSize: 13,
  },
  card: {
    backgroundColor: palette.card,
    borderColor: palette.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginTop: 14,
  },
  cardTitle: {
    color: palette.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  cardBody: {
    color: palette.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  primaryActions: {
    gap: 10,
  },
  button: {
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPrimary: {
    backgroundColor: palette.accent,
  },
  buttonPrimaryText: {
    color: palette.background,
    fontSize: 14,
    fontWeight: '800',
  },
  buttonSecondary: {
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.cardSecondary,
  },
  buttonSecondaryText: {
    color: palette.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  linkButton: {
    marginTop: 12,
    alignItems: 'center',
    paddingVertical: 10,
  },
  linkText: {
    color: palette.accent,
    fontSize: 14,
    fontWeight: '600',
  },
  advancedWrap: {
    marginTop: 14,
  },
  advancedToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  advancedTitle: {
    color: palette.textMuted,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  advancedLink: {
    color: palette.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  advancedCard: {
    backgroundColor: palette.card,
    borderColor: palette.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
  providerRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  providerPill: {
    flex: 1,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.cardSecondary,
    paddingVertical: 10,
    alignItems: 'center',
  },
  providerPillActive: {
    borderColor: palette.accent,
    backgroundColor: `${palette.accent}22`,
  },
  providerPillText: {
    color: palette.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  providerPillTextActive: {
    color: palette.textPrimary,
  },
  input: {
    borderColor: palette.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: palette.textPrimary,
    backgroundColor: palette.cardSecondary,
    fontSize: 14,
    marginBottom: 12,
  },
  errorBox: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.accentMuted,
    padding: 12,
  },
  errorText: {
    color: palette.textPrimary,
    fontSize: 13,
    lineHeight: 18,
  },
});
