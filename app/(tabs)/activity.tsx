import { Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { AvatarBubble } from '@/components/AvatarBubble';
import { HeaderHero } from '@/components/HeaderHero';
import { colors } from '@/lib/theme';
import { useApp } from '@/providers/AppProvider';

type ActivityItem = {
  id: string;
  title: string;
  subtitle: string;
  helper: string;
  userId: string;
  route: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone: 'pending' | 'positive' | 'neutral';
};

export default function ActivityScreen() {
  const { currentUser, requests, crewRequests, getUserById, getEventById } = useApp();

  const activities: ActivityItem[] = [
    ...requests.flatMap((request) => {
      const actor = getUserById(request.userId);
      const event = getEventById(request.eventId);
      if (!actor || !event || !currentUser) {
        return [];
      }

      if (request.status === 'pending' && event.creatorId === currentUser.id && request.userId !== currentUser.id) {
        return [
          {
            id: `${request.id}-pending`,
            title: `${actor.name.split(' ')[0]} wants to join ${event.title}`,
            subtitle: `${actor.age} • ${actor.verified ? 'Verified' : 'Unverified'} • ${actor.city}`,
            helper: 'Open the plan to review this join request.',
            userId: actor.id,
            route: `/event/${event.id}`,
            icon: 'person-add-outline',
            tone: 'pending',
          },
        ];
      }

      if (request.userId === currentUser.id && request.status === 'approved') {
        return [
          {
            id: `${request.id}-approved`,
            title: `You're approved for ${event.title}`,
            subtitle: `${event.area}, Guwahati • ${event.timeSlot}`,
            helper: 'Open the event to view private details and chat.',
            userId: event.creatorId,
            route: `/event/${event.id}`,
            icon: 'checkmark-circle-outline',
            tone: 'positive',
          },
        ];
      }

      if (request.userId === currentUser.id && request.status === 'rejected') {
        return [
          {
            id: `${request.id}-rejected`,
            title: `Join request not approved for ${event.title}`,
            subtitle: `${event.area}, Guwahati • ${event.timeSlot}`,
            helper: 'Try another plan or request a different event.',
            userId: event.creatorId,
            route: `/event/${event.id}`,
            icon: 'close-circle-outline',
            tone: 'neutral',
          },
        ];
      }

      return [];
    }),
    ...crewRequests.flatMap((request) => {
      if (!currentUser) {
        return [];
      }

      if (request.toUserId === currentUser.id && request.status === 'pending') {
        const user = getUserById(request.fromUserId);
        if (!user) {
          return [];
        }

        return [
          {
            id: `${request.id}-crew-incoming`,
            title: `${user.name.split(' ')[0]} sent you a crew request`,
            subtitle: `${user.age} • ${user.verified ? 'Verified' : 'Unverified'} • ${user.city}`,
            helper: 'Open My Crew to accept or decline.',
            userId: user.id,
            route: '/(tabs)/people',
            icon: 'people-outline',
            tone: 'pending',
          },
        ];
      }

      if (request.fromUserId === currentUser.id && request.status === 'accepted') {
        const user = getUserById(request.toUserId);
        if (!user) {
          return [];
        }

        return [
          {
            id: `${request.id}-crew-accepted`,
            title: `${user.name.split(' ')[0]} joined your crew`,
            subtitle: `${user.age} • ${user.city}`,
            helper: 'Open their profile or start planning together.',
            userId: user.id,
            route: `/user/${user.id}`,
            icon: 'sparkles-outline',
            tone: 'positive',
          },
        ];
      }

      return [];
    }),
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <HeaderHero title="Activity" subtitle="Updates and approvals" />

      <ScrollView contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: 110 }}>
        {activities.length ? (
          activities.map((activity) => {
            const user = getUserById(activity.userId);
            const accent =
              activity.tone === 'positive' ? '#DCFCE7' : activity.tone === 'pending' ? '#FFF1D6' : '#EFF6FF';
            const iconColor =
              activity.tone === 'positive' ? '#15803D' : activity.tone === 'pending' ? '#B45309' : colors.skyDark;
            const label =
              activity.tone === 'positive' ? 'Good news' : activity.tone === 'pending' ? 'Action needed' : 'Update';

            return (
              <Pressable
                key={activity.id}
                onPress={() => router.push(activity.route as never)}
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: 26,
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: 16,
                  gap: 14,
                  shadowColor: '#D7E6F2',
                  shadowOpacity: 0.16,
                  shadowRadius: 18,
                  shadowOffset: { width: 0, height: 8 },
                  elevation: 2,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View
                    style={{
                      backgroundColor: accent,
                      borderRadius: 999,
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                    }}
                  >
                    <Text style={{ color: iconColor, fontSize: 11, fontWeight: '800' }}>{label}</Text>
                  </View>
                  <View
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 19,
                      backgroundColor: accent,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name={activity.icon} size={18} color={iconColor} />
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                  {user ? <AvatarBubble user={user} size={48} /> : null}
                  <View style={{ flex: 1, gap: 5 }}>
                    <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800', lineHeight: 22 }}>
                      {activity.title}
                    </Text>
                    <Text style={{ color: colors.muted }}>{activity.subtitle}</Text>
                  </View>
                </View>

                <View
                  style={{
                    backgroundColor: '#F8FAFC',
                    borderRadius: 18,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    gap: 6,
                  }}
                >
                  <Text style={{ color: colors.text, fontWeight: '700' }}>{activity.helper}</Text>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>Tap to open the relevant screen.</Text>
                </View>
              </Pressable>
            );
          })
        ) : (
          <View
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 28,
              borderWidth: 1,
              borderColor: colors.border,
              padding: 28,
              alignItems: 'center',
              gap: 10,
            }}
          >
            <Text style={{ fontSize: 42 }}>📬</Text>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800' }}>All caught up</Text>
            <Text style={{ color: colors.muted, textAlign: 'center', lineHeight: 22 }}>
              New join requests, crew updates, and approvals will show up here as soon as people start reacting to your plans.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
