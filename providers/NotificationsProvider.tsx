import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/utils/supabase';
import { useApp } from '@/providers/AppProvider';
import type { AppNotification } from '@/lib/types';

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

type NotificationsContextValue = {
  notifications: AppNotification[];
  unreadCount: number;
  isLoading: boolean;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
};

const NotificationsContext = createContext<NotificationsContextValue | undefined>(undefined);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { currentUser } = useApp();
  const userId = currentUser?.id;
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setNotifications([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
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
      .is('read_at', null)
      .then(({ error }) => {
        if (error) console.error('Error marking all notifications as read:', error);
      });
  };

  const unreadCount = notifications.filter((item) => !item.readAt).length;

  return (
    <NotificationsContext.Provider value={{ notifications, unreadCount, isLoading, markAsRead, markAllAsRead }}>
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
