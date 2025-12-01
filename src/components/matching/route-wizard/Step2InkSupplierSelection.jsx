import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useProfile } from '@/context/ProfileContext';
import { supabase } from '@/lib/customSupabaseClient';
import { Loader2 } from 'lucide-react';

import { useNavigate } from 'react-router-dom';

const Step2InkSupplierSelection = ({ 
  matchRequest, 
  selectedColorIds, 
  selectedPartnerId, 
  onPartnerChange, 
  notes, 
  onNotesChange, 
  isSubmitting, 
  onSubmit 
}) => {
  const { toast } = useToast();
  const { profile } = useProfile();
  const navigate = useNavigate();
  const [inkSupplierPartners, setInkSupplierPartners] = useState([]);
  const [loading, setLoading] = useState(false);

  const selectedColors = matchRequest?.colors?.filter(c => selectedColorIds.includes(c.color_id)) || [];
  const selectedPartner = inkSupplierPartners.find(p => p.id === selectedPartnerId);

  useEffect(() => {
    if (profile?.organization_id) {
      fetchInkSupplierPartners();
    }
  }, [profile?.organization_id]);

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
        partnerName,
        notes: notes.trim() || null
      });

      const { data, error } = await supabase.functions.invoke('route-match', {
        body: {
          matchRequestId: matchRequest.match_request_id || matchRequest.id,
          partnerId: selectedPartnerId,
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
        description: `Successfully routed colors to ${partnerName}`,
      });

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

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Route Summary</h3>
        <Card>
          <CardContent className="p-4">
            <div className="space-y-2">
              <div className="text-sm">
                <span className="font-medium">Colors to route:</span> {selectedColorIds.length}
              </div>
              <div className="text-sm">
                <span className="font-medium">From job:</span> {matchRequest?.job_id}
              </div>
              <div className="text-sm">
                <span className="font-medium">Location:</span> {matchRequest?.location || 'N/A'}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">Selected Colors</h3>
        <div className="space-y-2 max-h-40 overflow-y-auto">
          {selectedColors.map((color) => (
            <div key={color.color_id} className="flex items-center space-x-3 p-2 bg-muted rounded">
              <div 
                className="w-6 h-6 rounded border" 
                style={{ backgroundColor: color.hex }}
              />
              <span className="text-sm font-medium">{color.name}</span>
              <span className="text-xs text-muted-foreground">{color.hex}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <Label htmlFor="partner">Select Ink Supplier</Label>
          <Select value={selectedPartnerId} onValueChange={onPartnerChange} disabled={loading}>
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
            <p className="text-sm text-muted-foreground mt-1">
              No connected ink supplier partners found. You need to establish partnerships with ink suppliers first.
            </p>
          )}
        </div>

        {selectedPartner && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Routing To</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                <div className="text-sm">
                  <span className="font-medium">Organization:</span> {selectedPartner.organizations?.name}
                </div>
                <div className="text-sm">
                  <span className="font-medium">Roles:</span> 
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedPartner.partner_roles.map((role) => (
                      <Badge key={role} variant="secondary" className="text-xs">
                        {role}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div>
          <Label htmlFor="notes">Notes (Optional)</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            placeholder="Add any special instructions or notes for the ink supplier..."
            rows={3}
          />
        </div>

        <Button 
          onClick={handleSubmit} 
          disabled={isSubmitting || !selectedPartnerId}
          className="w-full"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Routing Matches...
            </>
          ) : (
            `Route ${selectedColorIds.length} Matches`
          )}
        </Button>
      </div>
    </div>
  );
};

export default Step2InkSupplierSelection;