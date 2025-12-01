import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { PlusCircle, Trash2, Edit, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import AddOrganizationDialog from '@/components/admin/organizations/AddOrganizationDialog';
import EditOrganizationDialog from '@/components/admin/organizations/EditOrganizationDialog';

const Organizations = () => {
  
  const { user } = useAuth();
  const navigate = useNavigate();
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState(null);
  const [userOrganizationId, setUserOrganizationId] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [orgToDelete, setOrgToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  const fetchOrganizations = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('organizations')
      .select('id, name, type, created_at, profiles(id, full_name, role)');

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Error fetching organizations',
        description: error.message,
      });
    } else {
      setOrganizations(data);
    }
    setLoading(false);
  }, [toast]);

  const fetchUserOrganization = useCallback(async () => {
    if (user) {
      const { data, error } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .maybeSingle();
      
      if (error) {
        console.error("Error fetching user's organization:", error.message);
        toast({
          variant: 'destructive',
          title: "Error fetching user's organization",
          description: error.message,
        });
      } else if (data) {
        setUserOrganizationId(data.organization_id);
      }
    }
  }, [user, toast]);

  useEffect(() => {
    fetchOrganizations();
    fetchUserOrganization();
  }, [fetchOrganizations, fetchUserOrganization]);

  const handleOrganizationAdded = () => {
    fetchOrganizations();
  };
  
  const handleOrganizationUpdated = () => {
    fetchOrganizations();
  };

  const handleDelete = (org) => {
    setOrgToDelete(org);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!orgToDelete) return;
    
    setIsDeleting(true);
    try {
      // Delete the organization
      const { error } = await supabase
        .from('organizations')
        .delete()
        .eq('id', orgToDelete.id);

      if (error) {
        throw error;
      }

      toast({
        title: "Organization deleted",
        description: `${orgToDelete.name} has been successfully deleted.`,
      });
      
      // Refresh the organizations list
      fetchOrganizations();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: "Error deleting organization",
        description: error.message,
      });
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setOrgToDelete(null);
    }
  };

  const handleEdit = (org) => {
    navigate(`/admin/organizations/${org.id}`);
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (column) => {
    if (sortConfig.key !== column) {
      return <ArrowUpDown className="ml-2 h-4 w-4" />;
    }
    return sortConfig.direction === 'asc' 
      ? <ArrowUp className="ml-2 h-4 w-4" />
      : <ArrowDown className="ml-2 h-4 w-4" />;
  };

  const sortedOrganizations = useMemo(() => {
    if (!sortConfig.key) return organizations;

    return [...organizations].sort((a, b) => {
      let aValue, bValue;

      switch (sortConfig.key) {
        case 'name':
          aValue = a.name?.toLowerCase() || '';
          bValue = b.name?.toLowerCase() || '';
          break;
        case 'type':
          aValue = Array.isArray(a.type) ? a.type.join(', ') : (a.type || '');
          bValue = Array.isArray(b.type) ? b.type.join(', ') : (b.type || '');
          break;
        case 'admins':
          aValue = a.profiles.filter(p => p.role === 'Admin' || p.role === 'Superadmin').length;
          bValue = b.profiles.filter(p => p.role === 'Admin' || p.role === 'Superadmin').length;
          break;
        case 'members':
          aValue = a.profiles.length;
          bValue = b.profiles.length;
          break;
        case 'created':
          aValue = new Date(a.created_at);
          bValue = new Date(b.created_at);
          break;
        default:
          return 0;
      }

      if (aValue < bValue) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }, [organizations, sortConfig]);

  return (
    <>
      <Helmet>
        <title>Admin Organizations - Manage organizations</title>
        <meta name="description" content="Admin organizations management. View and edit organizations across the platform." />
        <link rel="canonical" href="/admin/organizations" />
      </Helmet>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeInOut' }}
        className="w-full px-6 pt-6 space-y-6"
      >
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-800">Organizations</h1>
          <div className="flex items-center space-x-4">
            <Button onClick={() => setIsAddDialogOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white">
              <PlusCircle className="h-4 w-4 mr-2" />
              New Organization
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
                    Name
                    {getSortIcon('name')}
                  </Button>
                </TableHead>
                <TableHead className="text-gray-600 font-semibold">
                  <Button 
                    variant="ghost" 
                    onClick={() => handleSort('type')}
                    className="font-semibold text-gray-600 hover:text-gray-800 px-0"
                  >
                    Role
                    {getSortIcon('type')}
                  </Button>
                </TableHead>
                <TableHead className="text-gray-600 font-semibold">
                  <Button 
                    variant="ghost" 
                    onClick={() => handleSort('admins')}
                    className="font-semibold text-gray-600 hover:text-gray-800 px-0"
                  >
                    Admins
                    {getSortIcon('admins')}
                  </Button>
                </TableHead>
                <TableHead className="text-gray-600 font-semibold">
                  <Button 
                    variant="ghost" 
                    onClick={() => handleSort('members')}
                    className="font-semibold text-gray-600 hover:text-gray-800 px-0"
                  >
                    Members
                    {getSortIcon('members')}
                  </Button>
                </TableHead>
                <TableHead className="text-gray-600 font-semibold">
                  <Button 
                    variant="ghost" 
                    onClick={() => handleSort('created')}
                    className="font-semibold text-gray-600 hover:text-gray-800 px-0"
                  >
                    Created
                    {getSortIcon('created')}
                  </Button>
                </TableHead>
                <TableHead><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center h-48">Loading organizations...</TableCell>
                </TableRow>
              ) : (
                sortedOrganizations.map((org) => {
                  const admins = org.profiles.filter(p => p.role === 'Admin' || p.role === 'Superadmin');
                  const members = org.profiles.length;
                  return (
                    <TableRow key={org.id} className={`${org.id === userOrganizationId ? 'bg-blue-50/50' : ''} border-b-gray-200/50`}>
                      <TableCell className="font-medium text-gray-900">
                        {org.name}
                        {org.id === userOrganizationId && <Badge variant="secondary" className="ml-2">My Org</Badge>}
                      </TableCell>
                      <TableCell>
                        {Array.isArray(org.type) ? (
                          <div className="flex flex-wrap gap-1.5">
                            {org.type.map((t) => (
                              <Badge key={t} variant="outline">{t}</Badge>
                            ))}
                          </div>
                        ) : (
                          org.type ? <Badge variant="outline">{org.type}</Badge> : 'N/A'
                        )}
                      </TableCell>
                      <TableCell className="text-gray-700">{admins.map(a => a.full_name).join(', ') || 'No admins'}</TableCell>
                      <TableCell className="text-gray-700">{members}</TableCell>
                      <TableCell className="text-gray-700">{new Date(org.created_at).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end space-x-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-gray-800" onClick={() => handleEdit(org)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-red-500/70 hover:text-red-600" 
                            onClick={() => handleDelete(org)}
                            disabled={org.id === userOrganizationId}
                            title={org.id === userOrganizationId ? "Cannot delete your own organization" : "Delete organization"}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </motion.div>
      <AddOrganizationDialog
        isOpen={isAddDialogOpen}
        setIsOpen={setIsAddDialogOpen}
        onOrganizationAdded={handleOrganizationAdded}
      />
      {selectedOrg && (
        <EditOrganizationDialog
          isOpen={isEditDialogOpen}
          setIsOpen={setIsEditDialogOpen}
          organization={selectedOrg}
          onOrganizationUpdated={handleOrganizationUpdated}
        />
      )}
      
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Organization</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{orgToDelete?.name}"? This action cannot be undone and will permanently remove all data associated with this organization.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default Organizations;