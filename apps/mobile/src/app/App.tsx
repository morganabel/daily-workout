import React from 'react';
import { SafeAreaView, StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { HomeScreen } from './HomeScreen';
import { WorkoutPreviewScreen } from './WorkoutPreviewScreen';
import { RootStackParamList } from './navigation';

const backgroundColor = '#030914';
const Stack = createNativeStackNavigator<RootStackParamList>();

export const App = () => (
  <>
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
        </Stack.Navigator>
      </SafeAreaView>
    </NavigationContainer>
  </>
);

export default App;
