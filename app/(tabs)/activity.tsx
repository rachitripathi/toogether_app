import { Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { AvatarBubble } from '@/components/AvatarBubble';
import { HeaderHero } from '@/components/HeaderHero';
import { colors } from '@/lib/theme';
import { useApp } from '@/providers/AppProvider';

export default function ActivityScreen() {
  const { currentUser, requests, getUserById, getEventById } = useApp();

  const activities = requests
    .map((request) => {
      const actor = getUserById(request.userId);
      const event = getEventById(request.eventId);
      if (!actor || !event || !currentUser) {
        return null;
      }

      if (request.status === 'pending' && event.creatorId === currentUser.id && request.userId !== currentUser.id) {
        return {
          id: `${request.id}-pending`,
          title: `${actor.name.split(' ')[0]} wants to join "${event.title}"`,
          subtitle: 'Tap to review the request',
          user: actor,
          eventId: event.id,
          icon: 'person-add-outline',
        };
      }

      if (request.userId === currentUser.id && request.status === 'approved') {
        return {
          id: `${request.id}-approved`,
          title: `You're approved for "${event.title}"`,
          subtitle: 'You are in. Open the event chat.',
          user: actor,
          eventId: event.id,
          icon: 'checkmark-circle-outline',
        };
      }

      if (request.userId === currentUser.id && request.status === 'rejected') {
        return {
          id: `${request.id}-rejected`,
          title: `You weren't approved for "${event.title}"`,
          subtitle: 'Maybe next time.',
          user: actor,
          eventId: event.id,
          icon: 'close-circle-outline',
        };
      }

      return null;
    })
    .filter(Boolean);

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <HeaderHero title="Activity" subtitle="Your latest notifications" />

      <ScrollView contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: 110 }}>
        {activities.length ? (
          activities.map((activity) => (
            <Pressable
              key={activity!.id}
              onPress={() => router.push(`/event/${activity!.eventId}`)}
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 24,
                borderWidth: 1,
                borderColor: colors.border,
                padding: 16,
                flexDirection: 'row',
                gap: 12,
                alignItems: 'center',
              }}
            >
              <AvatarBubble user={activity!.user} size={46} />
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={{ color: colors.text, fontWeight: '800', lineHeight: 22 }}>{activity!.title}</Text>
                <Text style={{ color: colors.muted }}>{activity!.subtitle}</Text>
              </View>
              <Ionicons name={activity!.icon as any} size={18} color={colors.primary} />
            </Pressable>
          ))
        ) : (
          <View style={{ backgroundColor: '#FFFFFF', borderRadius: 24, borderWidth: 1, borderColor: colors.border, padding: 28, alignItems: 'center', gap: 8 }}>
            <Text style={{ fontSize: 48 }}>🎉</Text>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800' }}>All caught up</Text>
            <Text style={{ color: colors.muted, textAlign: 'center' }}>
              Nothing new here. Go create some chaos.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
