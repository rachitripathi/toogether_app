import { useRef } from 'react';
import { Animated, Pressable, Text, View, type ViewStyle } from 'react-native';
import { useTheme } from '@/providers/ThemeProvider';
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
  const { colors, shadow } = useTheme();
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
        <View
          style={{
            backgroundColor: disabled ? colors.border : variant === 'dark' ? colors.text : colors.primary,
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
              color: disabled ? '#FFFFFF' : variant === 'dark' ? colors.page : '#FFFFFF',
              fontSize: 16,
              fontWeight: '900',
            }}
          >
            {label}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}
