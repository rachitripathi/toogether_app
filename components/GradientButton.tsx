import { Pressable, Text, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, gradients } from '@/lib/theme';
import type { ReactNode } from 'react';

type GradientButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  fullWidth?: boolean;
  icon?: ReactNode;
  style?: ViewStyle;
};

export function GradientButton({
  label,
  onPress,
  disabled,
  fullWidth,
  icon,
  style,
}: GradientButtonProps) {
  return (
    <Pressable disabled={disabled} onPress={onPress} style={[{ width: fullWidth ? '100%' : undefined }, style]}>
      <LinearGradient
        colors={disabled ? ['#CBD5E1', '#CBD5E1'] : [...gradients.hero]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          minHeight: 56,
          borderRadius: 24,
          paddingHorizontal: 20,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: 10,
          shadowColor: colors.primary,
          shadowOpacity: disabled ? 0 : 0.18,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 10 },
          elevation: disabled ? 0 : 6,
        }}
      >
        {icon}
        <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' }}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}
