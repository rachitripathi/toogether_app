import { useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Icon } from '@/components/Icon';
import { router } from 'expo-router';
import { AvatarBubble } from '@/components/AvatarBubble';
import { useTheme } from '@/providers/ThemeProvider';
import { useApp } from '@/providers/AppProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  const insets = useSafeAreaInsets();
  const scrollY = useRef(new Animated.Value(0)).current;
  const { currentUser, requests, crewRequests, getUserById, getEventById, getEventsImPartOf, getMyRatingForUser } = useApp();
  const { colors, shadow } = useTheme();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const dismiss = (id: string) => {
    setDismissed((prev) => new Set([...prev, id]));
  };

  const now = new Date();

  const activities: ActivityItem[] = [
    ...requests.flatMap<ActivityItem>((request) => {
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
            subtitle: `${actor.age} · ${actor.verified ? 'Verified' : 'Unverified'} · ${actor.city}`,
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
            subtitle: `${event.area}, Guwahati · ${event.timeSlot}`,
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
            subtitle: `${event.area}, Guwahati · ${event.timeSlot}`,
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
    ...crewRequests.flatMap<ActivityItem>((request) => {
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
            subtitle: `${user.age} · ${user.verified ? 'Verified' : 'Unverified'} · ${user.city}`,
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
            subtitle: `${user.age} · ${user.city}`,
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
  ].filter((item) => !dismissed.has(item.id));

  type RatingNudge = {
    id: string;
    eventTitle: string;
    eventEmoji: string;
    userId: string;
    route: string;
  };

  const ratingNudges: RatingNudge[] = currentUser
    ? getEventsImPartOf()
        .filter((event) => new Date(event.dateTime) < now)
        .flatMap((event) => {
          const participantIds = [
            event.creatorId,
            ...event.approvedUserIds,
          ].filter((id) => id !== currentUser.id);

          return participantIds
            .filter((id) => {
              const alreadyRated = getMyRatingForUser(id, event.id) !== null;
              const nudgeId = `nudge-${event.id}-${id}`;
              return !alreadyRated && !dismissed.has(nudgeId);
            })
            .map((id) => ({
              id: `nudge-${event.id}-${id}`,
              eventTitle: event.title,
              eventEmoji: event.emoji,
              userId: id,
              route: '/(tabs)/people',
            }));
        })
    : [];

  const hasContent = activities.length > 0 || ratingNudges.length > 0;

  const subtitleOpacity = scrollY.interpolate({
    inputRange: [0, 55],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const headerPaddingBottom = scrollY.interpolate({
    inputRange: [0, 60],
    outputRange: [22, 10],
    extrapolate: 'clamp',
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <Animated.View style={{ backgroundColor: colors.primary, paddingTop: insets.top + 14, paddingHorizontal: 20, paddingBottom: headerPaddingBottom, gap: 3 }}>
        <Text style={{ color: '#FFFFFF', fontSize: 32, fontWeight: '900', letterSpacing: -0.5 }}>Activity</Text>
        <Animated.Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14, opacity: subtitleOpacity }}>
          Updates and approvals
        </Animated.Text>
      </Animated.View>

      <ScrollView
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
        scrollEventThrottle={16}
        contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: 110 }}
      >
        {ratingNudges.length > 0 ? (
          <View style={{ gap: 10 }}>
            <Text style={{ color: colors.text, fontSize: 15, fontWeight: '800' }}>Rate your crew</Text>
            {ratingNudges.map((nudge) => {
              const user = getUserById(nudge.userId);
              if (!user) return null;
              return (
                <Pressable
                  key={nudge.id}
                  onPress={() => router.push(nudge.route as never)}
                  style={{
                    backgroundColor: colors.surface,
                    borderRadius: 22,
                    borderWidth: 1,
                    borderColor: colors.border,
                    padding: 14,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <Text style={{ fontSize: 26 }}>{nudge.eventEmoji}</Text>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{ color: colors.text, fontWeight: '800' }}>
                      How was {user.name.split(' ')[0]}?
                    </Text>
                    <Text style={{ color: colors.muted, fontSize: 12 }}>{nudge.eventTitle} · Tap to rate in My Crew</Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 2 }}>
                    {[1, 2, 3].map((s) => (
                      <Icon key={s} name="star-outline" size={14} color={colors.warning} />
                    ))}
                  </View>
                  <Pressable
                    onPress={(e) => { e.stopPropagation(); dismiss(nudge.id); }}
                    style={{ padding: 4 }}
                  >
                    <Icon name="close" size={16} color={colors.muted} />
                  </Pressable>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {activities.length ? (
          activities.map((activity) => {
            const user = getUserById(activity.userId);
            const accent =
              activity.tone === 'positive' ? colors.status.success.bg : activity.tone === 'pending' ? colors.status.warning.bg : colors.status.info.bg;
            const iconColor =
              activity.tone === 'positive' ? colors.status.success.text : activity.tone === 'pending' ? colors.status.warning.text : colors.status.info.text;
            const label =
              activity.tone === 'positive' ? 'Good news' : activity.tone === 'pending' ? 'Action needed' : 'Update';

            return (
              <Pressable
                key={activity.id}
                onPress={() => router.push(activity.route as never)}
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: 26,
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: 16,
                  gap: 14,
                  ...shadow.card,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ backgroundColor: accent, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }}>
                    <Text style={{ color: iconColor, fontSize: 11, fontWeight: '800' }}>{label}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: accent, alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name={activity.icon} size={18} color={iconColor} />
                    </View>
                    <Pressable
                      onPress={(e) => { e.stopPropagation(); dismiss(activity.id); }}
                      style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Icon name="close" size={14} color={colors.muted} />
                    </Pressable>
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
                    backgroundColor: colors.status.info.bg,
                    borderRadius: 18,
                    borderWidth: 1,
                    borderColor: colors.status.info.border,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    gap: 4,
                    flexDirection: 'row',
                    alignItems: 'center',
                  }}
                >
                  <Icon name="arrow-forward-circle" size={20} color={colors.primary} style={{ marginRight: 4 }} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{ color: colors.status.info.text, fontWeight: '700' }}>{activity.helper}</Text>
                    <Text style={{ color: colors.primary, fontSize: 12 }}>Tap to open the relevant screen.</Text>
                  </View>
                </View>
              </Pressable>
            );
          })
        ) : null}

        {!hasContent ? (
          <View
            style={{
              backgroundColor: colors.surface,
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
        ) : null}
      </ScrollView>
    </View>
  );
}
