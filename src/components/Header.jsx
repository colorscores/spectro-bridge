import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LogOut, ChevronDown, Bell, Search, User } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useNavigate } from 'react-router-dom';
import { useUnreadNotificationsCount } from '@/hooks/useNotifications';

const Header = () => {
    const navigate = useNavigate();
    const { signOut, profile } = useAuth();
    const unreadCount = useUnreadNotificationsCount();
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
    
  
    const handleLogout = async () => {
      await signOut();
      navigate('/login');
    };

    const getInitials = (name) => {
        if (!name) return 'U';
        const names = name.split(' ');
        if (names.length > 1) {
            return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    };

    return (
        <header className="flex items-center justify-between h-16 px-6 bg-white border-b">
            <div className="flex items-center gap-4">
                <div className="relative w-full max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input placeholder="Search..." className="pl-10 bg-gray-100 border-none focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/40" />
                </div>
            </div>
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')} className="relative">
                    <Bell className={`h-5 w-5 ${shouldRing ? 'animate-ring-bell' : ''}`} />
                    <span className="sr-only">Notifications</span>
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-[1.25rem] h-5 px-1 rounded-full bg-red-600 text-white text-[10px] leading-5 text-center font-semibold">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                </Button>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="relative h-10 justify-start pl-2 pr-2">
                            <Avatar className="h-8 w-8 mr-2">
                                <AvatarImage alt={profile?.full_name || 'User Avatar'} src={profile?.avatar_url} />
                                <AvatarFallback>{getInitials(profile?.full_name)}</AvatarFallback>
                            </Avatar>
                            <div className="text-left hidden sm:block">
                                <p className="text-sm font-semibold text-gray-800">{profile?.full_name || 'User'}</p>
                            </div>
                            <ChevronDown className="h-4 w-4 text-gray-500 ml-2" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56" align="end">
                        <DropdownMenuLabel>My Account</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => navigate('/my-profile')}>
                            <User className="mr-2 h-4 w-4" />
                            <span>Profile</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => alert("🚧 This feature isn't implemented yet—but don't worry! You can request it in your next prompt! 🚀")}>Billing</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => alert("🚧 This feature isn't implemented yet—but don't worry! You can request it in your next prompt! 🚀")}>Settings</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={handleLogout} className="text-red-500 focus:text-red-600 focus:bg-red-50">
                            <LogOut className="mr-2 h-4 w-4" />
                            <span>Log out</span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </header>
    );
};

export default Header;