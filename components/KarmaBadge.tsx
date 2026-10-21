import { Text, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { useTheme } from '@/providers/ThemeProvider';
import { lightColors } from '@/lib/theme';
import { karmaColors } from '@/lib/karma';

// Flame + karma points in a pill tinted by tier (see lib/karma.ts). Karma not loaded yet
// (null) renders as 0, the same as a brand-new account. `onArt` is for badges drawn over the
// category art (event cards), which is light in both themes, so it always uses light tokens.
export function KarmaBadge({ karma, size = 'sm', onArt = false }: { karma: number | null; size?: 'sm' | 'md'; onArt?: boolean }) {
  const { colors } = useTheme();
  const value = karma ?? 0;
  const token = karmaColors(onArt ? lightColors : colors, value);
  const fontSize = size === 'md' ? 12 : 11;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        alignSelf: 'flex-start',
        backgroundColor: token.bg,
        borderRadius: 999,
        paddingHorizontal: size === 'md' ? 10 : 7,
        paddingVertical: size === 'md' ? 6 : 2,
      }}
    >
      <Icon name="flame" size={fontSize} color={token.text} />
      <Text style={{ color: token.text, fontSize, fontWeight: '800' }}>{value}</Text>
    </View>
  );
}
