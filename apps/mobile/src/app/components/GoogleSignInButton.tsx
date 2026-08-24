import React, { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './DesignSystem';
import {
  fetchServerCapabilities,
  signInWithGoogle,
} from '../services/auth-client';
import { palette } from '../theme';

type GoogleSignInButtonProps = {
  onSuccess: () => void;
  onError: (message: string) => void;
  disabled?: boolean;
  label?: string;
};

/**
 * Google OAuth entry point shared by onboarding, sign-in, and account settings.
 * Availability follows the validated live/last-known capability response, or
 * the app's bundled managed-service defaults during an offline cold start.
 */
export const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({
  onSuccess,
  onError,
  disabled = false,
  label = 'Continue with Google',
}) => {
  const [isAvailable, setIsAvailable] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void fetchServerCapabilities().then((meta) => {
      if (!cancelled) {
        setIsAvailable(meta?.auth.googleAvailable ?? false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!isAvailable) {
    return null;
  }

  const handlePress = async () => {
    setIsLoading(true);
    try {
      const result = await signInWithGoogle();
      if (result.ok) {
        onSuccess();
      } else {
        onError(result.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      label={label}
      onPress={() => void handlePress()}
      loading={isLoading}
      disabled={disabled}
      variant="outline"
      icon={
        <Ionicons name="logo-google" size={18} color={palette.textPrimary} />
      }
      accessibilityLabel={label}
    />
  );
};
