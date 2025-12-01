import React from 'react';
import { Button } from '@/components/ui/button';
import ColorBubbles from './ColorBubbles';

const NotificationItem = ({ 
  icon: Icon, 
  iconColor, 
  title, 
  description, 
  time, 
  onView, 
  onDismiss, 
  type, 
  metadata,
  notificationCategory,
  colors,
  jobId,
  status 
}) => {
  const showColorBubbles = colors && Array.isArray(colors) && colors.length > 0;
  
  // Category-based styling
  const getCategoryStyles = (category) => {
    switch (category) {
      case 'job':
        return 'border-l-4 border-l-blue-500/30 bg-blue-50/30 dark:bg-blue-900/10';
      case 'color':
        return 'border-l-4 border-l-purple-500/30 bg-purple-50/30 dark:bg-purple-900/10';
      default:
        return 'border-l-4 border-l-muted';
    }
  };

  return (
    <div className={`p-4 flex items-center justify-between hover:bg-muted/50 transition-all duration-200 ${getCategoryStyles(notificationCategory)}`}>
      <div className="flex items-center space-x-4 flex-1 min-w-0">
        <div className="flex-shrink-0">
          <Icon className={`h-5 w-5 ${iconColor}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2 mb-1">
            <p className="font-medium text-foreground truncate">{title}</p>
            {showColorBubbles && (
              <ColorBubbles 
                colors={colors} 
                size="xs" 
                maxVisible={3}
                className="flex-shrink-0"
              />
            )}
          </div>
          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
            <span className="truncate">{description}</span>
            {jobId && (
              <span className="text-xs bg-muted px-1.5 py-0.5 rounded-md font-mono flex-shrink-0">
                {jobId}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center space-x-3 flex-shrink-0 ml-4">
        <p className="text-xs text-muted-foreground whitespace-nowrap">{time}</p>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={onView}>
            View
          </Button>
          <Button variant="ghost" size="sm" onClick={onDismiss}>
            ×
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotificationItem;