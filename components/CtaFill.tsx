import { StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/providers/ThemeProvider';

// An orange gradient as a background layer: put it first inside a button or header and give it
// the parent's corner radius. Keep the parent's backgroundColor: colors.primary as the fallback.
// `cta` is the subtle button gradient; `header` runs orange → light orange for hero bars.
export function CtaFill({ radius = 0, variant = 'cta' }: { radius?: number; variant?: 'cta' | 'header' }) {
  const { gradients } = useTheme();
  return (
    <LinearGradient
      colors={variant === 'header' ? gradients.header : gradients.cta}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
    />
  );
}
