import { Text, View } from 'react-native';
import { useTheme } from '@/providers/ThemeProvider';

// WhatsApp-style unread chat count. Renders nothing at 0.
export function UnreadBadge({ count }: { count: number }) {
  const { colors } = useTheme();
  if (count <= 0) {
    return null;
  }
  return (
    <View
      style={{
        minWidth: 20,
        height: 20,
        borderRadius: 10,
        paddingHorizontal: 6,
        backgroundColor: colors.danger,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '900' }}>{count > 99 ? '99+' : count}</Text>
    </View>
  );
}
