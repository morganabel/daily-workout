import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { palette, typography } from '../theme';
import { RootStackParamList } from '../navigation';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

// Routes that have tabs in the bottom navigation
type TabRouteName = 'Home' | 'History' | 'Settings';

type TabItem = {
  name: TabRouteName;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon: keyof typeof Ionicons.glyphMap;
};

const TABS: TabItem[] = [
  {
    name: 'Home',
    label: 'Today',
    icon: 'calendar-outline',
    activeIcon: 'calendar',
  },
  {
    name: 'History',
    label: 'Activity',
    icon: 'time-outline',
    activeIcon: 'time',
  },
  {
    name: 'Settings',
    label: 'Profile', // Display as Profile, maps to Settings route
    icon: 'person-outline',
    activeIcon: 'person',
  },
];

export const BottomNavigation = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute();

  return (
    <View style={styles.container} accessibilityRole="tablist">
      {TABS.map((tab) => {
        const isActive = route.name === tab.name;
        return (
          <Pressable
            key={tab.name}
            style={styles.tab}
            onPress={() => {
              if (!isActive) {
                navigation.navigate(tab.name);
              }
            }}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: isActive }}
          >
            <Ionicons
              name={isActive ? tab.activeIcon : tab.icon}
              size={24}
              color={isActive ? palette.primary : palette.textMuted}
            />
            <Text
              style={[
                styles.label,
                { color: isActive ? palette.primary : palette.textMuted },
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: palette.backgroundTranslucent,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    paddingTop: 12,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  label: {
    fontFamily: typography.fontFamily,
    fontSize: 10,
  },
});
