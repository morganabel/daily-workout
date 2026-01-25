import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ViewStyle,
  ActivityIndicator,
  PressableProps,
} from 'react-native';
import { palette, typography, layout } from '../theme';

// --- Card ---

type CardProps = {
  children: React.ReactNode;
  style?: ViewStyle;
  variant?: 'default' | 'flat';
};

export const Card = ({ children, style, variant = 'default' }: CardProps) => (
  <View
    style={[
      styles.card,
      variant === 'flat' && styles.cardFlat,
      style,
    ]}
  >
    {children}
  </View>
);

// --- Buttons ---

type ButtonProps = PressableProps & {
  label: string;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  icon?: React.ReactNode;
  accessibilityLabel?: string;
  accessibilityHint?: string;
};

export const Button = ({
  label,
  loading,
  variant = 'primary',
  disabled,
  style,
  icon,
  accessibilityLabel,
  accessibilityHint,
  ...props
}: ButtonProps) => {
  const getButtonStyle = ({ pressed }: { pressed: boolean }) => [
    styles.button,
    variant === 'primary' && styles.buttonPrimary,
    variant === 'secondary' && styles.buttonSecondary,
    variant === 'outline' && styles.buttonOutline,
    variant === 'ghost' && styles.buttonGhost,
    variant === 'destructive' && styles.buttonDestructive,
    pressed && styles.buttonPressed,
    (disabled || loading) && styles.buttonDisabled,
    style as ViewStyle,
  ];

  const getTextStyle = () => [
    styles.buttonText,
    variant === 'primary' && styles.buttonTextPrimary,
    variant === 'secondary' && styles.buttonTextSecondary,
    variant === 'outline' && styles.buttonTextOutline,
    variant === 'ghost' && styles.buttonTextGhost,
    variant === 'destructive' && styles.buttonTextDestructive,
  ];

  return (
    <Pressable
      style={getButtonStyle}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: disabled || loading }}
      {...props}
    >
      <View style={styles.buttonContent}>
        {loading ? (
          <ActivityIndicator
            color={variant === 'primary' ? 'white' : palette.textPrimary}
            style={{ marginRight: 8 }}
          />
        ) : (
          icon
        )}
        <Text style={getTextStyle()}>{label}</Text>
      </View>
    </Pressable>
  );
};

// --- Chip ---

type ChipProps = PressableProps & {
  label: string;
  selected?: boolean;
  icon?: React.ReactNode;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  /** Use 'checkbox' for multi-select, 'radio' for single-select */
  role?: 'checkbox' | 'radio' | 'button';
};

export const Chip = ({
  label,
  selected,
  icon,
  style,
  accessibilityLabel,
  accessibilityHint,
  role = 'checkbox',
  ...props
}: ChipProps) => (
  <Pressable
    style={({ pressed }) => [
      styles.chip,
      selected && styles.chipSelected,
      pressed && styles.chipPressed,
      style as ViewStyle,
    ]}
    accessibilityRole={role}
    accessibilityLabel={accessibilityLabel || label}
    accessibilityHint={accessibilityHint}
    accessibilityState={role === 'checkbox' ? { checked: selected } : { selected }}
    {...props}
  >
    {icon}
    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
      {label}
    </Text>
  </Pressable>
);

// --- Typography ---

export const SectionHeader = ({
  title,
  action,
}: {
  title: string;
  action?: React.ReactNode;
}) => (
  <View style={styles.sectionHeader}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {action}
  </View>
);

export const ScreenTitle = ({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) => (
  <View style={styles.screenHeader}>
    <Text style={styles.screenTitle}>{title}</Text>
    {subtitle && <Text style={styles.screenSubtitle}>{subtitle}</Text>}
  </View>
);

// --- Styles ---

const styles = StyleSheet.create({
  // Card
  card: {
    backgroundColor: palette.card,
    borderRadius: layout.borderRadius,
    padding: layout.padding,
    shadowColor: palette.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 2,
    borderWidth: 1,
    borderColor: palette.border,
  },
  cardFlat: {
    shadowOpacity: 0,
    elevation: 0,
    backgroundColor: palette.cardSecondary,
    borderWidth: 0,
  },

  // Button
  button: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  buttonPrimary: {
    backgroundColor: palette.primary,
    shadowColor: palette.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonSecondary: {
    backgroundColor: palette.cardSecondary,
    borderWidth: 1,
    borderColor: palette.border,
  },
  buttonOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: palette.border,
  },
  buttonGhost: {
    backgroundColor: 'transparent',
  },
  buttonDestructive: {
    backgroundColor: palette.destructiveBg,
  },
  buttonPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
  buttonDisabled: {
    opacity: 0.5,
  },

  // Button Text
  buttonText: {
    fontFamily: typography.fontFamilyBold,
    fontSize: 16,
    textAlign: 'center',
  },
  buttonTextPrimary: {
    color: palette.textInverse,
  },
  buttonTextSecondary: {
    color: palette.textPrimary,
  },
  buttonTextOutline: {
    color: palette.textSecondary,
  },
  buttonTextGhost: {
    color: palette.textSecondary,
  },
  buttonTextDestructive: {
    color: palette.destructive,
  },

  // Chip
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.border,
    gap: 6,
  },
  chipSelected: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
  },
  chipPressed: {
    opacity: 0.8,
  },
  chipText: {
    fontFamily: typography.fontFamilyBold,
    fontSize: 13,
    color: palette.textSecondary,
  },
  chipTextSelected: {
    color: palette.textInverse,
  },

  // Headers
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: typography.fontFamilyBold,
    fontSize: 13,
    color: palette.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  screenHeader: {
    marginBottom: 20,
  },
  screenTitle: {
    fontFamily: typography.fontFamilyExtraBold,
    fontSize: 28,
    color: palette.textPrimary,
  },
  screenSubtitle: {
    fontFamily: typography.fontFamily,
    fontSize: 15,
    color: palette.textSecondary,
    marginTop: 4,
  },
});
