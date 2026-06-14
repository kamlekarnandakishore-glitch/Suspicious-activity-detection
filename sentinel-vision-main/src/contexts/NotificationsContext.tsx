import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { UiAlert } from "@/lib/alerts";

export interface LiveNotification extends UiAlert {
  read: boolean;
  receivedAt: number;
}

interface NotificationsContextValue {
  notifications: LiveNotification[];
  unreadCount: number;
  pushNotification: (alert: UiAlert) => void;
  markAllRead: () => void;
  markRead: (id: string) => void;
  clearAll: () => void;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

const MAX_NOTIFICATIONS = 50;

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<LiveNotification[]>([]);

  const pushNotification = useCallback((alert: UiAlert) => {
    setNotifications((prev) => {
      if (prev.some((n) => n.id === alert.id)) return prev;
      const next: LiveNotification = {
        ...alert,
        read: false,
        receivedAt: Date.now(),
      };
      return [next, ...prev].slice(0, MAX_NOTIFICATIONS);
    });
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const markRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  const clearAll = useCallback(() => setNotifications([]), []);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      pushNotification,
      markAllRead,
      markRead,
      clearAll,
    }),
    [notifications, unreadCount, pushNotification, markAllRead, markRead, clearAll]
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) {
    throw new Error("useNotifications must be used within NotificationsProvider");
  }
  return ctx;
}
