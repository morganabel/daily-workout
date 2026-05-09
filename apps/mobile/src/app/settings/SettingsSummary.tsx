import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { AdaptiveTargetRange, UserPreferences } from '@workout-agent/shared';
import { Card } from '../components/DesignSystem';
import { palette } from '../theme';
import { styles } from './settingsStyles';
import type { EditorKey } from './settingsTypes';
import { EXPERIENCE_LABELS } from './settingsTypes';
import {
  formatTargetFrequency,
  getUsuallyLine,
  summarizeEquipment,
  summarizeEquipmentDetail,
} from './settingsHelpers';

type SummaryPillProps = {
  label: string;
  tone?: 'neutral' | 'primary' | 'warning';
};

const SummaryPill = ({ label, tone = 'neutral' }: SummaryPillProps) => (
  <View
    style={[
      styles.summaryPill,
      tone === 'primary' && styles.summaryPillPrimary,
      tone === 'warning' && styles.summaryPillWarning,
    ]}
  >
    <Text
      style={[
        styles.summaryPillText,
        tone === 'primary' && styles.summaryPillTextPrimary,
        tone === 'warning' && styles.summaryPillTextWarning,
      ]}
    >
      {label}
    </Text>
  </View>
);

type SummaryCardProps = {
  title: string;
  eyebrow?: string;
  icon: keyof typeof Ionicons.glyphMap;
  actionLabel: string;
  onAction: () => void;
  children: React.ReactNode;
  tone?: 'primary' | 'warning';
};

const SummaryCard = ({
  title,
  eyebrow,
  icon,
  actionLabel,
  onAction,
  children,
  tone = 'primary',
}: SummaryCardProps) => (
  <Card style={styles.summaryCard}>
    <View style={styles.summaryHeader}>
      <View style={styles.summaryTitleRow}>
        <View
          style={[
            styles.summaryIcon,
            tone === 'warning' && styles.summaryIconWarning,
          ]}
        >
          <Ionicons
            name={icon}
            size={18}
            color={tone === 'warning' ? palette.warning : palette.primary}
          />
        </View>
        <View style={styles.summaryTitleGroup}>
          <Text style={styles.summaryTitle}>{title}</Text>
          {eyebrow && <Text style={styles.summaryEyebrow}>{eyebrow}</Text>}
        </View>
      </View>
    </View>
    {children}
    <Pressable
      style={styles.cardAction}
      onPress={onAction}
      accessibilityRole="button"
      accessibilityLabel={actionLabel}
    >
      <Text style={styles.cardActionText}>{actionLabel}</Text>
      <Ionicons name="chevron-forward" size={18} color={palette.primary} />
    </Pressable>
  </Card>
);

export type SettingsSummaryProps = {
  preferences: UserPreferences;
  trainingTargets: AdaptiveTargetRange[];
  constraintItems: string[];
  onOpenEditor: (editor: EditorKey) => void;
};

export const SettingsSummary = ({
  preferences,
  trainingTargets,
  constraintItems,
  onOpenEditor,
}: SettingsSummaryProps) => {
  const hasSafetyNotes = constraintItems.length > 0;

  return (
    <>
      <SummaryCard
        title="Coach profile"
        eyebrow="Used for recommendations"
        icon="person-circle-outline"
        actionLabel="Edit profile"
        onAction={() => onOpenEditor('profile')}
      >
        <View style={styles.pillWrap}>
          <SummaryPill
            label={
              preferences.experienceLevel
                ? EXPERIENCE_LABELS[preferences.experienceLevel]
                : 'Experience not set'
            }
            tone="primary"
          />
          <SummaryPill
            label={`Goal: ${preferences.primaryGoal || 'Not set'}`}
          />
          <SummaryPill
            label={`Equipment: ${summarizeEquipment(preferences.equipment)}`}
          />
          <SummaryPill
            label={`Style: ${preferences.preferredStyle || 'Flexible'}`}
          />
        </View>
      </SummaryCard>

      <SummaryCard
        title="Training rhythm"
        eyebrow="Flexible, not a fixed calendar"
        icon="pulse-outline"
        actionLabel="Adjust rhythm"
        onAction={() => onOpenEditor('rhythm')}
      >
        {trainingTargets.length > 0 ? (
          <View style={styles.summaryRows}>
            {trainingTargets.map((target) => (
              <View key={target.id} style={styles.summaryRow}>
                <Text style={styles.summaryRowText}>
                  {formatTargetFrequency(target)}
                </Text>
              </View>
            ))}
            <Text style={styles.usuallyText}>
              {getUsuallyLine(preferences.adaptiveTrainingPlan)}
            </Text>
          </View>
        ) : (
          <Text style={styles.summaryBody}>
            Your coach will learn a rhythm after setup.
          </Text>
        )}
        <Text style={styles.coachNote}>
          Your coach can adapt this when life changes.
        </Text>
      </SummaryCard>

      <SummaryCard
        title="Safety & constraints"
        eyebrow="Kept visible for safer workouts"
        icon="shield-checkmark-outline"
        actionLabel="Update constraints"
        onAction={() => onOpenEditor('constraints')}
        tone="warning"
      >
        {hasSafetyNotes ? (
          <View style={styles.pillWrap}>
            {constraintItems.slice(0, 4).map((item) => (
              <SummaryPill key={item} label={item} tone="warning" />
            ))}
          </View>
        ) : (
          <Text style={styles.summaryBody}>No constraints added.</Text>
        )}
      </SummaryCard>

      <SummaryCard
        title="Equipment"
        eyebrow="Available training setup"
        icon="barbell-outline"
        actionLabel="Edit equipment"
        onAction={() => onOpenEditor('equipment')}
      >
        <Text style={styles.equipmentSummary}>
          {summarizeEquipment(preferences.equipment)}
        </Text>
        <Text style={styles.summaryBody}>
          {summarizeEquipmentDetail(preferences.equipment)}
        </Text>
      </SummaryCard>
    </>
  );
};
