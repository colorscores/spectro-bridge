import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { MoreVertical, User, MapPin, Globe, PlusSquare, CheckCircle, Share2, Trash2, Tags } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/customSupabaseClient';
import { useProfile } from '@/context/ProfileContext';
import { useMutation, useQueryClient } from '@tanstack/react-query';

const PartnerCard = ({ partner, onEdit, onDelete, onUpdate }) => {
  const { profile } = useProfile();
  
  const queryClient = useQueryClient();
  const { 
    id, partner_name, partner_type, partner_location, status, is_initiator, 
    partner_organization_id, colors_shared_by_inviter, partner_roles, sharing_categories, sharing_tags
  } = partner;
  const matches = partner.matches || 0;

  // Accept partner invitation mutation with optimistic updates
  const acceptMutation = useMutation({
    mutationFn: async ({ partnerId, acceptingOrgId }) => {
      const { error } = await supabase.rpc('accept_partner_invitation', {
        p_accepting_org_id: acceptingOrgId,
        p_partner_connection_id: partnerId
      });
      if (error) throw error;
      return { partnerId, status: 'connected' };
    },
    onMutate: async ({ partnerId }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['partners', profile?.organization_id] });

      // Snapshot the previous value
      const previousPartners = queryClient.getQueryData(['partners', profile?.organization_id]);

      // Optimistically update to show connected status
      queryClient.setQueryData(['partners', profile?.organization_id], (old) => {
        return old?.map(p => 
          p.id === partnerId 
            ? { ...p, status: 'connected', _optimistic: true }
            : p
        ) || [];
      });

      // Return context with the rollback data
      return { previousPartners };
    },
    onError: (err, variables, context) => {
      // Roll back to the previous state
      if (context?.previousPartners) {
        queryClient.setQueryData(['partners', profile?.organization_id], context.previousPartners);
      }
      toast({ 
        variant: 'destructive', 
        title: 'Failed to accept invitation', 
        description: err.message 
      });
    },
    onSuccess: () => {
      toast({ 
        title: 'Success', 
        description: `You are now connected with ${partner_name}.`
      });
    },
    onSettled: () => {
      // Always refetch after error or success to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['partners', profile?.organization_id] });
    },
  });

  // Delete partner mutation with optimistic updates
  const deleteMutation = useMutation({
    mutationFn: async ({ orgId1, orgId2 }) => {
      const { error } = await supabase.rpc('delete_partner_connection', {
        p_org_id_1: orgId1,
        p_org_id_2: orgId2,
      });
      if (error) throw error;
      return { orgId2 };
    },
    onMutate: async ({ orgId2 }) => {
      await queryClient.cancelQueries({ queryKey: ['partners', profile?.organization_id] });

      const previousPartners = queryClient.getQueryData(['partners', profile?.organization_id]);

      // Optimistically remove the partner
      queryClient.setQueryData(['partners', profile?.organization_id], (old) => {
        return old?.filter(p => p.partner_organization_id !== orgId2) || [];
      });

      return { previousPartners };
    },
    onError: (err, variables, context) => {
      if (context?.previousPartners) {
        queryClient.setQueryData(['partners', profile?.organization_id], context.previousPartners);
      }
      toast({ 
        variant: 'destructive', 
        title: 'Failed to delete partner', 
        description: err.message 
      });
    },
    onSuccess: () => {
      toast({ 
        title: 'Success', 
        description: `Connection with ${partner_name} has been removed.`
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['partners', profile?.organization_id] });
    },
  });

  // Fallbacks: if RPC didn't provide computed partner_location, try any obvious alternatives
  const displayLocation = partner_location 
    || partner.partnerOrgLocation 
    || partner.partner_org_location 
    || partner.location 
    || 'N/A';

  const statusStyles = {
    connected: {
      borderColor: 'border-green-500',
      dotColor: 'bg-green-500',
      textColor: 'text-green-600',
    },
    pending: {
      borderColor: 'border-yellow-500',
      dotColor: 'bg-yellow-500',
      textColor: 'text-yellow-600',
    },
  };

  const currentStatus = statusStyles[status] || statusStyles.pending;

  const sharedColorsLabel = is_initiator ? "Colors shared by you" : "Colors shared with you";

  // Prefer partner_roles over partner_type for displaying roles
  const rolesArray = Array.isArray(partner_roles) && partner_roles.length > 0
    ? partner_roles
    : (Array.isArray(partner_type) ? partner_type : []);
  const rolesText = rolesArray.length > 0 ? rolesArray.join(', ') : 'N/A';

  // Check if this partner is ink supplier only (no general color sharing)
  const isInkSupplierOnly = rolesArray.length === 1 && rolesArray[0] === 'Ink Supplier';

  // Build sharing categories & tags display text
  const categoriesArray = Array.isArray(sharing_categories) ? sharing_categories : [];
  const tagsArray = Array.isArray(sharing_tags) ? sharing_tags : [];
  let sharingText = 'All categories & tags';
  if (categoriesArray.length > 0 || tagsArray.length > 0) {
    const parts = [];
    if (categoriesArray.length > 0) parts.push(categoriesArray.join(', '));
    if (tagsArray.length > 0) parts.push(tagsArray.join(', '));
    sharingText = parts.join(' • ');
  }

  const handleEdit = () => {
    if (onEdit) {
      onEdit(partner);
    }
  };

  const handleDelete = () => {
    if (onDelete) {
      onDelete(partner_organization_id, partner_name);
    } else {
      // Use optimistic mutation if no callback provided
      deleteMutation.mutate({
        orgId1: profile?.organization_id,
        orgId2: partner_organization_id
      });
    }
  };

  const handleAccept = async () => {
    if (!profile?.organization_id || !id) {
        toast({ variant: 'destructive', title: 'Error', description: 'Could not identify participating organizations.' });
        return;
    }

    // Use optimistic mutation
    acceptMutation.mutate({
      partnerId: id,
      acceptingOrgId: profile.organization_id
    });
  };


  return (
    <Card className={cn('flex flex-col h-full border-t-4 shadow-md hover:shadow-lg transition-shadow duration-300', currentStatus.borderColor)}>
      <CardContent className="p-4 flex flex-col flex-grow">
        <div className="flex justify-between items-start mb-4">
          <h3 className="font-bold text-lg text-gray-800">{partner_name}</h3>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-5 w-5 text-gray-500" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {status === 'pending' && !is_initiator && (
                <>
                  <DropdownMenuItem onClick={handleAccept}>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    <span>Accept</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              {is_initiator && (
                <>
                  <DropdownMenuItem onClick={handleEdit}>
                    <Share2 className="mr-2 h-4 w-4" />
                    <span>Edit Partner</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem onClick={handleDelete} className="text-red-600 focus:text-red-600 focus:bg-red-50">
                <Trash2 className="mr-2 h-4 w-4" />
                <span>Delete</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="space-y-3 text-sm text-gray-600 flex-grow">
          <div className="flex items-center">
            <User className="h-4 w-4 mr-3 text-gray-400" />
            <span>{rolesText}{!is_initiator ? ' (your roles)' : ''}</span>
          </div>
          <div className="flex items-center">
            <MapPin className="h-4 w-4 mr-3 text-gray-400" />
            <span>{displayLocation}{!is_initiator ? ' (your location)' : ''}</span>
          </div>
          {!isInkSupplierOnly && (
            <>
              <div className="flex items-center">
                <Tags className="h-4 w-4 mr-3 text-gray-400" />
                <span className="truncate">{sharingText}</span>
              </div>
              <div className="flex items-center">
                <Globe className="h-4 w-4 mr-3 text-gray-400" />
                <span>{colors_shared_by_inviter} {sharedColorsLabel}</span>
              </div>
            </>
          )}
          <div className="flex items-center">
            <PlusSquare className="h-4 w-4 mr-3 text-gray-400" />
            <span>{matches} Matches</span>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center">
                <span className={cn('h-2.5 w-2.5 rounded-full mr-2', currentStatus.dotColor)}></span>
                <span className={cn('text-sm font-medium capitalize', currentStatus.textColor)}>
                    {status === 'pending' ? (is_initiator ? 'Invitation Sent' : 'Invitation Received') : status}
                </span>
            </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default PartnerCard;
