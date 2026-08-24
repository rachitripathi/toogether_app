import { Pressable, Text, View } from 'react-native';
import { useTheme } from '@/providers/ThemeProvider';
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
  /** Override the safe-area top inset used for spacing. Pass 0 when the parent screen already reserves that space itself. Defaults to the device's actual top inset. */
  topInset?: number;
};

export function HeaderHero({
  title,
  subtitle,
  eyebrow,
  right,
  leading,
  children,
  onTitlePress,
  topInset,
}: HeaderHeroProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const resolvedTopInset = topInset ?? insets.top;
  const TitleWrapper = onTitlePress ? Pressable : View;

  return (
    <View
      style={{
        backgroundColor: colors.page,
        paddingHorizontal: 20,
        paddingBottom: 6,
        paddingTop: resolvedTopInset + 8,
      }}
    >
      {leading || right ? (
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 12,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>{leading}</View>
          <View>{right}</View>
        </View>
      ) : null}

      <TitleWrapper onPress={onTitlePress} style={{ gap: 2 }}>
        {eyebrow ? (
          <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '700' }}>{eyebrow}</Text>
        ) : null}
        <Text style={{ color: colors.text, fontSize: 28, fontWeight: '900' }}>{title}</Text>
        {subtitle ? (
          <Text style={{ color: colors.muted, fontSize: 14, fontWeight: '600' }}>{subtitle}</Text>
        ) : null}
      </TitleWrapper>

      {children}
    </View>
  );
}
