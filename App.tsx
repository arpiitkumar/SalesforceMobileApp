/**
 * App root.
 *
 * Wires the merged field-sales app (src/) on top of the Salesforce Mobile SDK
 * React Native shell:
 *   - Redux Toolkit store + redux-persist (src/redux/store)
 *   - React Native Paper theme provider
 *   - Gesture Handler + Safe Area providers required by React Navigation
 *   - MainNavigator (src/navigation/MainNavigator) owns the NavigationContainer
 */
import React from 'react';
import {StatusBar} from 'react-native';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {Provider as ReduxProvider} from 'react-redux';
import {PersistGate} from 'redux-persist/integration/react';
import {MD3LightTheme, PaperProvider} from 'react-native-paper';
import {Palette} from './src/theme';

import {store, persistor} from './src/redux/store';
import MainNavigator from './src/navigation/MainNavigator';

const paperTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: Palette.royalBlue,
    onPrimary: Palette.white,
    primaryContainer: Palette.champagne,
    onPrimaryContainer: Palette.deepNavy,
    secondary: Palette.antiqueGold,
    onSecondary: Palette.deepNavy,
    secondaryContainer: Palette.parchment,
    background: Palette.ivory,
    surface: Palette.white,
    surfaceVariant: Palette.parchment,
    outline: Palette.stone,
    onSurface: Palette.charcoal,
    onSurfaceVariant: Palette.taupe,
    error: Palette.error,
  },
};

function App(): React.JSX.Element {
  return (
    <GestureHandlerRootView style={{flex: 1}}>
      <ReduxProvider store={store}>
        <PersistGate loading={null} persistor={persistor}>
          <SafeAreaProvider>
            <PaperProvider theme={paperTheme}>
              <StatusBar barStyle="light-content" backgroundColor={Palette.deepNavy} />
              <MainNavigator />
            </PaperProvider>
          </SafeAreaProvider>
        </PersistGate>
      </ReduxProvider>
    </GestureHandlerRootView>
  );
}

export default App;
