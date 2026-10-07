import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { router } from 'expo-router';
import { supabase } from '@/utils/supabase';
import { useApp } from '@/providers/AppProvider';
import { setRegisteredPushToken } from '@/lib/pushToken';
import type { AppNotification } from '@/lib/types';

// expo-notifications registers a device push-token listener as an import-time side effect
// (DevicePushTokenAutoRegistration.fx), which throws on Android in Expo Go — remote push was
// removed from Expo Go in SDK 53. Load the module lazily and only outside Expo Go so merely
// opening the app in Expo Go doesn't crash; dev/standalone builds get full functionality.
const isExpoGo = Constants.appOwnership === 'expo';
const Notifications: typeof import('expo-notifications') | null = isExpoGo
  ? null
  : require('expo-notifications');

// The chat screen currently in focus, set by app/chat/[id].tsx. Module-level because the
// foreground handler below is registered once at module scope, outside React.
let activeChatEventId: string | null = null;

export function setActiveChatEventId(eventId: string | null) {
  activeChatEventId = eventId;
}

// Clears this plan's grouped chat push (send-push tags them per plan) from the system tray once
// the chat is opened, the same way opening a WhatsApp chat clears its notification.
export async function dismissChatPushes(eventId: string) {
  if (!Notifications) return;
  try {
    const presented = await Notifications.getPresentedNotificationsAsync();
    await Promise.all(
      presented
        .filter((item) => item.request.content.data?.route === `/chat/${eventId}`)
        .map((item) => Notifications.dismissNotificationAsync(item.request.identifier))
    );
  } catch (err) {
    console.log('Could not dismiss chat notifications:', err);
  }
}

// Standard Expo-recommended foreground behavior (show the OS banner/sound like any other app),
// except a chat push for the chat that's already open on screen: no banner or sound, since the
// message is already visible there.
Notifications?.setNotificationHandler({
  handleNotification: async (notification) => {
    const route = notification.request.content.data?.route;
    const isOpenChat = !!activeChatEventId && route === `/chat/${activeChatEventId}`;
    return {
      shouldShowBanner: !isOpenChat,
      shouldShowList: !isOpenChat,
      shouldPlaySound: !isOpenChat,
      shouldSetBadge: false,
    };
  },
});

const mapNotificationRow = (row: any): AppNotification => ({
  id: row.id,
  userId: row.user_id,
  type: row.type,
  title: row.title,
  body: row.body,
  data: row.data ?? {},
  readAt: row.read_at,
  createdAt: row.created_at,
});

// `new_message` rows exist so the push webhook fires for chat, but they don't belong in the
// Activity inbox. They're kept separately and only surface as an unread dot on the plan
// (`getUnreadChatCount`), cleared when that plan's chat is opened (`markChatRead`).
const isChatNotification = (notification: AppNotification) => notification.type === 'new_message';

type NotificationsContextValue = {
  notifications: AppNotification[];
  unreadCount: number;
  isLoading: boolean;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  getUnreadChatCount: (eventId: string) => number;
  markChatRead: (eventId: string) => void;
};

const NotificationsContext = createContext<NotificationsContextValue | undefined>(undefined);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { currentUser } = useApp();
  const userId = currentUser?.id;
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadChatNotifications, setUnreadChatNotifications] = useState<AppNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setNotifications([]);
      setUnreadChatNotifications([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    // Fetched separately so a busy chat can't push real inbox items out of the 100-row window.
    supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .eq('type', 'new_message')
      .is('read_at', null)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error('Error fetching unread chat notifications:', error);
        } else if (data) {
          setUnreadChatNotifications(data.map(mapNotificationRow));
        }
      });

    supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .neq('type', 'new_message')
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error('Error fetching notifications:', error);
        } else if (data) {
          setNotifications(data.map(mapNotificationRow));
        }
        setIsLoading(false);
      });

    const channel = supabase
      .channel(`notifications-realtime-${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => {
          const notification = mapNotificationRow(payload.new);
          if (isChatNotification(notification)) {
            setUnreadChatNotifications((prev) =>
              prev.some((item) => item.id === notification.id) ? prev : [...prev, notification]
            );
            return;
          }
          setNotifications((prev) =>
            prev.some((item) => item.id === notification.id) ? prev : [notification, ...prev]
          );
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // Android requires a notification channel before any notification can be shown
  // (platform requirement since API 26) — not app-specific behavior.
  useEffect(() => {
    if (Notifications && Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
  }, []);

  // Register/unregister this device's Expo push token for the signed-in user. Uses only
  // expo-notifications' standard permission + token APIs (no custom pre-permission UI).
  // Wrapped so a missing platform credential (e.g. no APNs key configured for iOS yet)
  // just skips registration instead of throwing — the rest of the app keeps working, and
  // nothing here needs to change once that credential is added later.
  useEffect(() => {
    if (!userId) {
      return;
    }

    let cancelled = false;

    const registerForPushNotifications = async () => {
      if (!Notifications || !Device.isDevice) {
        return;
      }

      try {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        if (finalStatus !== 'granted' || cancelled) {
          return;
        }

        const projectId = Constants.expoConfig?.extra?.eas?.projectId;
        if (!projectId) {
          return;
        }

        const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
        if (cancelled || !token) {
          return;
        }

        // Dev builds only: the token alone is enough to send pushes to this device, so keep it
        // out of release logs. Paste it into https://expo.dev/notifications to test delivery.
        if (__DEV__) {
          console.log('[push] Expo push token:', token);
        }

        setRegisteredPushToken({ userId, token });
        const { error } = await supabase
          .from('push_tokens')
          .upsert(
            { user_id: userId, token, platform: Platform.OS, updated_at: new Date().toISOString() },
            { onConflict: 'user_id,token' }
          );
        if (error) {
          console.error('Error saving push token:', error);
        }
      } catch (err) {
        console.log('Push notification registration skipped:', err);
      }
    };

    registerForPushNotifications();

    // Removing the token isn't done here: by the time userId goes null the session is already
    // gone and the delete would be refused by RLS. AppProvider.logout() calls
    // unregisterPushToken() before signing out instead.
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Standard tap-to-open handling — deep-links using the same `route` the in-app list uses.
  useEffect(() => {
    if (!Notifications) return;
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const route = response.notification.request.content.data?.route as string | undefined;
      if (route) {
        router.push(route as never);
      }
    });
    return () => subscription.remove();
  }, []);

  const markAsRead = (id: string) => {
    const target = notifications.find((item) => item.id === id);
    if (!target || target.readAt) {
      return;
    }
    const readAt = new Date().toISOString();
    setNotifications((prev) => prev.map((item) => (item.id === id ? { ...item, readAt } : item)));
    supabase
      .from('notifications')
      .update({ read_at: readAt })
      .eq('id', id)
      .then(({ error }) => {
        if (error) console.error('Error marking notification as read:', error);
      });
  };

  const markAllAsRead = () => {
    const unreadIds = notifications.filter((item) => !item.readAt).map((item) => item.id);
    if (!unreadIds.length || !userId) {
      return;
    }
    const readAt = new Date().toISOString();
    setNotifications((prev) => prev.map((item) => (item.readAt ? item : { ...item, readAt })));
    supabase
      .from('notifications')
      .update({ read_at: readAt })
      .eq('user_id', userId)
      .neq('type', 'new_message')
      .is('read_at', null)
      .then(({ error }) => {
        if (error) console.error('Error marking all notifications as read:', error);
      });
  };

  const markChatRead = (eventId: string) => {
    if (!userId || !unreadChatNotifications.some((item) => item.data.eventId === eventId)) {
      return;
    }
    setUnreadChatNotifications((prev) => prev.filter((item) => item.data.eventId !== eventId));
    supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('type', 'new_message')
      .eq('data->>eventId', eventId)
      .is('read_at', null)
      .then(({ error }) => {
        if (error) console.error('Error marking chat notifications as read:', error);
      });
  };

  const unreadCount = notifications.filter((item) => !item.readAt).length;
  const unreadChatCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of unreadChatNotifications) {
      if (item.data.eventId) counts.set(item.data.eventId, (counts.get(item.data.eventId) ?? 0) + 1);
    }
    return counts;
  }, [unreadChatNotifications]);
  const getUnreadChatCount = (eventId: string) => unreadChatCounts.get(eventId) ?? 0;

  return (
    <NotificationsContext.Provider
      value={{ notifications, unreadCount, isLoading, markAsRead, markAllAsRead, getUnreadChatCount, markChatRead }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationsProvider');
  }
  return context;
}
