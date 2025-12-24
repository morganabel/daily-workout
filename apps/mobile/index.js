// Polyfill for crypto.getRandomValues() required by uuid package in React Native
import 'react-native-get-random-values';

import { registerRootComponent } from 'expo';

import App from './src/app/App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
