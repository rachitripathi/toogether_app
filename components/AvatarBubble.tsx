import { Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { User } from '@/lib/types';

type AvatarBubbleProps = {
  user: User;
  size?: number;
};

export function AvatarBubble({ user, size = 44 }: AvatarBubbleProps) {
  const initials = user.name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  return (
    <LinearGradient
      colors={user.avatarColors}
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
