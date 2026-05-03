import React, { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  createTrainingBlueprintFromOnboarding,
  EQUIPMENT_OPTIONS,
  GYM_EQUIPMENT,
  normalizeEquipmentSelection,
  TRAINING_TEMPLATE_DEFINITIONS,
  type ExperienceLevel,
  type OnboardingGoal,
  type TrainingEnvironment,
} from '@workout-agent/shared';

import type { RootStackParamList } from './navigation';
import { Button, Chip } from './components/DesignSystem';
import { userRepository } from './db/repositories/UserRepository';
import { createStarterWeekSlots } from './services/starterWeekSlots';
import { palette, typography, layout } from './theme';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Onboarding'>;

const GOALS: Array<{ value: OnboardingGoal; label: string; description: string }> = [
  {
    value: 'general-fitness',
    label: 'General fitness',
    description: 'Feel better, move often, build consistency.',
  },
  {
    value: 'build-muscle',
    label: 'Build muscle',
    description: 'More hypertrophy, volume, and gym structure.',
  },
  {
    value: 'build-strength',
    label: 'Build strength',
    description: 'Progressive strength with simple recovery spacing.',
  },
  {
    value: 'lose-fat',
    label: 'Lose fat',
    description: 'A balanced rhythm with conditioning support.',
  },
  {
    value: 'run-cardio',
    label: 'Run/cardio',
    description: 'Cardio-first training with strength support.',
  },
  {
    value: 'mobility',
    label: 'Mobility',
    description: 'Short, low-friction movement and recovery.',
  },
];

const EXPERIENCE_LEVELS: Array<{
  value: ExperienceLevel;
  label: string;
  description: string;
}> = [
  {
    value: 'beginner',
    label: 'Beginner',
    description: 'New, rebuilding, or keeping things intentionally simple.',
  },
  {
    value: 'intermediate',
    label: 'Intermediate',
    description: 'Consistent training and ready for more structure.',
  },
  {
    value: 'advanced',
    label: 'Advanced',
    description: 'Experienced enough to manage hard days and recovery.',
  },
];

const ENVIRONMENTS: Array<{
  value: TrainingEnvironment;
  label: string;
  description: string;
}> = [
  { value: 'home', label: 'Home', description: 'Minimal setup nearby.' },
  { value: 'gym', label: 'Gym', description: 'Machines, racks, and weights.' },
  { value: 'outdoors', label: 'Outdoors', description: 'Runs, hills, parks, or tracks.' },
  { value: 'travel', label: 'Travel', description: 'Hotel-room friendly defaults.' },
];

const getDefaultEquipment = (environment: TrainingEnvironment): string[] => {
  if (environment === 'gym') return [GYM_EQUIPMENT];
  if (environment === 'travel') return ['Bodyweight'];
  return [];
};

export const OnboardingScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState<OnboardingGoal | null>(null);
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel | null>(
    null
  );
  const [environment, setEnvironment] = useState<TrainingEnvironment | null>(null);
  const [equipment, setEquipment] = useState<string[]>([]);
  const [showAdjustPath, setShowAdjustPath] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const answers = useMemo(() => {
    if (!goal || !experienceLevel || !environment) return null;
    return {
      goal,
      experienceLevel,
      environment,
      equipment: normalizeEquipmentSelection(equipment, getDefaultEquipment(environment)),
    };
  }, [environment, equipment, experienceLevel, goal]);

  const blueprint = useMemo(
    () => (answers ? createTrainingBlueprintFromOnboarding(answers) : null),
    [answers]
  );
  const template = blueprint
    ? TRAINING_TEMPLATE_DEFINITIONS[blueprint.templateId]
    : null;

  const goHome = () => {
    navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
  };

  const handleEnvironmentSelect = (next: TrainingEnvironment) => {
    setEnvironment(next);
    setEquipment((current) =>
      current.length > 0 ? current : getDefaultEquipment(next)
    );
  };

  const toggleEquipment = (item: string) => {
    setEquipment((current) => {
      if (item === GYM_EQUIPMENT) {
        return current.includes(GYM_EQUIPMENT) ? [] : [GYM_EQUIPMENT];
      }

      const updated = current.includes(item)
        ? current.filter((selected) => selected !== item)
        : [...current.filter((selected) => selected !== GYM_EQUIPMENT), item];
      return normalizeEquipmentSelection(updated);
    });
  };

  const handleSkip = async () => {
    await userRepository.skipTrainingBlueprintSetup();
    goHome();
  };

  const saveBlueprintAndSlots = async (editStatus: 'accepted' | 'adjusted') => {
    if (!answers) return;
    setIsSaving(true);
    try {
      const nextBlueprint = createTrainingBlueprintFromOnboarding(answers, {
        editStatus,
        updatedAt: new Date().toISOString(),
      });
      await userRepository.saveTrainingBlueprint(nextBlueprint);
      await createStarterWeekSlots(nextBlueprint);
      if (editStatus === 'adjusted') {
        navigation.reset({ index: 0, routes: [{ name: 'Settings' }] });
      } else {
        goHome();
      }
    } catch (error) {
      console.error('Failed to save onboarding plan', error);
      Alert.alert('Could not save plan', 'Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleContinue = () => {
    if (step < 2) {
      setStep((current) => current + 1);
      return;
    }
    setStep(3);
  };

  const canContinue =
    (step === 0 && Boolean(goal)) ||
    (step === 1 && Boolean(experienceLevel)) ||
    (step === 2 && Boolean(environment));

  const progressLabel = step < 3 ? `Step ${step + 1} of 3` : 'Recommended week';

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>{progressLabel}</Text>
          <Text style={styles.title}>Build a starter rhythm in under a minute.</Text>
          <Text style={styles.subtitle}>
            Answer three questions. We will suggest a week you can accept,
            adjust, or skip.
          </Text>
        </View>

        {step === 0 && (
          <View style={styles.section}>
            <Text style={styles.question}>What are you training for?</Text>
            {GOALS.map((item) => (
              <OptionCard
                key={item.value}
                label={item.label}
                description={item.description}
                selected={goal === item.value}
                onPress={() => setGoal(item.value)}
              />
            ))}
          </View>
        )}

        {step === 1 && (
          <View style={styles.section}>
            <Text style={styles.question}>What is your experience level?</Text>
            {EXPERIENCE_LEVELS.map((item) => (
              <OptionCard
                key={item.value}
                label={item.label}
                description={item.description}
                selected={experienceLevel === item.value}
                onPress={() => setExperienceLevel(item.value)}
              />
            ))}
          </View>
        )}

        {step === 2 && (
          <View style={styles.section}>
            <Text style={styles.question}>Where do you usually train?</Text>
            {ENVIRONMENTS.map((item) => (
              <OptionCard
                key={item.value}
                label={item.label}
                description={item.description}
                selected={environment === item.value}
                onPress={() => handleEnvironmentSelect(item.value)}
              />
            ))}
            <Text style={styles.equipmentTitle}>Equipment available</Text>
            <View style={styles.chipWrap}>
              {EQUIPMENT_OPTIONS.map((item) => (
                <Chip
                  key={item}
                  label={item}
                  selected={equipment.includes(item)}
                  onPress={() => toggleEquipment(item)}
                />
              ))}
            </View>
          </View>
        )}

        {step === 3 && template && blueprint && (
          <View style={styles.section}>
            <View style={styles.recommendationCard}>
              <Text style={styles.recommendationKicker}>Recommended starter</Text>
              <Text style={styles.recommendationTitle}>{template.name}</Text>
              <Text style={styles.recommendationSummary}>{template.summary}</Text>
              <View style={styles.rhythmPill}>
                <Text style={styles.rhythmText}>{template.weeklyRhythm}</Text>
              </View>
            </View>

            <View style={styles.weekGrid}>
              {blueprint.slotSequence.map((slot) => (
                <View key={slot.id} style={styles.dayCard}>
                  <Text style={styles.dayLabel}>Day {slot.dayOffset + 1}</Text>
                  <Text style={styles.slotLabel}>{slot.label}</Text>
                  <Text style={styles.slotMeta}>{slot.targetDurationMinutes} min</Text>
                </View>
              ))}
            </View>

            {showAdjustPath && (
              <View style={styles.adjustCard}>
                <Text style={styles.adjustTitle}>Adjust after saving</Text>
                <Text style={styles.adjustText}>
                  We will save this recommendation, create the starter slots, and
                  open Plan Settings so you can fine-tune template, rhythm,
                  duration, equipment, and slots.
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        {step < 3 ? (
          <Button label="Continue" onPress={handleContinue} disabled={!canContinue} />
        ) : (
          <>
            <Button
              label={showAdjustPath ? 'Save and open Plan Settings' : 'Use this plan'}
              onPress={() => saveBlueprintAndSlots(showAdjustPath ? 'adjusted' : 'accepted')}
              loading={isSaving}
            />
            <Button
              label="Adjust"
              variant="secondary"
              onPress={() => setShowAdjustPath(true)}
              disabled={isSaving || showAdjustPath}
            />
          </>
        )}
        <Button label="Skip" variant="ghost" onPress={handleSkip} disabled={isSaving} />
      </View>
    </View>
  );
};

const OptionCard = ({
  label,
  description,
  selected,
  onPress,
}: {
  label: string;
  description: string;
  selected: boolean;
  onPress: () => void;
}) => (
  <Pressable
    style={[styles.optionCard, selected && styles.optionCardSelected]}
    onPress={onPress}
    accessibilityRole="radio"
    accessibilityLabel={label}
    accessibilityState={{ selected }}
  >
    <View style={[styles.radio, selected && styles.radioSelected]} />
    <View style={styles.optionCopy}>
      <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>
        {label}
      </Text>
      <Text style={styles.optionDescription}>{description}</Text>
    </View>
  </Pressable>
);

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.background,
  },
  content: {
    padding: layout.padding,
    paddingBottom: 190,
  },
  hero: {
    backgroundColor: palette.card,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 24,
    marginBottom: 20,
  },
  eyebrow: {
    fontFamily: typography.fontFamilyBold,
    color: palette.primaryDark,
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  title: {
    fontFamily: typography.fontFamilyExtraBold,
    color: palette.textPrimary,
    fontSize: 31,
    lineHeight: 37,
    letterSpacing: -0.8,
  },
  subtitle: {
    fontFamily: typography.fontFamily,
    color: palette.textSecondary,
    fontSize: 16,
    lineHeight: 24,
    marginTop: 12,
  },
  section: {
    gap: 12,
  },
  question: {
    fontFamily: typography.fontFamilyBold,
    color: palette.textPrimary,
    fontSize: 20,
    marginBottom: 4,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: palette.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 18,
  },
  optionCardSelected: {
    borderColor: palette.primary,
    backgroundColor: '#ECFEFF',
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: palette.borderDark,
  },
  radioSelected: {
    borderColor: palette.primary,
    backgroundColor: palette.primary,
  },
  optionCopy: {
    flex: 1,
  },
  optionLabel: {
    fontFamily: typography.fontFamilyBold,
    color: palette.textPrimary,
    fontSize: 17,
  },
  optionLabelSelected: {
    color: palette.primaryDark,
  },
  optionDescription: {
    fontFamily: typography.fontFamily,
    color: palette.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  equipmentTitle: {
    fontFamily: typography.fontFamilyBold,
    color: palette.textPrimary,
    fontSize: 16,
    marginTop: 12,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  recommendationCard: {
    backgroundColor: palette.textPrimary,
    borderRadius: 28,
    padding: 24,
  },
  recommendationKicker: {
    fontFamily: typography.fontFamilyBold,
    color: '#BAE6FD',
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  recommendationTitle: {
    fontFamily: typography.fontFamilyExtraBold,
    color: palette.textInverse,
    fontSize: 28,
    marginTop: 8,
  },
  recommendationSummary: {
    fontFamily: typography.fontFamily,
    color: '#CBD5E1',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
  },
  rhythmPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(14, 165, 233, 0.18)',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: 16,
  },
  rhythmText: {
    fontFamily: typography.fontFamilyBold,
    color: '#E0F2FE',
    fontSize: 13,
  },
  weekGrid: {
    gap: 10,
  },
  dayCard: {
    backgroundColor: palette.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 16,
  },
  dayLabel: {
    fontFamily: typography.fontFamilyBold,
    color: palette.textMuted,
    fontSize: 12,
    textTransform: 'uppercase',
  },
  slotLabel: {
    fontFamily: typography.fontFamilyBold,
    color: palette.textPrimary,
    fontSize: 17,
    marginTop: 4,
  },
  slotMeta: {
    fontFamily: typography.fontFamily,
    color: palette.textSecondary,
    fontSize: 14,
    marginTop: 2,
  },
  adjustCard: {
    backgroundColor: palette.warningBg,
    borderRadius: 18,
    padding: 16,
  },
  adjustTitle: {
    fontFamily: typography.fontFamilyBold,
    color: palette.textPrimary,
    fontSize: 16,
  },
  adjustText: {
    fontFamily: typography.fontFamily,
    color: palette.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    gap: 10,
    padding: layout.padding,
    paddingBottom: 28,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    backgroundColor: palette.backgroundTranslucent,
  },
});

export default OnboardingScreen;
