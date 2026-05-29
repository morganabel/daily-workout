import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Button, Card } from './components/DesignSystem';
import { RootStackParamList } from './navigation';
import { useBillingState } from './hooks/useBillingState';
import { palette, typography } from './theme';

type PaywallNavigation = NativeStackNavigationProp<
  RootStackParamList,
  'Paywall'
>;

const REQUIRED_ENTITLEMENT = 'OpenLift Pro';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const PaywallScreen = () => {
  const navigation = useNavigation<PaywallNavigation>();
  const {
    capabilities,
    client,
    clientReady,
    showUpgradeUi,
    entitlements,
    loading,
    refreshing,
    error,
    refreshEntitlements,
  } = useBillingState();

  const [processing, setProcessing] = useState<
    'purchase' | 'restore' | 'sync' | null
  >(null);

  const planLabel = useMemo(() => {
    if (!entitlements) {
      return 'Free';
    }
    return entitlements.planId === 'pro' ? 'OpenLift Pro' : 'Free';
  }, [entitlements]);

  const remainingLabel = useMemo(() => {
    if (!entitlements) {
      return null;
    }

    return `${entitlements.quotaWindow.remaining}/${entitlements.quotaWindow.limit} generated workouts left this period`;
  }, [entitlements]);

  const introCopy = useMemo(() => {
    if (entitlements?.planId === 'pro') {
      return 'You are on Pro. You can review plans, restore a purchase, or manage your subscription here.';
    }

    if (entitlements?.quotaWindow.remaining === 0) {
      return capabilities.allowByok
        ? 'You have used the generated workouts included in this period. Upgrade for more, or keep going with your own AI key.'
        : 'You have used the generated workouts included in this period. Upgrade for more.';
    }

    return capabilities.allowByok
      ? 'Get more generated workouts with OpenLift Pro. If you prefer, you can still use your own AI key.'
      : 'Get more generated workouts with a plan that fits your routine.';
  }, [capabilities.allowByok, entitlements]);

  const upgradeDetails = useMemo(() => {
    const details = [
      'Choose the plan that fits your routine in the next step.',
      'Restore a previous purchase anytime.',
    ];

    if (capabilities.allowByok) {
      details.push('Your own AI key always remains an option.');
    }

    return details;
  }, [capabilities.allowByok]);

  const handleSyncAfterPurchase = useCallback(async () => {
    setProcessing('sync');

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const latest = await refreshEntitlements();
      if (latest?.status === 'active' && latest.planId === 'pro') {
        Alert.alert('You are all set', 'OpenLift Pro is ready to use.');
        navigation.goBack();
        setProcessing(null);
        return;
      }

      await delay(900);
    }

    Alert.alert(
      'Almost there',
      'Your purchase is still being confirmed. Check back in a moment and your plan should update.'
    );
    setProcessing(null);
  }, [navigation, refreshEntitlements]);

  const handlePurchase = useCallback(async () => {
    if (!clientReady) {
      Alert.alert(
        'Just a moment',
        'Plans are still loading. Please try again in a moment.'
      );
      return;
    }

    try {
      setProcessing('purchase');
      const result = await client.presentPaywall(REQUIRED_ENTITLEMENT);
      if (result === 'purchased' || result === 'restored') {
        await handleSyncAfterPurchase();
        return;
      }

      if (result === 'cancelled') {
        return;
      }

      Alert.alert(
        'Something went wrong',
        'We could not open plans right now. Please try again shortly.'
      );
    } catch (purchaseError) {
      Alert.alert(
        'Something went wrong',
        purchaseError instanceof Error
          ? purchaseError.message
          : 'Unable to start the upgrade flow.'
      );
    } finally {
      setProcessing(null);
    }
  }, [client, clientReady, handleSyncAfterPurchase]);

  const handleRestore = async () => {
    if (!clientReady) {
      return;
    }

    try {
      setProcessing('restore');
      await client.restorePurchases();
      await handleSyncAfterPurchase();
    } catch (restoreError) {
      Alert.alert(
        'Could not restore your purchase',
        restoreError instanceof Error
          ? restoreError.message
          : 'Please try again in a moment.'
      );
    } finally {
      setProcessing(null);
    }
  };

  const handleCustomerCenter = async () => {
    try {
      await client.presentCustomerCenter();
    } catch (customerCenterError) {
      Alert.alert(
        'Subscription unavailable',
        customerCenterError instanceof Error
          ? customerCenterError.message
          : 'Subscription settings are unavailable right now. Please try again later.'
      );
    }
  };

  if (!showUpgradeUi) {
    return (
      <View style={styles.screen}>
        <Card>
          <Text style={styles.title}>
            Upgrade options are not available here
          </Text>
          <Text style={styles.subtitle}>
            This server does not offer in-app upgrades. You can still use your
            own AI key from Advanced settings.
          </Text>
          <Button label="Back" onPress={() => navigation.goBack()} />
        </Card>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={undefined}
      >
        <Text style={styles.header}>Keep your momentum going</Text>
        <Text style={styles.subheader}>{introCopy}</Text>

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Your plan</Text>
          <Text style={styles.planLabel}>{planLabel}</Text>
          {remainingLabel ? (
            <Text style={styles.remainingLabel}>{remainingLabel}</Text>
          ) : null}
        </Card>

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>How it works</Text>
          {upgradeDetails.map((detail) => (
            <Text key={detail} style={styles.productItem}>
              - {detail}
            </Text>
          ))}
        </Card>

        {(loading || refreshing || processing === 'sync') && (
          <View style={styles.processingRow}>
            <ActivityIndicator color={palette.primary} />
            <Text style={styles.processingText}>Refreshing your access...</Text>
          </View>
        )}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Button
          label={processing === 'purchase' ? 'Loading plans...' : 'View plans'}
          onPress={handlePurchase}
          loading={processing === 'purchase'}
          disabled={!clientReady || processing !== null}
          style={styles.buttonSpacing}
        />
        <Button
          label={
            processing === 'restore' ? 'Restoring...' : 'Restore purchases'
          }
          onPress={handleRestore}
          loading={processing === 'restore'}
          disabled={!clientReady || processing !== null}
          variant="secondary"
          style={styles.buttonSpacing}
        />
        <Button
          label="Subscription"
          onPress={handleCustomerCenter}
          disabled={!clientReady || processing !== null}
          variant="outline"
          style={styles.buttonSpacing}
        />
        <Button
          label="Back"
          onPress={() => navigation.goBack()}
          variant="ghost"
          disabled={processing !== null}
        />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.background,
  },
  content: {
    padding: 20,
    gap: 12,
  },
  header: {
    fontFamily: typography.fontFamilyExtraBold,
    fontSize: 28,
    color: palette.textPrimary,
  },
  subheader: {
    fontFamily: typography.fontFamily,
    fontSize: 14,
    lineHeight: 20,
    color: palette.textSecondary,
    marginBottom: 8,
  },
  card: {
    gap: 8,
  },
  sectionTitle: {
    fontFamily: typography.fontFamilyBold,
    fontSize: 13,
    color: palette.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: typography.fontFamilyBold,
    fontSize: 20,
    color: palette.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: typography.fontFamily,
    fontSize: 14,
    lineHeight: 20,
    color: palette.textSecondary,
    marginBottom: 12,
  },
  planLabel: {
    fontFamily: typography.fontFamilyBold,
    fontSize: 20,
    color: palette.primary,
  },
  remainingLabel: {
    fontFamily: typography.fontFamily,
    fontSize: 14,
    color: palette.textSecondary,
  },
  productItem: {
    fontFamily: typography.fontFamily,
    fontSize: 14,
    color: palette.textPrimary,
  },
  processingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 6,
  },
  processingText: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    color: palette.textSecondary,
  },
  errorText: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    color: palette.destructive,
  },
  buttonSpacing: {
    marginBottom: 8,
  },
});

export default PaywallScreen;
