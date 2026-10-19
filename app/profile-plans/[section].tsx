import { useLocalSearchParams, router } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { useTheme } from '@/providers/ThemeProvider';
import { useApp } from '@/providers/AppProvider';
import { useNotifications } from '@/providers/NotificationsProvider';
import { UnreadBadge } from '@/components/UnreadBadge';
import { TapPressable } from '@/components/TapPressable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { archivesAt, formatClockTime, isEventArchived, isHappeningNow } from '@/lib/eventTime';

type Section = 'hosting' | 'joined' | 'past';

export default function ProfilePlansScreen() {
  const { section } = useLocalSearchParams<{ section: Section }>();
  const { currentUser, events } = useApp();
  const { colors } = useTheme();
  const { getUnreadChatCount } = useNotifications();
  const insets = useSafeAreaInsets();

  if (!currentUser || !section) {
    return null;
  }

  // Hosting/Joined keep a plan until it closes (6h after start), so one that's happening right now
  // is still here, marked as such. Past is only closed plans, kept as a record.
  const now = new Date().getTime();
  const byStart = (a: { dateTime: string }, b: { dateTime: string }) => a.dateTime.localeCompare(b.dateTime);
  const sections = {
    hosting: {
      title: "Plans I'm hosting",
      items: events
        .filter((event) => event.creatorId === currentUser.id && !isEventArchived(event, now))
        .sort(byStart),
    },
    joined: {
      title: 'Plans I joined',
      items: events
        .filter(
          (event) =>
            event.approvedUserIds.includes(currentUser.id) &&
            event.creatorId !== currentUser.id &&
            !isEventArchived(event, now)
        )
        .sort(byStart),
    },
    past: {
      title: 'Past plans',
      items: events
        .filter(
          (event) =>
            isEventArchived(event, now) &&
            (event.creatorId === currentUser.id || event.approvedUserIds.includes(currentUser.id))
        )
        .sort((a, b) => byStart(b, a)),
    },
  } as const;

  const current = sections[section];

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <View
        style={{
          paddingTop: insets.top + 16,
          paddingHorizontal: 20,
          paddingBottom: 18,
          backgroundColor: colors.card,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.page, alignItems: 'center', justifyContent: 'center' }}
        >
          <Icon name="arrow-back" size={18} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontSize: 20, fontWeight: '900' }}>{current.title}</Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>{current.items.length} plans</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 40 }}>
        {current.items.length ? (
          current.items.map((event) => {
            const dateLabel = new Date(event.dateTime).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
            const role = event.creatorId === currentUser.id ? 'Hosted' : 'Joined';
            // Archived (6h after start): a record only. Details and chat are closed, server-side
            // too, so the row isn't tappable.
            if (isEventArchived(event, now)) {
              return (
                <View
                  key={event.id}
                  style={{
                    backgroundColor: colors.surface,
                    borderRadius: 22,
                    padding: 16,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <Text style={{ fontSize: 28, opacity: 0.6 }}>{event.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontWeight: '800' }}>{event.title}</Text>
                    <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
                      {role} · {dateLabel} · {event.area}
                    </Text>
                  </View>
                  <Icon name="lock-closed-outline" size={16} color={colors.muted} />
                </View>
              );
            }
            return (
            <TapPressable
              key={event.id}
              onPress={() => router.push(`/event/${event.id}`)}
              style={{
                backgroundColor: colors.surface,
                borderRadius: 22,
                padding: 16,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <Text style={{ fontSize: 28 }}>{event.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '800' }}>{event.title}</Text>
                {isHappeningNow(event, now) ? (
                  <Text style={{ color: colors.solid.accept, fontSize: 12, marginTop: 2, fontWeight: '800' }}>
                    Happening now · chat closes {formatClockTime(archivesAt(event))}
                  </Text>
                ) : (
                  <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
                    {event.area}, Guwahati · {event.timeSlot}
                  </Text>
                )}
              </View>
              <UnreadBadge count={getUnreadChatCount(event.id)} />
              <Icon name="chevron-forward" size={18} color={colors.muted} />
            </TapPressable>
            );
          })
        ) : (
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 24,
              padding: 24,
              gap: 8,
            }}
          >
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800' }}>Nothing here yet</Text>
            <Text style={{ color: colors.muted }}>
              This section will fill up as you host, join, and complete more plans.
            </Text>
          </View>
        )}
        {section === 'past' && current.items.length ? (
          <Text style={{ color: colors.muted, fontSize: 12.5, textAlign: 'center', lineHeight: 18 }}>
            A plan&apos;s details and chat close 6 hours after it starts. After that it stays here as a record.
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}
