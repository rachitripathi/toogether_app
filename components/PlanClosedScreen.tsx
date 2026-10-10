import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { useTheme } from '@/providers/ThemeProvider';
import { ARCHIVE_AFTER_HOURS } from '@/lib/eventTime';
import type { Event } from '@/lib/types';

// Shown instead of a plan's details or chat once it's archived (6h after start, migration 016),
// or when the plan is no longer visible to this user at all (e.g. an old notification opened
// after archiving, when RLS no longer returns the row).
export function PlanClosedScreen({ event }: { event?: Pick<Event, 'title' | 'emoji' | 'dateTime'> }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <View style={{ paddingTop: insets.top + 14, paddingHorizontal: 20 }}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/home'))}
          style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}
        >
          <Icon name="arrow-back" size={18} color={colors.text} />
        </Pressable>
      </View>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 12 }}>
        <Text style={{ fontSize: 46 }}>{event?.emoji ?? '🔒'}</Text>
        <Text style={{ color: colors.text, fontSize: 21, fontWeight: '900', textAlign: 'center' }}>
          {event ? event.title : 'This plan is no longer available'}
        </Text>
        {event ? (
          <Text style={{ color: colors.muted, fontWeight: '700' }}>
            {new Date(event.dateTime).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
          </Text>
        ) : null}
        <Text style={{ color: colors.muted, textAlign: 'center', lineHeight: 21 }}>
          {event
            ? `Plans close ${ARCHIVE_AFTER_HOURS} hours after they start. Details and chat aren't available anymore, but it stays in Profile → Past plans for the host and everyone who joined.`
            : `It may have been cancelled, or it closed ${ARCHIVE_AFTER_HOURS} hours after it started.`}
        </Text>
      </View>
    </View>
  );
}
