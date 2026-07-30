import { useRef } from 'react';
import { Animated, Pressable, Text, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, gradients, shadow } from '@/lib/theme';
import type { ReactNode } from 'react';

type GradientButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  fullWidth?: boolean;
  icon?: ReactNode;
  style?: ViewStyle;
  variant?: 'gradient' | 'dark';
};

export function GradientButton({
  label,
  onPress,
  disabled,
  fullWidth,
  icon,
  style,
  variant = 'gradient',
}: GradientButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = () => {
    Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 50, bounciness: 4 }).start();
  };

  const onPressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 10 }).start();
  };

  return (
    <Animated.View style={[{ transform: [{ scale }], width: fullWidth ? '100%' : undefined }, style]}>
      <Pressable
        disabled={disabled}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={{ width: '100%' }}
      >
        <LinearGradient
          colors={
            disabled
              ? ['#CBD5E1', '#CBD5E1']
              : variant === 'dark'
                ? ['#1A1A2E', '#1A1A2E']
                : [...gradients.amber]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            minHeight: 56,
            borderRadius: 28,
            paddingHorizontal: 20,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: 10,
            ...(disabled ? {} : shadow.lift),
          }}
        >
          {icon}
          <Text
            style={{
              color: disabled ? '#FFFFFF' : variant === 'dark' ? '#FFFFFF' : colors.text,
              fontSize: 16,
              fontWeight: '900',
            }}
          >
            {label}
          </Text>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}
