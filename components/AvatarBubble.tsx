import { Image } from 'expo-image';
import { Text, View, type ColorValue } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { User } from '@/lib/types';

type AvatarBubbleProps = {
  user: User;
  size?: number;
};

export function AvatarBubble({ user, size = 44 }: AvatarBubbleProps) {
  const avatarColors =
    user.avatarColors.length >= 2
      ? (user.avatarColors as [ColorValue, ColorValue, ...ColorValue[]])
      : (['#8B5CF6', '#6366F1'] as const);
  const initials = user.name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  if (user.avatarUri) {
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          overflow: 'hidden',
          backgroundColor: '#E5E7EB',
        }}
      >
        <Image source={user.avatarUri} style={{ width: size, height: size }} contentFit="cover" />
      </View>
    );
  }

  return (
    <LinearGradient
      colors={avatarColors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: Math.max(12, size * 0.28) }}>
        {initials}
      </Text>
    </LinearGradient>
  );
}
