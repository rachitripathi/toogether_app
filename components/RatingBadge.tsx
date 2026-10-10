import { Text, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { useTheme } from '@/providers/ThemeProvider';
import { formatRating, ratingTone } from '@/lib/rating';

// Star + average in a pill tinted by rating band (green / yellow / red, see lib/rating.ts),
// or a neutral "New" pill for someone nobody has rated yet.
export function RatingBadge({ average, size = 'sm' }: { average: number | null; size?: 'sm' | 'md' }) {
  const { colors } = useTheme();
  const token = average ? colors.status[ratingTone(average)] : null;
  const fontSize = size === 'md' ? 12 : 11;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        alignSelf: 'flex-start',
        backgroundColor: token ? token.bg : colors.surface,
        borderWidth: 1,
        borderColor: token ? token.border : colors.border,
        borderRadius: 999,
        paddingHorizontal: size === 'md' ? 10 : 7,
        paddingVertical: size === 'md' ? 6 : 2,
      }}
    >
      <Icon name="star" size={fontSize} color={token ? token.text : colors.muted} />
      <Text style={{ color: token ? token.text : colors.muted, fontSize, fontWeight: '800' }}>
        {average ? formatRating(average) : 'New'}
      </Text>
    </View>
  );
}
