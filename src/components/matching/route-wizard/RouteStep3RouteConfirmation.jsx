import React, { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useProfile } from '@/context/ProfileContext';
import { supabase } from '@/lib/customSupabaseClient';
import { Loader2, Palette } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { realtimeManager } from '@/lib/realtimeManager';

const RouteStep3RouteConfirmation = ({ 
  matchRequest, 
  selectedColorIds, 
  selectedPartnerId,
  notes,
  onNotesChange,
  isSubmitting,
  onSubmit,
  onRouteClick 
}) => {
  const { toast } = useToast();
  const { profile } = useProfile();
  const navigate = useNavigate();
  const [inkSupplierPartners, setInkSupplierPartners] = useState([]);
  const [partnerLocations, setPartnerLocations] = useState([]);

  // Normalize color ID accessor to handle different data shapes
  const getColorId = (c) => c?.id ?? c?.color_id ?? c?.match_measurement?.color_id;

  const selectedColors = matchRequest?.colors?.filter(c => selectedColorIds.includes(getColorId(c))) || [];
  const selectedPartner = inkSupplierPartners.find(p => p.id === selectedPartnerId);
  const selectedLocation = partnerLocations.find(l => l.id === selectedPartnerId);

  useEffect(() => {
    if (profile?.organization_id) {
      fetchInkSupplierPartners();
    }
  }, [profile?.organization_id]);

  useEffect(() => {
    if (selectedPartnerId) {
      fetchPartnerLocations();
    }
  }, [selectedPartnerId]);

  const fetchInkSupplierPartners = async () => {
    try {
      const { data: partners, error } = await supabase
        .from('partners') 
        .select(`
          id,
          partner_organization_id,
          partner_roles,
          status,
          organizations!partners_partner_organization_id_fkey (
            id,
            name
          )
        `)
        .eq('organization_id', profile.organization_id)
        .in('status', ['connected', 'accepted'])
        .contains('partner_roles', ['Ink Supplier']);

      if (error) throw error;

      const inkSuppliers = partners?.filter(partner => 
        partner.partner_roles.includes('Ink Supplier')
      ) || [];
      
      setInkSupplierPartners(inkSuppliers);
    } catch (error) {
      console.error('Failed to fetch ink supplier partners:', error);
    }
  };

  const fetchPartnerLocations = async () => {
    if (!selectedPartnerId) return;
    
    try {
      const selectedPartner = inkSupplierPartners.find(p => p.id === selectedPartnerId);
      if (!selectedPartner) return;

      // Get all partner locations for this organization that have active partnerships and collect matches enabled
      const { data: partners, error } = await supabase
        .from('partners')
        .select('id, partner_location')
        .eq('organization_id', profile.organization_id)
        .eq('partner_organization_id', selectedPartner.partner_organization_id)
        .in('status', ['connected', 'accepted'])
        .eq('collect_color_matches', true)
        .not('partner_location', 'is', null);

      if (error) throw error;

      const locations = partners?.map(partner => ({
        id: partner.id,
        name: partner.partner_location
      })) || [];

      setPartnerLocations(locations);
    } catch (error) {
      console.error('Failed to fetch partner locations:', error);
      toast({
        title: 'Error',
        description: 'Failed to load partner locations',
        variant: 'destructive',
      });
    }
  };

  const handleSubmit = async () => {
    if (!selectedPartnerId) {
      toast({
        title: 'Partner Required',
        description: 'Please select an ink supplier to route the matches to.',
        variant: 'destructive',
      });
      return;
    }

    // Preflight partner status validation
    const allowedStatuses = ['connected', 'accepted'];
    if (!selectedPartner || !allowedStatuses.includes(selectedPartner.status)) {
      toast({
        title: 'Partner Not Connected',
        description: 'Selected partner must be connected or accepted to receive routed matches.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const partnerName = selectedPartner?.organizations?.name || 'Unknown Partner';
      
      console.log('Calling route-match edge function with:', {
        matchRequestId: matchRequest.match_request_id || matchRequest.id,
        partnerId: selectedPartnerId,
        colorIds: selectedColorIds,
        partnerName,
        notes: notes.trim() || null
      });

      const { data, error } = await supabase.functions.invoke('route-match', {
        body: {
          matchRequestId: matchRequest.match_request_id || matchRequest.id,
          partnerId: selectedPartnerId,
          colorIds: selectedColorIds,
          partnerName,
          notes: notes.trim() || null
        }
      });

      if (error) {
        console.error('Edge function error:', error);
        throw new Error(`Routing error: ${error.message}`);
      }

      if (!data || !data.success) {
        console.error('Route request failed:', data);
        throw new Error(data?.error || 'Unknown error occurred while routing colors');
      }

      console.log('Route request successful:', data);

      toast({
        title: 'Colors Routed Successfully!',
        description: `Successfully routed ${selectedColorIds.length} color${selectedColorIds.length !== 1 ? 's' : ''} to ${partnerName}`,
      });

      // Broadcast force refresh to routed-to organization
      const routedToOrgId = selectedPartner?.partner_organization_id;
      if (routedToOrgId) {
        console.log('📡 Broadcasting force-notification-refresh to:', routedToOrgId);
        realtimeManager.broadcast('force-notification-refresh', { 
          organization_id: routedToOrgId 
        });
      }

      onSubmit({ partnerId: selectedPartnerId, notes: notes.trim() });
      
      // Navigate away from the matching page since user no longer has access to these colors
      navigate('/color-matches');
    } catch (error) {
      console.error('Failed to route colors:', error);
      
      // Show detailed error message
      const errorMessage = error.message || 'Unknown error occurred while routing colors';
      
      toast({
        title: 'Routing Failed',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  // Expose the handleSubmit function to parent
  useEffect(() => {
    if (onRouteClick) {
      onRouteClick(handleSubmit);
    }
  }, [onRouteClick, handleSubmit]);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold mb-3">
          {selectedColorIds.length} match{selectedColorIds.length !== 1 ? 'es' : ''} routed to {selectedPartner?.organizations?.name || 'Unknown Partner'}{selectedLocation ? `, ${selectedLocation.name}` : ''}
        </h3>
        <div className="space-y-2">
          {selectedColors.map(color => (
            <div key={getColorId(color)} className="flex items-center gap-3 py-2 px-3 bg-muted/30 rounded-lg">
              <div 
                className="w-5 h-5 rounded border border-border flex-shrink-0 flex items-center justify-center"
                style={{ backgroundColor: color.hex }}
              >
                {/* Show palette icon if color is very light */}
                {(color.hex === '#FFFFFF' || 
                  (color.hex && parseInt(color.hex.slice(1), 16) > 0xF0F0F0)) && (
                  <Palette className="w-3 h-3 text-muted-foreground" />
                )}
              </div>
              <span className="text-sm font-medium">{color.name}</span>
            </div>
          ))}
        </div>
      </div>
      
      <hr />
      
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="dueDate" className="text-xs">Due Date</Label>
          <Input 
            id="dueDate" 
            type="date" 
            value={matchRequest?.due_date || ''}
            className="bg-muted pointer-events-none h-8 text-xs text-foreground" 
            disabled 
            placeholder="N/A for routing"
          />
        </div>
        <div>
          <Label htmlFor="jobId" className="text-xs">Job ID</Label>
          <Input 
            id="jobId" 
            value={matchRequest?.job_id || 'N/A'} 
            className="bg-muted pointer-events-none h-8 text-xs"
            disabled
            placeholder="From original request"
          />
        </div>
      </div>
      
      <div>
        <Label htmlFor="notes" className="text-xs">Special Instructions (Optional)</Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="Add any special instructions or notes for the ink supplier..."
          rows={2}
          className="focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0 border-input text-xs"
        />
      </div>
    </div>
  );
};

export default RouteStep3RouteConfirmation;