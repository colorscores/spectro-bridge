import React from 'react';
import { Button } from '@/components/ui/button';
import { useNotifications } from '@/hooks/useNotifications';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '@/context/AppContext';
import { formatDistanceToNow } from 'date-fns';
import { ClipboardList, CheckCircle, FileText, Bell, Info, Briefcase, Palette, UserPlus, Clock, Target } from 'lucide-react';
import ColorBubbles from '@/components/dashboard/ColorBubbles';
import { shouldShowColorBubbles, extractNotificationColors, formatStandardizedNotificationMessage } from '@/lib/notificationUtils';
import { handleNotificationNavigation } from '@/lib/notificationRouting';

const NotificationDropdownItem = ({ notification }) => {
  const { dismiss } = useNotifications();
  const { setAppMode, setNavGroupSelections } = useAppContext();
  const navigate = useNavigate();

  const getNotificationIcon = (type, metadata) => {
    // Special handling for routed notifications
    if (metadata?.receiver_role === 'routed-to') {
      return Briefcase;
    }
    
    switch (type) {
      // Job status notifications from database triggers
      case 'job_new':
      case 'job_routed':
      case 'job_status_new':
      case 'job_status_routed':
      case 'job_status_pending_approval':
      case 'job_status_approved':
      case 'job_status_working':
      case 'job_status_completed':
      case 'job_status_overdue':
      case 'job_status_rejected':
      case 'job_status_update':
        return Briefcase;
      
      // Legacy role-aware job status notifications  
      case 'job_status_brand':
      case 'job_status_printer': 
      case 'job_status_ink_supplier':
        return Briefcase;
      
      // Match workflow notifications
      case 'match_request':
        return Briefcase;
      case 'match_update':
        return CheckCircle;
      case 'match_measurement':
        return FileText;
      case 'match_sent_for_approval':
      case 'sent-to-shared-with-for-approval':
      case 'sent-to-requestor-for-approval':
        return Palette;
      case 'match_routed':
      case 'job_routed':
        return Briefcase;
      case 'match_rejected':
        return Clock;
      case 'match_approved':
        return Palette;
      case 'approved-by-requestor':
      case 'approved-by-shared-with':
      case 'approved-by-routed-to':
        return CheckCircle;
      case 'rejected-by-requestor':
      case 'rejected-by-shared-with':
      case 'rejected-by-routed-to':
        return Clock;
      
      // Assignment and completion notifications
      case 'job_assignment':
        return UserPlus;
      case 'job_completed':
        return CheckCircle;
      
      // Color work notifications
      case 'color_shared':
      case 'color_approved':
      case 'color_rejected':
      case 'color_updated':
      case 'partner_share_update':
        return Palette;
      
      // Partner notifications
      case 'partner_invite':
        return Bell;
      case 'partner_status':
        return Info;
      
      default:
        return Bell;
    }
  };

  const getIconColor = (type, status) => {
    // Job status notifications - color based on urgency and state
    if (type.startsWith('job_status_') || type === 'job_new' || type === 'job_routed') {
      if (status === 'Pending Approval' || status === 'Ready for Approval') return 'text-orange-500';
      if (status === 'Approved' || status === 'Completed') return 'text-green-500';
      if (status === 'In Progress' || status === 'Working') return 'text-blue-500';
      if (status === 'Overdue') return 'text-red-500';
      return 'text-primary';
    }
    
    // Color work notifications
    if (type.startsWith('color_') || type === 'partner_share_update') return 'text-purple-500';
    
    // Assignment and completion
    if (type === 'job_assignment') return 'text-blue-500';
    if (type === 'job_completed') return 'text-green-500';
    
    // Match workflow notifications
    if (type === 'match_sent_for_approval' || type === 'sent-to-shared-with-for-approval' || type === 'sent-to-requestor-for-approval') return 'text-blue-500';
    if (type === 'match_routed' || type === 'job_routed') return 'text-orange-500';
    if (type === 'match_rejected') return 'text-red-500';
    if (type === 'match_approved') return 'text-green-500';
    if (type.startsWith('approved-by-')) return 'text-green-500';
    if (type.startsWith('rejected-by-')) return 'text-red-500';
    
    // Legacy types
    switch (type) {
      case 'job_new':
      case 'match_request':
        return 'text-primary';
      case 'match_update':
        return 'text-green-500';
      case 'partner_invite':
        return 'text-blue-500';
      case 'partner_status':
        return 'text-amber-500';
      default:
        return 'text-muted-foreground';
    }
  };

  const formatNotificationTime = (createdAt) => {
    if (!createdAt) {
      console.warn('⏰ Missing timestamp in notification:', notification.id);
      return 'Unknown time';
    }
    
    try {
      let date;
      if (typeof createdAt === 'string') {
        date = new Date(createdAt);
        if (isNaN(date.getTime())) {
          const cleanedDate = createdAt.replace(/(\.\d{3})\d+/, '$1');
          date = new Date(cleanedDate);
        }
      } else {
        date = new Date(createdAt);
      }
      
      if (isNaN(date.getTime())) {
        console.warn('⏰ Invalid timestamp in notification:', { id: notification.id, createdAt });
        return 'Unknown time';
      }
      
      const formatted = formatDistanceToNow(date, { addSuffix: true });
      
      return formatted;
    } catch (error) {
      console.error('⏰ Error formatting time:', { createdAt, error });
      return 'Unknown time';
    }
  };

  const handleView = async () => {
    
    await handleNotificationNavigation(notification, navigate, setAppMode, setNavGroupSelections);
  };

  const handleDismiss = () => {
    const ids = notification.consolidatedFrom || [notification.id];
    dismiss(ids);
  };

  const Icon = getNotificationIcon(notification.type, notification.metadata);
  // Use pre-enriched colors from processedNotifications context
  const colors = notification.colors || [];
  const jobId = notification.metadata?.job_id || notification.metadata?.match_request_id;
  
  // Show color bubbles for relevant notification types
  const showColorBubbles = colors.length > 0 && shouldShowColorBubbles(notification.type, notification.metadata);
  
  // SIMPLIFIED: Use database title/message directly, only format as fallback
  const displayTitle = notification.title || notification._raw?.title;
  const displayMessage = notification.message || notification.description || notification._raw?.message;

  // Fallback to formatting ONLY if database didn't provide values (legacy notifications)
  const fallbackFormatted = (!displayTitle || !displayMessage) 
    ? formatStandardizedNotificationMessage(notification.type, notification.metadata)
    : null;

  const standardizedMessage = {
    title: displayTitle || fallbackFormatted?.title || 'Notification',
    message: displayMessage || fallbackFormatted?.message || 'You have a new notification'
  };

  // Category-based styling
  const getCategoryStyles = (type, metadata) => {
    // Check for routed notifications
    if (metadata?.receiver_role === 'routed-to' || type.startsWith('job_status_') || type === 'job_new' || type === 'job_routed' || type === 'match_request') return 'border-l-2 border-l-blue-500/30 bg-blue-50/20 dark:bg-blue-900/10';
    if (type.startsWith('color_') || type === 'partner_share_update') return 'border-l-2 border-l-purple-500/30 bg-purple-50/20 dark:bg-purple-900/10';
    return '';
  };

  return (
    <div className={`p-3 hover:bg-muted/50 transition-colors ${getCategoryStyles(notification.type, notification.metadata)}`}>
      <div className="flex items-start gap-3">
        <Icon className={`h-5 w-5 mt-0.5 flex-shrink-0 ${getIconColor(notification.type, notification.metadata?.status)}`} />
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="font-semibold text-sm text-foreground line-clamp-1">
              {standardizedMessage.title}
            </p>
            {showColorBubbles && (
              <ColorBubbles colors={colors} maxVisible={3} size="xs" />
            )}
          </div>
          
          <div className="flex flex-col gap-1 mb-2">
            <p className="text-sm text-muted-foreground line-clamp-2">
              {standardizedMessage.message}
            </p>
            {jobId && (
              <span className="text-xs bg-muted px-1.5 py-0.5 rounded-md font-mono w-fit">
                {jobId}
              </span>
            )}
          </div>
          
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {formatNotificationTime(notification.created_at || notification._raw?.created_at)}
            </p>
            
            <div className="flex gap-1">
              <Button variant="outline" size="sm" onClick={handleView} className="h-7 px-2 text-xs">
                View
              </Button>
              <Button variant="ghost" size="sm" onClick={handleDismiss} className="h-7 px-2 text-xs">
                ×
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationDropdownItem;