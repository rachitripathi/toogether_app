import { useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Icon } from '@/components/Icon';
import { router } from 'expo-router';
import { AvatarBubble } from '@/components/AvatarBubble';
import { useTheme } from '@/providers/ThemeProvider';
import { useApp } from '@/providers/AppProvider';
import { useNotifications } from '@/providers/NotificationsProvider';
import type { AppNotification, NotificationType } from '@/lib/types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const NOTIFICATION_PRESENTATION: Record<NotificationType, { icon: keyof typeof Ionicons.glyphMap; tone: 'pending' | 'positive' | 'neutral' }> = {
  join_request_received: { icon: 'person-add-outline', tone: 'pending' },
  join_request_approved: { icon: 'checkmark-circle-outline', tone: 'positive' },
  join_request_rejected: { icon: 'close-circle-outline', tone: 'neutral' },
  verification_approved: { icon: 'shield-checkmark-outline', tone: 'positive' },
  verification_rejected: { icon: 'shield-outline', tone: 'neutral' },
  new_message: { icon: 'chatbubble-ellipses-outline', tone: 'pending' },
};

export default function ActivityScreen() {
  const insets = useSafeAreaInsets();
  const scrollY = useRef(new Animated.Value(0)).current;
  const { currentUser, getUserById, getEventsImPartOf, getMyRatingForUser } = useApp();
  const { notifications, markAsRead, markAllAsRead } = useNotifications();
  const { colors, shadow } = useTheme();

  const now = new Date();
  const [dismissedNudges, setDismissedNudges] = useState<Set<string>>(new Set());
  const dismissNudge = (id: string) => setDismissedNudges((prev) => new Set([...prev, id]));

  const openNotification = (notification: AppNotification) => {
    markAsRead(notification.id);
    if (notification.data.route) {
      router.push(notification.data.route as never);
    }
  };

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
              return !alreadyRated && !dismissedNudges.has(nudgeId);
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

  const hasContent = notifications.length > 0 || ratingNudges.length > 0;

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
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: '#FFFFFF', fontSize: 32, fontWeight: '900', letterSpacing: -0.5 }}>Activity</Text>
          {notifications.some((item) => !item.readAt) ? (
            <Pressable onPress={markAllAsRead} style={{ paddingVertical: 6, paddingHorizontal: 4 }}>
              <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '700' }}>Mark all read</Text>
            </Pressable>
          ) : null}
        </View>
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
                    onPress={(e) => { e.stopPropagation(); dismissNudge(nudge.id); }}
                    style={{ padding: 4 }}
                  >
                    <Icon name="close" size={16} color={colors.muted} />
                  </Pressable>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {notifications.length ? (
          notifications.map((notification) => {
            const isUnread = !notification.readAt;
            const user = notification.data.actorId ? getUserById(notification.data.actorId) : undefined;
            const { icon, tone } = NOTIFICATION_PRESENTATION[notification.type];
            const accent = tone === 'positive' ? colors.status.success.bg : tone === 'pending' ? colors.status.warning.bg : colors.status.info.bg;
            const iconColor = tone === 'positive' ? colors.status.success.text : tone === 'pending' ? colors.status.warning.text : colors.status.info.text;
            const label = tone === 'positive' ? 'Good news' : tone === 'pending' ? 'Action needed' : 'Update';

            return (
              <Pressable
                key={notification.id}
                onPress={() => openNotification(notification)}
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: 26,
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: 16,
                  gap: 14,
                  opacity: isUnread ? 1 : 0.6,
                  ...shadow.card,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    {isUnread ? (
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.danger }} />
                    ) : null}
                    <View style={{ backgroundColor: accent, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }}>
                      <Text style={{ color: iconColor, fontSize: 11, fontWeight: '800' }}>{label}</Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: accent, alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name={icon} size={18} color={iconColor} />
                    </View>
                    {isUnread ? (
                      <Pressable
                        onPress={(e) => { e.stopPropagation(); markAsRead(notification.id); }}
                        style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Icon name="close" size={14} color={colors.muted} />
                      </Pressable>
                    ) : null}
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                  {user ? <AvatarBubble user={user} size={48} /> : null}
                  <View style={{ flex: 1, gap: 5 }}>
                    <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800', lineHeight: 22 }}>
                      {notification.title}
                    </Text>
                    <Text style={{ color: colors.muted }}>{notification.body}</Text>
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
