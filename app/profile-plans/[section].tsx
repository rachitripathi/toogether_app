import { useLocalSearchParams, router } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/lib/theme';
import { useApp } from '@/providers/AppProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Section = 'hosting' | 'joined' | 'past';

export default function ProfilePlansScreen() {
  const { section } = useLocalSearchParams<{ section: Section }>();
  const { currentUser, events } = useApp();
  const insets = useSafeAreaInsets();

  if (!currentUser || !section) {
    return null;
  }

  const now = new Date();
  const sections = {
    hosting: {
      title: "Plans I'm hosting",
      items: events.filter((event) => event.creatorId === currentUser.id && new Date(event.dateTime) >= now),
    },
    joined: {
      title: 'Plans I joined',
      items: events.filter(
        (event) =>
          event.approvedUserIds.includes(currentUser.id) &&
          event.creatorId !== currentUser.id &&
          new Date(event.dateTime) >= now
      ),
    },
    past: {
      title: 'Past plans',
      items: events.filter(
        (event) =>
          new Date(event.dateTime) < now &&
          (event.creatorId === currentUser.id || event.approvedUserIds.includes(currentUser.id))
      ),
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
          backgroundColor: '#FFFFFF',
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.page, alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="arrow-back" size={18} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontSize: 20, fontWeight: '900' }}>{current.title}</Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>{current.items.length} plans</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 40 }}>
        {current.items.length ? (
          current.items.map((event) => (
            <Pressable
              key={event.id}
              onPress={() => router.push(`/event/${event.id}`)}
              style={{
                backgroundColor: colors.surface,
                borderRadius: 22,
                borderWidth: 1,
                borderColor: colors.border,
                padding: 16,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <Text style={{ fontSize: 28 }}>{event.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '800' }}>{event.title}</Text>
                <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
                  {event.area}, Guwahati · {event.timeSlot}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#98A2B3" />
            </Pressable>
          ))
        ) : (
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 24,
              borderWidth: 1,
              borderColor: colors.border,
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
      </ScrollView>
    </View>
  );
}
