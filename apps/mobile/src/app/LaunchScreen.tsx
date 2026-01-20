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
import { palette, typography, layout } from './theme';
import { Button, Card } from './components/DesignSystem';

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

        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Get started</Text>
          <Text style={styles.cardBody}>
            Explore first, then decide if you want to sign up.
          </Text>

          <View style={styles.primaryActions}>
            <Button
              label="Explore"
              onPress={handleExplore}
              loading={isExploring}
              variant="primary"
            />

            {shouldShowAccountActions ? (
              <Button
                label="Create account"
                onPress={handleSignUp}
                disabled={isExploring}
                variant="secondary"
              />
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
        </Card>

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
            <Card style={styles.advancedCard}>
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

              <Button
                label={`Save key${state.byok?.apiKey ? ' (update)' : ''}`}
                onPress={handleSaveByok}
                disabled={!apiKeyInput.trim() || isSavingKey}
                loading={isSavingKey}
                variant="secondary"
              />
            </Card>
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
    paddingTop: 60,
    paddingBottom: 40,
  },
  hero: {
    marginBottom: 24,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: palette.card,
    borderColor: palette.border,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 16,
  },
  badgeText: {
    color: palette.textSecondary,
    fontSize: 13,
    fontFamily: typography.fontFamilyBold,
  },
  title: {
    fontSize: 34,
    fontFamily: typography.fontFamilyExtraBold,
    color: palette.textPrimary,
    letterSpacing: -0.6,
    marginBottom: 12,
  },
  subtitle: {
    color: palette.textSecondary,
    fontSize: 16,
    lineHeight: 24,
    fontFamily: typography.fontFamily,
  },
  caption: {
    color: palette.textMuted,
    fontSize: 13,
    fontFamily: typography.fontFamily,
    marginTop: 12,
  },
  card: {
    marginBottom: 24,
  },
  cardTitle: {
    color: palette.textPrimary,
    fontSize: 18,
    fontFamily: typography.fontFamilyBold,
    marginBottom: 8,
  },
  cardBody: {
    color: palette.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: typography.fontFamily,
    marginBottom: 20,
  },
  primaryActions: {
    gap: 12,
  },
  linkButton: {
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 8,
  },
  linkText: {
    color: palette.primary,
    fontSize: 14,
    fontFamily: typography.fontFamilyBold,
  },
  advancedWrap: {
    marginTop: 8,
  },
  advancedToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  advancedTitle: {
    color: palette.textMuted,
    fontSize: 13,
    fontFamily: typography.fontFamilyBold,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  advancedLink: {
    color: palette.textSecondary,
    fontSize: 14,
    fontFamily: typography.fontFamilyBold,
  },
  advancedCard: {
    marginTop: 8,
  },
  providerRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
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
    borderColor: palette.primary,
    backgroundColor: `${palette.primary}22`,
  },
  providerPillText: {
    color: palette.textSecondary,
    fontSize: 14,
    fontFamily: typography.fontFamilyBold,
  },
  providerPillTextActive: {
    color: palette.primary,
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
    fontFamily: typography.fontFamily,
    marginBottom: 16,
  },
  errorBox: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.destructive,
    backgroundColor: palette.destructiveBg,
    padding: 12,
  },
  errorText: {
    color: palette.destructive,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: typography.fontFamily,
  },
});
