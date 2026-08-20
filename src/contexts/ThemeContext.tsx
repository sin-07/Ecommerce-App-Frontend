import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance, ColorSchemeName } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { darkColors, lightColors, ThemeColors } from '../constants/theme';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
  themeMode: ThemeMode;
  isDark: boolean;
  colors: ThemeColors;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  toggleTheme: () => Promise<void>;
}

const THEME_STORAGE_KEY = 'ap_theme_mode';

const ThemeContext = createContext<ThemeContextType>({
  themeMode: 'system',
  isDark: false,
  colors: lightColors,
  setThemeMode: async () => {},
  toggleTheme: async () => {}
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
  const [systemScheme, setSystemScheme] = useState<ColorSchemeName>(Appearance.getColorScheme());

  useEffect(() => {
    const loadPersistedTheme = async () => {
      try {
        const saved = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (saved === 'light' || saved === 'dark' || saved === 'system') {
          setThemeModeState(saved);
        }
      } catch {
        // Fallback to default
      }
    };
    loadPersistedTheme();

    const listener = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme);
    });

    return () => {
      listener.remove();
    };
  }, []);

  const isDark = useMemo(() => {
    if (themeMode === 'dark') return true;
    if (themeMode === 'light') return false;
    return systemScheme === 'dark';
  }, [themeMode, systemScheme]);

  const activeColors = useMemo(() => {
    return isDark ? darkColors : lightColors;
  }, [isDark]);

  const setThemeMode = useCallback(async (mode: ThemeMode) => {
    setThemeModeState(mode);
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch {
      // Storage fallback
    }
  }, []);

  const toggleTheme = useCallback(async () => {
    const nextMode = isDark ? 'light' : 'dark';
    await setThemeMode(nextMode);
  }, [isDark, setThemeMode]);

  const value = useMemo(
    () => ({
      themeMode,
      isDark,
      colors: activeColors,
      setThemeMode,
      toggleTheme
    }),
    [themeMode, isDark, activeColors, setThemeMode, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => useContext(ThemeContext);
