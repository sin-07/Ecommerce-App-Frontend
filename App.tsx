import 'react-native-gesture-handler';
import 'react-native-reanimated';
import { StatusBar } from 'expo-status-bar';
import React, { useMemo } from 'react';
import { Provider } from 'react-redux';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { MD3DarkTheme, MD3LightTheme, PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { OfflineBanner } from './src/components/OfflineBanner';
import { ToastHost } from './src/components/ToastHost';
import { NotificationBootstrap } from './src/components/NotificationBootstrap';
import { ThemeProvider, useTheme } from './src/contexts/ThemeContext';
import { NetworkProvider } from './src/contexts/NetworkContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { store } from './src/redux/store';

const ThemedApp: React.FC = () => {
  const { colors, isDark } = useTheme();

  const paperTheme = useMemo(() => {
    const base = isDark ? MD3DarkTheme : MD3LightTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
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
  }, [colors, isDark]);

  return (
    <PaperProvider theme={paperTheme}>
      <BottomSheetModalProvider>
        <StatusBar style={isDark ? 'light' : 'dark'} backgroundColor={colors.bg} />
        <OfflineBanner />
        <NotificationBootstrap />
        <RootNavigator />
        <ToastHost />
      </BottomSheetModalProvider>
    </PaperProvider>
  );
};

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <Provider store={store}>
          <SafeAreaProvider>
            <ThemeProvider>
              <NetworkProvider>
                <ThemedApp />
              </NetworkProvider>
            </ThemeProvider>
          </SafeAreaProvider>
        </Provider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}
