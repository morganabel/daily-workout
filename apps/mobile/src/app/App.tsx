import React from 'react';
import { SafeAreaView, StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootSiblingParent } from 'react-native-root-siblings';

import { HomeScreen } from './HomeScreen';
import { WorkoutPreviewScreen } from './WorkoutPreviewScreen';
import { ActiveWorkoutScreen } from './ActiveWorkoutScreen';
import { RootStackParamList } from './navigation';
import { HistoryScreen } from './HistoryScreen';
import { SettingsScreen } from './SettingsScreen';
import { useDeviceToken } from './hooks/useDeviceToken';

const backgroundColor = '#030914';
const Stack = createNativeStackNavigator<RootStackParamList>();

export const App = () => {
  // Ensure a DeviceToken exists so API calls are authenticated.
  // The hook will auto-generate one if none is stored yet.
  useDeviceToken();

  return (
    <RootSiblingParent>
      <StatusBar barStyle="light-content" backgroundColor={backgroundColor} />
      <NavigationContainer>
        <SafeAreaView style={{ flex: 1, backgroundColor }}>
          <Stack.Navigator
            initialRouteName="Home"
            screenOptions={{
              headerShown: false,
              animation: 'default',
              contentStyle: { backgroundColor },
            }}
          >
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="WorkoutPreview" component={WorkoutPreviewScreen} />
            <Stack.Screen name="ActiveWorkout" component={ActiveWorkoutScreen} />
            <Stack.Screen name="History" component={HistoryScreen} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
          </Stack.Navigator>
        </SafeAreaView>
      </NavigationContainer>
    </RootSiblingParent>
  );
};

export default App;
