import React, { useState, useEffect, useRef } from 'react';
import { Popover, PopoverContent, PopoverTrigger, PopoverArrow } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Bell } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import NotificationDropdownItem from './NotificationDropdownItem';

const NotificationDropdown = () => {
  const { notifications, processedNotifications, loading, unreadCount, refresh, dismiss } = useNotifications();
  const [open, setOpen] = useState(false);
  const [shouldRing, setShouldRing] = useState(false);
  const prevUnreadCount = useRef(unreadCount);

  // Detect new notifications and trigger ring animation
  useEffect(() => {
    if (prevUnreadCount.current < unreadCount && unreadCount > 0) {
      setShouldRing(true);
      const timer = setTimeout(() => setShouldRing(false), 3600);
      return () => clearTimeout(timer);
    }
    prevUnreadCount.current = unreadCount;
  }, [unreadCount]);

  const handleOpenChange = (isOpen) => {
    setOpen(isOpen);
    if (isOpen) {
      refresh();
    }
  };

  const handleClearAll = () => {
    const allIds = processedNotifications.flatMap(n => 
      n.consolidatedFrom || [n.id]
    );
    dismiss(allIds);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className={`h-5 w-5 ${shouldRing ? 'animate-ring-bell' : ''}`} />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[1.25rem] h-5 px-1 rounded-full bg-red-600 text-white text-[10px] leading-5 text-center font-semibold">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 max-h-[500px] overflow-visible" align="end" sideOffset={4}>
        <PopoverArrow className="fill-white stroke-gray-200 dark:fill-gray-950 dark:stroke-gray-800" />
        <div className="rounded-lg">
          <div className="px-4 py-3 border-b border-border">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-foreground">Notifications</h3>
                {unreadCount > 0 && (
                  <p className="text-sm text-muted-foreground">
                    {unreadCount} unread notification{unreadCount === 1 ? '' : 's'}
                  </p>
                )}
              </div>
              {unreadCount > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={handleClearAll}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Clear all
                </Button>
              )}
            </div>
          </div>
          
          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center">
                <p className="text-sm text-muted-foreground">Loading notifications...</p>
              </div>
            ) : processedNotifications && processedNotifications.length > 0 ? (
              <div className="divide-y divide-border">
                {processedNotifications.map((notification) => (
                  <NotificationDropdownItem 
                    key={notification.id}
                    notification={notification}
                  />
                ))}
              </div>
            ) : (
              <div className="p-4 text-center">
                <Bell className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-50" />
                <p className="text-sm text-muted-foreground">No new notifications</p>
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationDropdown;