import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useProfile } from '@/context/ProfileContext';
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
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { LogOut, ChevronDown, User, Share2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import NotificationDropdown from '@/components/notifications/NotificationDropdown';
import GetSharingCodeDialog from '@/components/admin/my-company/GetSharingCodeDialog';
import SharingCodeRequirementsDialog from '@/components/admin/my-company/SharingCodeRequirementsDialog';
import { supabase } from '@/lib/customSupabaseClient';

const AppHeader = () => {
    const navigate = useNavigate();
    const { signOut } = useAuth();
    const { profile } = useProfile();
    const [isGetCodeOpen, setIsGetCodeOpen] = useState(false);
    const [isRequirementsOpen, setIsRequirementsOpen] = useState(false);
    const [organization, setOrganization] = useState(null);
    const [locations, setLocations] = useState([]);
  
    const handleLogout = async () => {
      await signOut();
      navigate('/login');
    };

    const handleSwitchUser = async () => {
        await signOut();
        navigate('/login');
    };

    const getInitials = (name) => {
        if (!name) return 'U';
        const names = name.split(' ');
        if (names.length > 1 && names[0] && names[names.length - 1]) {
            return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    };

    const fetchOrgAndLocations = useCallback(async () => {
        if (!profile?.organization_id) return;
        
        const [{ data: org }, { data: locs }] = await Promise.all([
            supabase.from('organizations').select('*').eq('id', profile.organization_id).single(),
            supabase.from('organization_locations').select('*').eq('organization_id', profile.organization_id).order('name'),
        ]);
        
        setOrganization(org || null);
        setLocations(locs || []);
    }, [profile?.organization_id]);

    useEffect(() => {
        fetchOrgAndLocations();
    }, [fetchOrgAndLocations]);

    return (
        <header className="flex items-center justify-end h-16 px-6 bg-white border-b">
            <div className="flex items-center gap-4">
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => {
                                    const hideDialog = localStorage.getItem('hideSharingCodeRequirementsDialog');
                                    if (hideDialog === 'true') {
                                        setIsGetCodeOpen(true);
                                    } else {
                                        setIsRequirementsOpen(true);
                                    }
                                }}
                            >
                                <Share2 className="h-5 w-5" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Create Sharing Code</p>
                        </TooltipContent>
                    </Tooltip>
                    <NotificationDropdown />
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
                            <DropdownMenuItem onClick={handleSwitchUser}>
                                <LogOut className="mr-2 h-4 w-4" />
                                <span>Switch User</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={handleLogout} className="text-red-500 focus:text-red-600 focus:bg-red-50">
                                <LogOut className="mr-2 h-4 w-4" />
                                <span>Log out</span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </TooltipProvider>
            </div>
            <SharingCodeRequirementsDialog 
                open={isRequirementsOpen}
                onOpenChange={setIsRequirementsOpen}
                onProceed={() => setIsGetCodeOpen(true)}
            />
            <GetSharingCodeDialog 
                isOpen={isGetCodeOpen} 
                setIsOpen={setIsGetCodeOpen} 
                organization={organization} 
                locations={locations} 
            />
        </header>
    );
};

export default AppHeader;
