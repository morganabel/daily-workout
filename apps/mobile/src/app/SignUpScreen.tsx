/**
 * Sign Up Screen
 *
 * Registration form for users upgrading from anonymous accounts.
 * When upgrading, the existing userId is preserved for billing/metering continuity.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from './navigation';
import { authClient } from './services/auth-client';
import { palette, typography } from './theme';
import { Button } from './components/DesignSystem';
import { GoogleSignInButton } from './components/GoogleSignInButton';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export const SignUpScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSignUp = async () => {
    // Validate inputs
    if (!email.trim() || !password.trim()) {
      setError('Please enter email and password');
      return;
    }

    if (!validateEmail(email.trim())) {
      setError('Please enter a valid email address');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const trimmedEmail = email.trim();
      const trimmedName = name.trim();
      const result = await authClient.signUp.email({
        email: trimmedEmail,
        password,
        name: trimmedName || trimmedEmail.split('@')[0] || trimmedEmail,
      });

      if (result.error) {
        if (result.error.message?.includes('already')) {
          setError('An account with this email already exists');
        } else {
          setError('Registration failed. Please try again.');
        }
        return;
      }

      // New accounts should choose or skip a starter plan before Home.
      navigation.navigate('Onboarding');
    } catch {
      setError('Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoToSignIn = () => {
    navigation.navigate('SignIn' as never);
  };

  const handleSkip = () => {
    navigation.goBack();
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>
            Sign up to sync your workouts and access premium features
          </Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Name (optional)</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor={palette.textMuted}
              autoCapitalize="words"
              autoCorrect={false}
              editable={!isLoading}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="your@email.com"
              placeholderTextColor={palette.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isLoading}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="At least 8 characters"
              placeholderTextColor={palette.textMuted}
              secureTextEntry
              editable={!isLoading}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Confirm Password</Text>
            <TextInput
              style={styles.input}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="••••••••"
              placeholderTextColor={palette.textMuted}
              secureTextEntry
              editable={!isLoading}
            />
          </View>

          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <Button
            label="Create Account"
            onPress={handleSignUp}
            loading={isLoading}
            variant="primary"
          />

          <GoogleSignInButton
            disabled={isLoading}
            onSuccess={() => navigation.navigate('Onboarding')}
            onError={setError}
          />

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account?</Text>
            <TouchableOpacity onPress={handleGoToSignIn} disabled={isLoading}>
              <Text style={styles.linkText}>Sign In</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.skipButton}
            onPress={handleSkip}
            disabled={isLoading}
          >
            <Text style={styles.skipText}>Continue without signing up</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    color: palette.textPrimary,
    marginBottom: 8,
    fontFamily: typography.fontFamilyExtraBold,
  },
  subtitle: {
    fontSize: 16,
    color: palette.textSecondary,
    lineHeight: 24,
    fontFamily: typography.fontFamily,
  },
  form: {
    gap: 16,
  },
  inputContainer: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    color: palette.textPrimary,
    fontFamily: typography.fontFamilyBold,
  },
  input: {
    backgroundColor: palette.cardSecondary,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: palette.textPrimary,
    borderWidth: 1,
    borderColor: palette.border,
    fontFamily: typography.fontFamily,
  },
  errorContainer: {
    backgroundColor: palette.destructiveBg,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.destructive,
  },
  errorText: {
    color: palette.destructive,
    fontSize: 14,
    textAlign: 'center',
    fontFamily: typography.fontFamily,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    marginTop: 16,
  },
  footerText: {
    color: palette.textSecondary,
    fontSize: 14,
    fontFamily: typography.fontFamily,
  },
  linkText: {
    color: palette.primary,
    fontSize: 14,
    fontFamily: typography.fontFamilyBold,
  },
  skipButton: {
    alignItems: 'center',
    marginTop: 24,
  },
  skipText: {
    color: palette.textMuted,
    fontSize: 14,
    fontFamily: typography.fontFamily,
  },
});

export default SignUpScreen;
