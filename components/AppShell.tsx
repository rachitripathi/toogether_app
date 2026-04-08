import type { ReactNode } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, gradients } from '@/lib/theme';

type AppShellProps = {
  children: ReactNode;
  header?: ReactNode;
  withGradient?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function AppShell({ children, header, withGradient = false, style }: AppShellProps) {
  const content = (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.page }}>
      {header}
      <View style={[{ flex: 1, backgroundColor: colors.page }, style]}>{children}</View>
    </SafeAreaView>
  );

  if (!withGradient) {
    return content;
  }

  return (
    <LinearGradient colors={[...gradients.hero]} style={{ flex: 1 }}>
      {content}
    </LinearGradient>
  );
}
