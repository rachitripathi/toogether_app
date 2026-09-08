import { useColorScheme as useRNColorScheme } from 'react-native';

// RN's ColorSchemeName includes Android's 'unspecified' value; normalize it away so
// every caller can keep treating the result as 'light' | 'dark' | null.
export function useColorScheme(): 'light' | 'dark' | null {
  const scheme = useRNColorScheme();
  return scheme === 'dark' ? 'dark' : scheme === 'light' ? 'light' : null;
}
