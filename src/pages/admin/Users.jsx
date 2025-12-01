import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import TableHeaderButton from '@/components/common/TableHeaderButton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { Search, UserPlus, Edit, Trash2, ArrowUpDown, ArrowUp, ArrowDown, Tags, Key } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import AddUserDialog from '@/components/admin/users/AddUserDialog';
import EditUserDialog from '@/components/admin/users/EditUserDialog';
import EditUserTagsDialog from '@/components/admin/users/EditUserTagsDialog';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useProfile } from '@/context/ProfileContext';
import { fetchAuthEmails, fetchSingleAuthEmail } from '@/lib/authEmailHelper';

const Users = () => {
  // using direct toast function (no hook)
  const { user: currentUser, resetPasswordForEmail } = useAuth();
  const { profile } = useProfile();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAddUserDialogOpen, setIsAddUserDialogOpen] = useState(false);
  const [isEditUserDialogOpen, setIsEditUserDialogOpen] = useState(false);
  const [isEditTagsDialogOpen, setIsEditTagsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [deleteMode, setDeleteMode] = useState('soft');
  const [transferToUserId, setTransferToUserId] = useState(null);
  const [userAssetCount, setUserAssetCount] = useState(null);
  const [loadingAssetCount, setLoadingAssetCount] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  const isSuperadmin = (profile?.role === 'Superadmin') || (currentUser?.user_metadata?.role === 'Superadmin');

  const fetchUsers = useCallback(async () => {
    setLoading(true);

    try {
      const orgId = profile?.organization_id;
      
      // For Admin users, ensure they only see their own organization's users
      if (profile?.role === 'Admin' && orgId) {
        console.log('Admin user detected - fetching org-specific users only');
        const { data, error } = await supabase
          .from('profiles')
          .select(`
            id,
            full_name,
            role,
            location,
            limit_by_tags,
            organization_id,
            organization:organizations (
              id,
              name
            ),
            user_sharing_tags (
              tag:tags (
                id,
                name,
                category:categories (
                  id,
                  name
                )
              )
            )
          `)
          .eq('organization_id', orgId)
          .is('deleted_at', null);
        
        if (error) throw error;

        let mapped = (data || []).map((p) => ({
          id: p.id,
          full_name: p.full_name,
          email: p.email || '',
          organization_name: p.organization?.name || 'N/A',
          organization_id: p.organization_id || p.organization?.id || null,
          role: p.role,
          limit_by_tags: !!p.limit_by_tags,
          tags: (p.user_sharing_tags || [])
            .map((ust) => ({
              id: ust?.tag?.id,
              name: ust?.tag?.name,
              categoryName: ust?.tag?.category?.name,
            }))
            .filter((t) => t && t.id),
          location: p.location,
        }));

        // Hydrate emails
        try {
          const allIds = mapped.map(u => u.id).filter(Boolean);
          if (allIds.length > 0) {
            const emailMap = await fetchAuthEmails(allIds);
            if (emailMap.size > 0) {
              mapped = mapped.map((u) => ({ ...u, email: emailMap.get(u.id) || '' }));
            }
          }
        } catch (_) {}

        setUsers(mapped);
        return;
      }
      
      if (!isSuperadmin && !orgId) {
        // Wait until profile/org is available
        setLoading(false);
        return;
      }
      if (isSuperadmin) {
        let mapped = [];
        try {
          const { data, error } = await supabase.functions.invoke('admin-list-profiles');

          if (error) throw error;

          mapped = (data || []).map((p) => ({
            id: p.id,
            full_name: p.full_name,
            email: p.email || '',
            organization_name: p.organization?.name || 'N/A',
            organization_id: p.organization_id || p.organization?.id || null,
            role: p.role,
            limit_by_tags: !!p.limit_by_tags,
            tags: (p.user_sharing_tags || [])
              .map((ust) => ({
                id: ust?.tag?.id,
                name: ust?.tag?.name,
                categoryName: ust?.tag?.category?.name,
              }))
              .filter((t) => t && t.id),
            location: p.location,
          }));

          // Hydrate emails via helper with robust fallbacks
          try {
            const allIds = mapped.map(u => u.id).filter(Boolean);
            if (allIds.length > 0) {
              const emailMap = await fetchAuthEmails(allIds);
              if (emailMap.size > 0) {
                mapped = mapped.map((u) => ({ ...u, email: emailMap.get(u.id) || '' }));
              }
            }
          } catch (_) {}

          setUsers(mapped);
        } catch (e) {
          // Fallback to org-limited query if edge function is unavailable or misconfigured
          const orgId = profile?.organization_id;
          if (!orgId) {
            setUsers([]);
            return;
          }
          
          const { data, error } = await supabase
            .from('profiles')
            .select(`
              id,
              full_name,
              role,
              location,
              limit_by_tags,
              organization_id,
              organization:organizations (
                id,
                name
              ),
              user_sharing_tags (
                tag:tags (
                  id,
                  name,
                  category:categories (
                    id,
                    name
                  )
                )
              )
            `)
            .eq('organization_id', orgId);
          if (error) throw error;

          mapped = (data || []).map((p) => ({
            id: p.id,
            full_name: p.full_name,
            email: p.email || '',
            organization_name: p.organization?.name || 'N/A',
            organization_id: p.organization_id || p.organization?.id || null,
            role: p.role,
            limit_by_tags: !!p.limit_by_tags,
            tags: (p.user_sharing_tags || [])
              .map((ust) => ({
                id: ust?.tag?.id,
                name: ust?.tag?.name,
                categoryName: ust?.tag?.category?.name,
              }))
              .filter((t) => t && t.id),
            location: p.location,
          }));

          try {
            const allIds = mapped.map(u => u.id).filter(Boolean);
            if (allIds.length > 0) {
              const emailMap = await fetchAuthEmails(allIds);
              if (emailMap.size > 0) {
                mapped = mapped.map((u) => ({ ...u, email: emailMap.get(u.id) || '' }));
              }
            }
          } catch (_) {}

          setUsers(mapped);
        }
      } else {
        const orgId = profile?.organization_id;
        const { data, error } = await supabase
          .from('profiles')
          .select(`
            id,
            full_name,
            role,
            location,
            limit_by_tags,
            organization_id,
            organization:organizations (
              id,
              name
            ),
            user_sharing_tags (
              tag:tags (
                id,
                name,
                category:categories (
                  id,
                  name
                )
              )
            )
          `)
          .eq('organization_id', orgId)
          .is('deleted_at', null);
        if (error) throw error;

        let mapped = (data || []).map((p) => ({
          id: p.id,
          full_name: p.full_name,
          email: p.email || '',
          organization_name: p.organization?.name || 'N/A',
          organization_id: p.organization_id || p.organization?.id || null,
          role: p.role,
          limit_by_tags: !!p.limit_by_tags,
          tags: (p.user_sharing_tags || [])
            .map((ust) => ({
              id: ust?.tag?.id,
              name: ust?.tag?.name,
              categoryName: ust?.tag?.category?.name,
            }))
            .filter((t) => t && t.id),
          location: p.location,
        }));

        // Hydrate emails via helper with robust fallbacks
        try {
          const allIds = mapped.map(u => u.id).filter(Boolean);
          if (allIds.length > 0) {
            const emailMap = await fetchAuthEmails(allIds);
            if (emailMap.size > 0) {
              mapped = mapped.map((u) => ({ ...u, email: emailMap.get(u.id) || '' }));
            }
          }
        } catch (_) {}

        setUsers(mapped);
      }
    } catch (error) {
      toast({ title: 'Error fetching users', description: error.message, variant: 'destructive' });
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [toast, profile?.role, profile?.organization_id, currentUser?.user_metadata?.role]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const getSortIcon = (column) => {
    if (sortConfig.key !== column) {
      return <ArrowUpDown className="ml-2 h-4 w-4" />;
    }
    return sortConfig.direction === 'asc' 
      ? <ArrowUp className="ml-2 h-4 w-4" />
      : <ArrowDown className="ml-2 h-4 w-4" />;
  };

  const handleEditClick = async (user) => {
    let enriched = user;
    if (!user?.email && user?.id) {
      const email = await fetchSingleAuthEmail(user.id);
      if (email) enriched = { ...user, email };
    }
    setSelectedUser(enriched);
    setIsEditUserDialogOpen(true);
  };

  const handleTagsClick = (user) => {
    setSelectedUser(user);
    setIsEditTagsDialogOpen(true);
  };
  
  const handleDeleteClick = async (user) => {
    setSelectedUser(user);
    setIsDeleteDialogOpen(true);
    setDeleteMode('soft');
    setTransferToUserId(null);
    setUserAssetCount(null);
    
    // Fetch asset count for this user
    setLoadingAssetCount(true);
    try {
      const { data, error } = await supabase.rpc('get_user_transferable_asset_count', {
        p_user_id: user.id
      });
      
      if (error) throw error;
      setUserAssetCount(data);
    } catch (error) {
      console.error('Error fetching asset count:', error);
      toast({
        title: 'Error',
        description: 'Failed to check user assets',
        variant: 'destructive',
      });
    } finally {
      setLoadingAssetCount(false);
    }
  };

  const confirmDelete = async () => {
    if (!selectedUser) return;
    setIsDeleting(true);
    
    const { data, error } = await supabase.functions.invoke('delete-user', {
      body: { 
        userId: selectedUser.id,
        mode: deleteMode,
        transferToUserId: transferToUserId
      },
    });
    
    setIsDeleting(false);
    if (error) {
      toast({ 
        title: 'Error deleting user', 
        description: error.message || 'An error occurred', 
        variant: 'destructive' 
      });
    } else {
      const action = deleteMode === 'soft' ? 'deactivated' : 'permanently deleted';
      toast({ 
        title: 'Success!', 
        description: `User has been ${action}.` 
      });
      fetchUsers();
    }
    setIsDeleteDialogOpen(false);
    setSelectedUser(null);
    setDeleteMode('soft');
    setTransferToUserId(null);
  };

  const handleResetPasswordClick = async (user) => {
    try {
      let email = user?.email;
      if (!email && user?.id) {
        email = await fetchSingleAuthEmail(user.id);
      }
      if (!email) {
        toast({
          title: 'Email not available',
          description: 'Cannot send a reset without an email address for this user.',
          variant: 'destructive',
        });
        return;
      }
      await resetPasswordForEmail(email);
    } catch (e) {
      toast({
        title: 'Password reset failed',
        description: e?.message || 'Unexpected error',
        variant: 'destructive',
      });
    }
  };

  const handleActionClick = () => {
    toast({
      title: '🚧 Feature Not Implemented',
      description: "This feature isn't implemented yet—but don't worry! You can request it in your next prompt! 🚀",
    });
  };

  const handleAddUserClick = () => {
    setSelectedUser(null); // Clear selected user for add operation
    setIsAddUserDialogOpen(true);
  };

  const handleAddUserSuccess = () => {
    fetchUsers();
    setIsAddUserDialogOpen(false);
  }

  const handleEditUserSuccess = async (resp) => {
    const userId = resp?.userId || selectedUser?.id;
    const optimisticEmail = resp?.updatedEmail;
    if (optimisticEmail && userId) {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, email: optimisticEmail } : u));
    }
    // Authoritative refresh for this user's auth email
    if (userId) {
      try {
        const finalEmail = await fetchSingleAuthEmail(userId);
        if (finalEmail) {
          setUsers(prev => prev.map(u => u.id === userId ? { ...u, email: finalEmail } : u));
        }
      } catch (_) {}
    }
    fetchUsers();
    setIsEditUserDialogOpen(false);
    setSelectedUser(null);
  }

  const handleEditTagsSuccess = () => {
    fetchUsers();
    setIsEditTagsDialogOpen(false);
    setSelectedUser(null);
  }
  
  const getInitials = (name) => {
    if (!name) return 'U';
    const names = name.split(' ');
    return names.map((n) => n[0]).join('').toUpperCase();
  };

  const filteredUsers = users.filter(user => 
    user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sortedUsers = useMemo(() => {
    if (!sortConfig.key) return filteredUsers;

    return [...filteredUsers].sort((a, b) => {
      let aValue = a[sortConfig.key];
      let bValue = b[sortConfig.key];

      // Handle special cases
      if (sortConfig.key === 'name') {
        aValue = a.full_name;
        bValue = b.full_name;
      } else if (sortConfig.key === 'organization') {
        aValue = a.organization_name;
        bValue = b.organization_name;
      }

      if (aValue === null || aValue === undefined) aValue = '';
      if (bValue === null || bValue === undefined) bValue = '';

      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredUsers, sortConfig]);

  return (
    <>
      <Helmet>
        <title>Admin Users – Manage users and emails</title>
        <meta name="description" content="Admin users management. View and edit user details and emails across organizations." />
        <link rel="canonical" href="/admin/users" />
      </Helmet>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeInOut' }}
        className="w-full px-6 pt-6 space-y-6"
      >
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-800">Users</h1>
          <div className="flex items-center space-x-4">
            <div className="relative w-full max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input 
                placeholder="Search by name or email" 
                className="pl-9 bg-white" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button onClick={handleAddUserClick} className="bg-blue-600 hover:bg-blue-700 text-white">
              <UserPlus className="h-4 w-4 mr-2" />
              Add User
            </Button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border">
          <Table>
            <TableHeader>
              <TableRow className="border-b-gray-200 hover:bg-transparent">
                <TableHead className="text-gray-600 font-semibold">
                  <Button 
                    variant="ghost" 
                    onClick={() => handleSort('name')}
                    className="font-semibold text-gray-600 hover:text-gray-800 px-0"
                  >
                    User
                    {getSortIcon('name')}
                  </Button>
                </TableHead>
                <TableHead className="text-gray-600 font-semibold">
                  <Button 
                    variant="ghost" 
                    onClick={() => handleSort('organization')}
                    className="font-semibold text-gray-600 hover:text-gray-800 px-0"
                  >
                    Organization
                    {getSortIcon('organization')}
                  </Button>
                </TableHead>
                <TableHead className="text-gray-600 font-semibold">
                  <Button 
                    variant="ghost" 
                    onClick={() => handleSort('role')}
                    className="font-semibold text-gray-600 hover:text-gray-800 px-0"
                  >
                    Role
                    {getSortIcon('role')}
                  </Button>
                </TableHead>
                <TableHead className="text-gray-600 font-semibold">Sharing Tags</TableHead>
                <TableHead className="text-gray-600 font-semibold">
                  <Button 
                    variant="ghost" 
                    onClick={() => handleSort('location')}
                    className="font-semibold text-gray-600 hover:text-gray-800 px-0"
                  >
                    Location
                    {getSortIcon('location')}
                  </Button>
                </TableHead>
                <TableHead><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center h-48">Loading users...</TableCell>
                </TableRow>
              ) : sortedUsers.length > 0 ? (
                sortedUsers.map((user) => (
                  <TableRow 
                    key={user.id} 
                    className={`${currentUser?.id && user.id === currentUser.id ? 'bg-blue-50/50' : ''} border-b-gray-200/50`}
                  >
                    <TableCell>
                      <div className="flex items-center space-x-3">
                        <Avatar>
                          <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${user.full_name}`} alt={user.full_name} />
                          <AvatarFallback>{getInitials(user.full_name)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium text-gray-900">{user.full_name} {user.id === currentUser.id && <span className="text-sm font-normal text-gray-500">(You)</span>}</div>
                          <div className="text-sm text-gray-500">{user.email}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-700">{user.organization_name || "N/A"}</TableCell>
                    <TableCell className="text-gray-700">{user.role}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1.5">
                        {user.limit_by_tags ? (
                           user.tags.length > 0 ? user.tags.map((tag) => (
                            <Badge key={tag.id} variant="secondary" className="bg-gray-100 text-gray-700 font-normal px-2 py-1">
                              {tag.categoryName}: {tag.name}
                            </Badge>
                          )) : <span className="text-sm text-gray-400">No tags assigned</span>
                        ) : <span className="text-sm text-gray-400">All content visible</span>}
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-700">{user.location || "N/A"}</TableCell>
                    <TableCell className="text-right">
                      {currentUser?.id && user.id !== currentUser.id && (
                        <div className="flex items-center justify-end space-x-1">
                           <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-gray-800" onClick={() => handleTagsClick(user)}>
                            <Tags className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-gray-800" onClick={() => handleEditClick(user)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-gray-800" onClick={() => handleResetPasswordClick(user)}>
                            <Key className="h-4 w-4" />
                            <span className="sr-only">Send password reset email</span>
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500/70 hover:text-red-600" onClick={() => handleDeleteClick(user)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center h-48">No users found.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </motion.div>
      
      <AddUserDialog 
        isOpen={isAddUserDialogOpen}
        setIsOpen={setIsAddUserDialogOpen}
        onUserAdded={handleAddUserSuccess}
      />

      {selectedUser && (
        <>
          <EditUserDialog
            isOpen={isEditUserDialogOpen}
            setIsOpen={setIsEditUserDialogOpen}
            user={selectedUser}
            onUserUpdated={handleEditUserSuccess}
          />
          <EditUserTagsDialog
            isOpen={isEditTagsDialogOpen}
            setIsOpen={setIsEditTagsDialogOpen}
            user={selectedUser}
            onUserUpdated={handleEditTagsSuccess}
          />
        </>
      )}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User Account</AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <p>Choose how to handle this user's account:</p>
              
              <RadioGroup value={deleteMode} onValueChange={setDeleteMode} className="space-y-3">
                <div className="flex items-start space-x-3 rounded-lg border border-gray-200 p-4 hover:bg-gray-50">
                  <RadioGroupItem value="soft" id="soft" />
                  <div className="flex-1">
                    <Label htmlFor="soft" className="cursor-pointer">
                      <div className="font-semibold text-gray-900">Deactivate User (Recommended)</div>
                      <div className="text-sm text-gray-600 mt-1">
                        User account will be hidden and disabled. All data and content created by this user will be preserved. 
                        This action can be reversed.
                      </div>
                    </Label>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3 rounded-lg border border-red-200 p-4 hover:bg-red-50">
                  <RadioGroupItem value="hard" id="hard" />
                  <div className="flex-1">
                    <Label htmlFor="hard" className="cursor-pointer">
                      <div className="font-semibold text-red-900">Permanently Delete User</div>
                      <div className="text-sm text-red-700 mt-1">
                        User account will be permanently deleted. You must select another user to receive all content ownership. This action cannot be undone.
                      </div>
                    </Label>
                  </div>
                </div>
              </RadioGroup>
              
              {deleteMode === 'hard' && (
                <div className="space-y-4 border-t pt-4">
                  {loadingAssetCount ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      Checking user assets...
                    </div>
                  ) : userAssetCount && userAssetCount.total_count > 0 ? (
                    <>
                      <div className="text-sm text-muted-foreground">
                        This user owns <strong>{userAssetCount.total_count}</strong> asset{userAssetCount.total_count !== 1 ? 's' : ''} that will be transferred:
                        {userAssetCount.inks > 0 && ` ${userAssetCount.inks} ink${userAssetCount.inks !== 1 ? 's' : ''}`}
                        {userAssetCount.colors > 0 && `, ${userAssetCount.colors} color${userAssetCount.colors !== 1 ? 's' : ''}`}
                        {userAssetCount.quality_sets > 0 && `, ${userAssetCount.quality_sets} quality set${userAssetCount.quality_sets !== 1 ? 's' : ''}`}
                        {userAssetCount.substrates > 0 && `, ${userAssetCount.substrates} substrate${userAssetCount.substrates !== 1 ? 's' : ''}`}
                        {userAssetCount.color_matches > 0 && `, ${userAssetCount.color_matches} match${userAssetCount.color_matches !== 1 ? 'es' : ''}`}
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="transfer-user" className="text-sm font-medium text-red-900">
                          Transfer content ownership to: <span className="text-red-600">*</span>
                        </Label>
                        <Select value={transferToUserId || ''} onValueChange={setTransferToUserId}>
                          <SelectTrigger id="transfer-user" className={!transferToUserId ? 'border-red-300' : ''}>
                            <SelectValue placeholder="Select a user to transfer ownership..." />
                          </SelectTrigger>
                          <SelectContent>
                            {users
                              .filter(u => u.id !== selectedUser?.id && !u.deleted_at)
                              .map(u => (
                                <SelectItem key={u.id} value={u.id}>
                                  {u.full_name || u.email} - {u.organization_name}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  ) : userAssetCount && userAssetCount.total_count === 0 ? (
                    <div className="rounded-md bg-muted p-3">
                      <p className="text-sm text-foreground">
                        ✓ This user has no assets to transfer. The account can be deleted immediately.
                      </p>
                    </div>
                  ) : null}
                </div>
              )}
              
              {deleteMode === 'hard' && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm text-red-800 font-medium">
                    ⚠️ Warning: This action is permanent and cannot be undone!
                  </p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete} 
              disabled={
                isDeleting || 
                (deleteMode === 'hard' && loadingAssetCount) ||
                (deleteMode === 'hard' && userAssetCount?.total_count > 0 && !transferToUserId)
              } 
              className={deleteMode === 'hard' ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"}
            >
              {isDeleting 
                ? (deleteMode === 'soft' ? 'Deactivating...' : 'Deleting...') 
                : (deleteMode === 'soft' ? 'Deactivate User' : 'Permanently Delete User')
              }
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default Users;