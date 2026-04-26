import { Pressable, Text, View } from 'react-native';
import { colors } from '@/lib/theme';
import type { ReactNode } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type HeaderHeroProps = {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  right?: ReactNode;
  leading?: ReactNode;
  children?: ReactNode;
  onTitlePress?: () => void;
};

export function HeaderHero({ title, subtitle, eyebrow, right, leading, children, onTitlePress }: HeaderHeroProps) {
  const insets = useSafeAreaInsets();
  const compactTitle = Boolean(leading || eyebrow);
  const TitleWrapper = onTitlePress ? Pressable : View;

  return (
    <View
      style={{
        backgroundColor: colors.page,
        paddingHorizontal: 20,
        paddingBottom: 6,
        paddingTop: insets.top + 8,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <TitleWrapper
          onPress={onTitlePress}
          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}
        >
          {leading}
          <View style={{ flex: 1, gap: 2 }}>
            {eyebrow ? (
              <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '700' }}>{eyebrow}</Text>
            ) : null}
            <Text style={{ color: colors.text, fontSize: compactTitle ? 19 : 28, fontWeight: '900' }}>{title}</Text>
            {subtitle ? (
              <Text style={{ color: colors.muted, fontSize: 14, fontWeight: '600' }}>
                {subtitle}
              </Text>
            ) : null}
          </View>
        </TitleWrapper>
        {right}
      </View>
      {children}
    </View>
  );
}
