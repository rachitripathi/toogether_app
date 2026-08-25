import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { Platform, useColorScheme as useSystemColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as NavigationBar from 'expo-navigation-bar';
import {
  darkColors,
  darkGradients,
  darkShadow,
  lightColors,
  lightGradients,
  lightShadow,
  type AppColors,
  type AppGradients,
  type AppShadow,
} from '@/lib/theme';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedScheme = 'light' | 'dark';

const THEME_PREFERENCE_KEY = 'theme_preference';

type ThemeContextValue = {
  preference: ThemePreference;
  scheme: ResolvedScheme;
  colors: AppColors;
  gradients: AppGradients;
  shadow: AppShadow;
  setPreference: (preference: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: PropsWithChildren) {
  const systemScheme = useSystemColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(THEME_PREFERENCE_KEY).then((stored) => {
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        setPreferenceState(stored);
      }
      setIsLoaded(true);
    });
  }, []);

  const setPreference = (next: ThemePreference) => {
    setPreferenceState(next);
    AsyncStorage.setItem(THEME_PREFERENCE_KEY, next).catch(() => {});
  };

  // preference itself already defaults to 'system' before the persisted value has
  // loaded, so while loading, resolve exactly like 'system' does: follow the live
  // OS scheme rather than hardcoding light. Hardcoding light here used to mean a
  // phone in dark mode (system preference, the default — true for nearly every
  // install) flashed light for the brief moment before the AsyncStorage read
  // resolved, every single launch. Only once a stored *explicit* light/dark
  // override loads does this stop tracking the live system scheme.
  const scheme: ResolvedScheme = preference === 'system' || !isLoaded ? (systemScheme ?? 'light') : preference;

  // The gesture-nav pill/button color isn't tied to the app's own colors automatically —
  // Android needs to be told explicitly whether to draw it light or dark, or it defaults
  // to a light-appropriate color that looks wrong once the page itself goes dark.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    NavigationBar.setButtonStyleAsync(scheme === 'dark' ? 'light' : 'dark').catch(() => {});
  }, [scheme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      preference,
      scheme,
      colors: scheme === 'dark' ? darkColors : lightColors,
      gradients: scheme === 'dark' ? darkGradients : lightGradients,
      shadow: scheme === 'dark' ? darkShadow : lightShadow,
      setPreference,
    }),
    [preference, scheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
