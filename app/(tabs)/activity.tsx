import { useEffect, useRef, useState } from 'react';
import { CtaFill } from '@/components/CtaFill';
import { Animated, LayoutAnimation, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Icon } from '@/components/Icon';
import { router } from 'expo-router';
import { AvatarBubble } from '@/components/AvatarBubble';
import { useTheme } from '@/providers/ThemeProvider';
import { useApp } from '@/providers/AppProvider';
import { useNotifications } from '@/providers/NotificationsProvider';
import type { AppNotification, NotificationType } from '@/lib/types';
import { TapPressable } from '@/components/TapPressable';
import { SwipeToDismiss } from '@/components/SwipeToDismiss';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const NOTIFICATION_PRESENTATION: Record<NotificationType, { icon: keyof typeof Ionicons.glyphMap; tone: 'pending' | 'positive' | 'neutral' }> = {
  join_request_received: { icon: 'person-add-outline', tone: 'pending' },
  join_request_approved: { icon: 'checkmark-circle-outline', tone: 'positive' },
  join_request_rejected: { icon: 'close-circle-outline', tone: 'neutral' },
  join_request_removed: { icon: 'close-circle-outline', tone: 'neutral' },
  event_invite_received: { icon: 'calendar-outline', tone: 'pending' },
  event_invite_accepted: { icon: 'checkmark-circle-outline', tone: 'positive' },
  event_invite_declined: { icon: 'close-circle-outline', tone: 'neutral' },
  event_time_changed: { icon: 'time-outline', tone: 'pending' },
  member_reported: { icon: 'flag-outline', tone: 'pending' },
  crew_request_received: { icon: 'person-add-outline', tone: 'pending' },
  crew_request_accepted: { icon: 'people-outline', tone: 'positive' },
  verification_approved: { icon: 'shield-checkmark-outline', tone: 'positive' },
  verification_rejected: { icon: 'shield-outline', tone: 'neutral' },
  new_message: { icon: 'chatbubble-ellipses-outline', tone: 'pending' },
};

// How long the Undo bar stays up after a swipe. The rows are already dismissed server-side
// (dismissed_at) by then; Undo just clears it again.
const UNDO_WINDOW_MS = 10_000;

function timeAgo(iso: string) {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

type PendingUndo = { notificationIds: string[] };

export default function ActivityScreen() {
  const insets = useSafeAreaInsets();
  const scrollY = useRef(new Animated.Value(0)).current;
  const { getUserById } = useApp();
  const { notifications, markAsRead, markAllAsRead, dismissNotifications, restoreNotifications } = useNotifications();
  const { colors, shadow } = useTheme();

  // One Undo bar covers every swipe made while it's showing; each new swipe restarts the 10s.
  const [pendingUndo, setPendingUndo] = useState<PendingUndo | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (undoTimer.current) clearTimeout(undoTimer.current);
  }, []);

  const queueUndo = (entry: PendingUndo) => {
    setPendingUndo((prev) => ({
      notificationIds: [...(prev?.notificationIds ?? []), ...entry.notificationIds],
    }));
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setPendingUndo(null), UNDO_WINDOW_MS);
  };

  const removeNotification = (id: string) => {
    dismissNotifications([id]);
    queueUndo({ notificationIds: [id] });
  };

  const undo = () => {
    if (!pendingUndo) return;
    if (undoTimer.current) clearTimeout(undoTimer.current);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    restoreNotifications(pendingUndo.notificationIds);
    setPendingUndo(null);
  };

  const openNotification = (notification: AppNotification) => {
    markAsRead(notification.id);
    if (notification.data.route) {
      router.push(notification.data.route as never);
    }
  };

  const unread = notifications.filter((item) => !item.readAt);
  const earlier = notifications.filter((item) => item.readAt);
  const hasContent = notifications.length > 0;
  const undoCount = pendingUndo ? pendingUndo.notificationIds.length : 0;

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

  const sectionTitle = (label: string) => (
    <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase', marginTop: 6 }}>
      {label}
    </Text>
  );

  const renderNotification = (notification: AppNotification) => {
    const isUnread = !notification.readAt;
    const user = notification.data.actorId ? getUserById(notification.data.actorId) : undefined;
    const { icon, tone } = NOTIFICATION_PRESENTATION[notification.type] ?? NOTIFICATION_PRESENTATION.join_request_rejected;
    const accent = tone === 'positive' ? colors.status.success.bg : tone === 'pending' ? colors.status.warning.bg : colors.status.info.bg;
    const iconColor = tone === 'positive' ? colors.status.success.text : tone === 'pending' ? colors.status.warning.text : colors.status.info.text;

    return (
      <SwipeToDismiss key={notification.id} onDismiss={() => removeNotification(notification.id)}>
        <TapPressable
          onPress={() => openNotification(notification)}
          style={{
            // Unread rows are white cards; read ones sit flat on the page.
            backgroundColor: isUnread ? colors.card : 'transparent',
            borderRadius: 20,
            borderWidth: isUnread ? 1 : 0,
            borderColor: colors.primary + '40',
            paddingVertical: 12,
            paddingHorizontal: 14,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <View>
            {user ? (
              <AvatarBubble user={user} size={42} />
            ) : (
              <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: accent, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={icon} size={19} color={iconColor} />
              </View>
            )}
            {user ? (
              <View
                style={{
                  position: 'absolute',
                  right: -3,
                  bottom: -3,
                  width: 20,
                  height: 20,
                  borderRadius: 10,
                  backgroundColor: accent,
                  borderWidth: 2,
                  borderColor: isUnread ? colors.card : colors.page,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name={icon} size={11} color={iconColor} />
              </View>
            ) : null}
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text numberOfLines={2} style={{ color: colors.text, fontSize: 14.5, fontWeight: isUnread ? '800' : '600', lineHeight: 20 }}>
              {notification.title}
            </Text>
            <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 13 }}>
              {notification.body}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 6 }}>
            <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: '700' }}>{timeAgo(notification.createdAt)}</Text>
            {isUnread ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary }} /> : null}
          </View>
        </TapPressable>
      </SwipeToDismiss>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <Animated.View style={{ backgroundColor: colors.primary, paddingTop: insets.top + 14, paddingHorizontal: 20, paddingBottom: headerPaddingBottom, gap: 3 }}>
        <CtaFill variant="header" />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: '#FFFFFF', fontSize: 32, fontWeight: '900', letterSpacing: -0.5 }}>Activity</Text>
          {unread.length ? (
            <Pressable onPress={markAllAsRead} style={{ paddingVertical: 6, paddingHorizontal: 4 }}>
              <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '700' }}>Mark all read</Text>
            </Pressable>
          ) : null}
        </View>
        <Animated.Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14, opacity: subtitleOpacity }}>
          {hasContent ? 'Swipe a notification sideways to remove it' : 'Updates and approvals'}
        </Animated.Text>
      </Animated.View>

      <ScrollView
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
        scrollEventThrottle={16}
        contentContainerStyle={{ padding: 20, gap: 10, paddingBottom: 170 }}
      >
        {unread.length ? (
          <>
            {sectionTitle('New')}
            {unread.map(renderNotification)}
          </>
        ) : null}

        {earlier.length ? (
          <>
            {sectionTitle('Earlier')}
            {earlier.map(renderNotification)}
          </>
        ) : null}

        {!hasContent ? (
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 28,
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

      {pendingUndo ? (
        // Same look as the app's SuccessToast: card surface, theme shadow, plain text action.
        <View
          style={{
            position: 'absolute',
            left: 20,
            right: 20,
            bottom: Math.max(insets.bottom, 12) + 88,
            backgroundColor: colors.card,
            borderRadius: 20,
            paddingVertical: 14,
            paddingLeft: 16,
            paddingRight: 8,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            ...shadow.lift,
          }}
        >
          <Icon name="trash-outline" size={18} color={colors.muted} />
          <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700', flex: 1 }}>
            {undoCount === 1 ? 'Notification removed' : `${undoCount} notifications removed`}
          </Text>
          <Pressable onPress={undo} hitSlop={8} style={{ paddingHorizontal: 12, paddingVertical: 6 }}>
            <Text style={{ color: colors.primary, fontSize: 14, fontWeight: '800' }}>Undo</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
