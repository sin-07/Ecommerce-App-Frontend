import 'react-native-gesture-handler';
import 'react-native-reanimated';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { Provider } from 'react-redux';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { MD3LightTheme, PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ToastHost } from './src/components/ToastHost';
import { NotificationBootstrap } from './src/components/NotificationBootstrap';
import { colors } from './src/constants/theme';
import { RootNavigator } from './src/navigation/RootNavigator';
import { store } from './src/redux/store';

const paperTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: colors.primary,
    secondary: colors.accent,
    error: colors.danger,
    background: colors.bg,
    surface: colors.card,
    surfaceVariant: colors.cardAlt,
    onSurface: colors.text,
    onSurfaceVariant: colors.textMuted,
    outline: colors.border
  }
};

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Provider store={store}>
        <SafeAreaProvider>
          <PaperProvider theme={paperTheme}>
            <BottomSheetModalProvider>
              <StatusBar style="dark" backgroundColor={colors.bg} />
              <NotificationBootstrap />
              <RootNavigator />
              <ToastHost />
            </BottomSheetModalProvider>
          </PaperProvider>
        </SafeAreaProvider>
      </Provider>
    </GestureHandlerRootView>
  );
}
