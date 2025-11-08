import React from 'react';
import { SafeAreaView, StatusBar } from 'react-native';

import { HomeScreen } from './HomeScreen';

const backgroundColor = '#030914';

export const App = () => (
  <>
    <StatusBar barStyle="light-content" backgroundColor={backgroundColor} />
    <SafeAreaView style={{ flex: 1, backgroundColor }}>
      <HomeScreen />
    </SafeAreaView>
  </>
);

export default App;
