import { Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { gradients } from '@/lib/theme';
import type { ReactNode } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type HeaderHeroProps = {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children?: ReactNode;
};

export function HeaderHero({ title, subtitle, right, children }: HeaderHeroProps) {
  const insets = useSafeAreaInsets();

  return (
    <LinearGradient
      colors={[...gradients.hero]}
      style={{
        paddingHorizontal: 20,
        paddingBottom: 24,
        paddingTop: insets.top + 8,
        borderBottomLeftRadius: 28,
        borderBottomRightRadius: 28,
        overflow: 'hidden',
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ color: '#FFFFFF', fontSize: 28, fontWeight: '900' }}>{title}</Text>
          {subtitle ? (
            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14 }}>{subtitle}</Text>
          ) : null}
        </View>
        {right}
      </View>
      {children}
    </LinearGradient>
  );
}
