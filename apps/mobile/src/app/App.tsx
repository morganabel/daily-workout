import React from 'react';
import { SafeAreaView, StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootSiblingParent } from 'react-native-root-siblings';

import { HomeScreen } from './HomeScreen';
import { LaunchScreen } from './LaunchScreen';
import { WorkoutPreviewScreen } from './WorkoutPreviewScreen';
import { ActiveWorkoutScreen } from './ActiveWorkoutScreen';
import { WorkoutSessionDetailScreen } from './WorkoutSessionDetailScreen';
import { RootStackParamList } from './navigation';
import { HistoryScreen } from './HistoryScreen';
import { SettingsScreen } from './SettingsScreen';
import { SignInScreen } from './SignInScreen';
import { SignUpScreen } from './SignUpScreen';
import { useDeviceToken } from './hooks/useDeviceToken';
import { DebugMcpBridge } from './debug/DebugMcpBridge';
import { isDebugMcpBridgeEnabled } from './debug/debugMcpConfig';
import {
  useFonts,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';
import { palette } from './theme';

const backgroundColor = palette.background;
const Stack = createNativeStackNavigator<RootStackParamList>();

export const App = () => {
  // Ensure a DeviceToken exists so API calls are authenticated.
  // The hook will auto-generate one if none is stored yet.
  useDeviceToken();

  const [fontsLoaded] = useFonts({
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });

  if (!fontsLoaded) {
    return null;
  }

  const showDebugMcpBridge = isDebugMcpBridgeEnabled();

  return (
    <RootSiblingParent>
      {showDebugMcpBridge ? <DebugMcpBridge /> : null}
      <StatusBar barStyle="dark-content" backgroundColor={backgroundColor} />
      <NavigationContainer>
        <SafeAreaView style={{ flex: 1, backgroundColor }}>
          <Stack.Navigator
            initialRouteName="Launch"
            screenOptions={{
              headerShown: false,
              animation: 'default',
              contentStyle: { backgroundColor },
            }}
          >
            <Stack.Screen name="Launch" component={LaunchScreen} />
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen
              name="WorkoutPreview"
              component={WorkoutPreviewScreen}
            />
            <Stack.Screen
              name="ActiveWorkout"
              component={ActiveWorkoutScreen}
            />
            <Stack.Screen name="History" component={HistoryScreen} />
            <Stack.Screen
              name="WorkoutSessionDetail"
              component={WorkoutSessionDetailScreen}
            />
            <Stack.Screen name="Settings" component={SettingsScreen} />
            {/* Auth screens - optional upgrade from anonymous */}
            <Stack.Screen name="SignIn" component={SignInScreen} />
            <Stack.Screen name="SignUp" component={SignUpScreen} />
          </Stack.Navigator>
        </SafeAreaView>
      </NavigationContainer>
    </RootSiblingParent>
  );
};

export default App;
