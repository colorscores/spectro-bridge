
import { useNotificationsContext } from '@/contexts/NotificationsContext';

// Main notifications hook - now uses shared context
export function useNotifications() {
  return useNotificationsContext();
}

// Lightweight count-only hook for headers - now uses shared context
export function useUnreadNotificationsCount() {
  try {
    const { unreadCount } = useNotificationsContext();
    return unreadCount;
  } catch (error) {
    console.error('Error in useUnreadNotificationsCount:', error);
    return 0;
  }
}
