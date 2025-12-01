import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useProfile } from '@/context/ProfileContext';
import { supabase } from '@/lib/customSupabaseClient';
import { Loader2, Route } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import { realtimeManager } from '@/lib/realtimeManager';

const RouteMatchDialog = ({ open, onOpenChange, matchRequest, onRouted }) => {
  const { toast } = useToast();
  const { profile } = useProfile();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedPartnerId, setSelectedPartnerId] = useState('');
  const [notes, setNotes] = useState('');
  const [inkSupplierPartners, setInkSupplierPartners] = useState([]);
  const [loading, setLoading] = useState(false);

  // Fetch ink supplier partners when dialog opens
  useEffect(() => {
    if (open && profile?.organization_id) {
      fetchInkSupplierPartners();
    }
  }, [open, profile?.organization_id]);

  const fetchInkSupplierPartners = async () => {
    setLoading(true);
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

      // Filter to only ink suppliers
      const inkSuppliers = partners?.filter(partner => 
        partner.partner_roles.includes('Ink Supplier')
      ) || [];
      
      setInkSupplierPartners(inkSuppliers);
    } catch (error) {
      console.error('Failed to fetch ink supplier partners:', error);
      toast({
        title: 'Error',
        description: 'Failed to load available ink suppliers',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRouteMatch = async () => {
    if (!selectedPartnerId) {
      toast({
        title: 'Partner Required',
        description: 'Please select an ink supplier to route this match to.',
        variant: 'destructive',
      });
      return;
    }

    // Preflight partner status validation
    const allowedStatuses = ['connected', 'accepted'];
    const selectedPartner = inkSupplierPartners.find(p => p.id === selectedPartnerId);
    if (!selectedPartner || !allowedStatuses.includes(selectedPartner.status)) {
      toast({
        title: 'Partner Not Connected',
        description: 'Selected partner must be connected or accepted to receive routed matches.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { data, error } = await supabase.functions.invoke('route-match', {
        body: {
          matchRequestId: matchRequest.id,
          partnerId: selectedPartnerId,
          partnerName: selectedPartner?.organizations?.name || null,
          notes: notes.trim() || null
        }
      });

      if (error) throw error;

      // Check if routing was actually successful
      if (!data || !data.success) {
        throw new Error(data?.error || 'Routing failed - no success confirmation');
      }

      const partnerName = selectedPartner?.organizations?.name || 'Unknown Partner';

      toast({
        title: 'Match Routed Successfully!',
        description: `Match request has been routed to ${partnerName}`,
      });

      // Broadcast force refresh to routed-to organization
      const routedToOrgId = selectedPartner?.partner_organization_id;
      if (routedToOrgId) {
        console.log('📡 Broadcasting force-notification-refresh to:', routedToOrgId);
        realtimeManager.broadcast('force-notification-refresh', { 
          organization_id: routedToOrgId 
        });
      }

      onRouted?.(data);
      onOpenChange(false);
      setSelectedPartnerId('');
      setNotes('');
      
      // Navigate away from the matching page since user no longer has access
      navigate('/color-matches');
    } catch (error) {
      console.error('Failed to route match:', error);
      toast({
        title: 'Routing Failed',
        description: error?.message || 'Failed to route match request',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    // Reset form after a short delay to avoid visual glitch
    setTimeout(() => {
      setSelectedPartnerId('');
      setNotes('');
    }, 300);
  };

  const selectedPartner = inkSupplierPartners.find(p => p.id === selectedPartnerId);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Route className="h-5 w-5" />
            Route Match Request
          </DialogTitle>
          <DialogDescription>
            Route this match request to an ink supplier partner for specialized matching services.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Current Match Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Current Match Request</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-sm">
                <span className="font-medium">Job ID:</span> {matchRequest?.job_id}
              </div>
              <div className="text-sm">
                <span className="font-medium">Location:</span> {matchRequest?.location || 'N/A'}
              </div>
              <div className="text-sm">
                <span className="font-medium">Print Condition:</span> {matchRequest?.print_condition || 'N/A'}
              </div>
            </CardContent>
          </Card>

          {/* Partner Selection */}
          <div className="space-y-2">
            <Label htmlFor="partner">Select Ink Supplier</Label>
            <Select value={selectedPartnerId} onValueChange={setSelectedPartnerId} disabled={loading}>
              <SelectTrigger>
                <SelectValue placeholder={loading ? "Loading partners..." : "Choose an ink supplier"} />
              </SelectTrigger>
              <SelectContent>
                {inkSupplierPartners.map((partner) => (
                  <SelectItem key={partner.id} value={partner.id}>
                    {partner.organizations?.name || 'Unknown Partner'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {inkSupplierPartners.length === 0 && !loading && (
              <p className="text-sm text-muted-foreground">
                No connected ink supplier partners found. You need to establish partnerships with ink suppliers first.
              </p>
            )}
          </div>

          {/* Selected Partner Info */}
          {selectedPartner && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Routing To</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm">
                  <span className="font-medium">Organization:</span> {selectedPartner.organizations?.name}
                </div>
                <div className="text-sm">
                  <span className="font-medium">Roles:</span> {selectedPartner.partner_roles.join(', ')}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any special instructions or notes for the ink supplier..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleRouteMatch} disabled={isSubmitting || !selectedPartnerId}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Routing...
              </>
            ) : (
              'Route Match'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RouteMatchDialog;