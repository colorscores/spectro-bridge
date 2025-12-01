import React from 'react';
import NotificationItem from '@/components/dashboard/NotificationItem';
import { useNotifications } from '@/hooks/useNotifications';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '@/context/AppContext';
import { Calendar, Bell, AlertTriangle, CheckCircle, Info, FileText, ClipboardList, RefreshCw, Briefcase, Target } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { handleNotificationNavigation } from '@/lib/notificationRouting';
import { formatStandardizedNotificationMessage } from '@/lib/notificationUtils';

const Notifications = () => {
  const { processedNotifications, dismiss, refresh, loading } = useNotifications();
  const { setAppMode, setNavGroupSelections } = useAppContext();
  const navigate = useNavigate();

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'match_request':
        return Briefcase;
      case 'match_update':
        return CheckCircle;
      case 'match_measurement':
        return FileText;
      case 'match_sent_for_approval':
      case 'sent-to-shared-with-for-approval':
      case 'sent-to-requestor-for-approval':
        return ClipboardList;
      case 'match_routed':
      case 'job_routed':
        return Briefcase;
      case 'partner_invite':
        return Bell;
      case 'partner_status':
        return Info;
      default:
        return Bell;
    }
  };

  const getIconColor = (type) => {
    switch (type) {
      case 'match_request':
        return 'text-primary';
      case 'match_update':
        return 'text-green-500';
      case 'match_sent_for_approval':
      case 'sent-to-shared-with-for-approval':
      case 'sent-to-requestor-for-approval':
        return 'text-primary';
      case 'match_routed':
      case 'job_routed':
        return 'text-orange-500';
      case 'partner_invite':
        return 'text-blue-500';
      case 'partner_status':
        return 'text-amber-500';
      default:
        return 'text-muted-foreground';
    }
  };

  const handleView = async (notification) => {
    
    await handleNotificationNavigation(notification, navigate, setAppMode, setNavGroupSelections);
  };

  const handleDismiss = (notification) => {
    const ids = notification.consolidatedFrom || [notification.id];
    dismiss(ids);
  };

  const formatNotificationTime = (createdAt) => {
    if (!createdAt) return 'Unknown time';
    
    try {
      // Handle different timestamp formats more robustly
      let date;
      if (typeof createdAt === 'string') {
        // Try parsing as-is first
        date = new Date(createdAt);
        // If that fails, try cleaning up the string
        if (isNaN(date.getTime())) {
          // Remove microseconds if present and try again
          const cleanedDate = createdAt.replace(/(\.\d{3})\d+/, '$1');
          date = new Date(cleanedDate);
        }
      } else {
        date = new Date(createdAt);
      }
      
      if (isNaN(date.getTime())) {
        console.warn('Invalid date in notification:', createdAt);
        return 'Unknown time';
      }
      
      return formatDistanceToNow(date, { addSuffix: true });
    } catch (error) {
      console.warn('Error parsing date in notification:', createdAt, error);
      return 'Unknown time';
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-medium text-muted-foreground">Notifications</h2>
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-md border border-muted text-muted-foreground hover:bg-accent/30 disabled:opacity-60 disabled:cursor-not-allowed transition"
          aria-label="Refresh notifications"
          title="Refresh notifications"
        >
          <RefreshCw className="h-4 w-4" />
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>
      <div className="bg-card rounded-xl border border-muted overflow-hidden">
        <div className="divide-y divide-muted max-h-52 overflow-y-auto">
            {processedNotifications && processedNotifications.length > 0 ? (
              processedNotifications.map((notification) => {
                // SIMPLIFIED: Use database values directly
                return (
                  <NotificationItem 
                    key={notification.id}
                    icon={notification.icon}
                    iconColor={notification.iconColor}
                    title={notification.title || 'Notification'}
                    description={notification.description || notification.message || 'You have a notification'}
                    time={notification.time}
                    type={notification.type}
                    metadata={notification.metadata}
                    notificationCategory={notification.notificationCategory}
                    colors={notification.colors}
                    jobId={notification.jobId}
                    status={notification.status}
                    onView={() => handleView(notification)}
                    onDismiss={() => handleDismiss(notification)}
                  />
                );
              })
            ) : (
              <div className="p-4 flex items-center justify-center">
                <p className="text-sm text-muted-foreground">No new notifications.</p>
              </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default Notifications;