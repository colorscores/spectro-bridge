import React, { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useProfile } from '@/context/ProfileContext';
import { supabase } from '@/lib/customSupabaseClient';

const RouteStep2PrinterDetails = ({ 
  matchRequest, 
  selectedColorIds, 
  selectedPartnerId, 
  onPartnerChange 
}) => {
  const { toast } = useToast();
  const { profile } = useProfile();
  const [inkSupplierPartners, setInkSupplierPartners] = useState([]);
  const [partnerLocations, setPartnerLocations] = useState([]);
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [loading, setLoading] = useState(false);
  const [printConditionName, setPrintConditionName] = useState('');

  useEffect(() => {
    if (profile?.organization_id) {
      fetchInkSupplierPartners();
    }
  }, [profile?.organization_id]);

  useEffect(() => {
    if (selectedPartnerId) {
      fetchPartnerLocations();
    } else {
      setPartnerLocations([]);
      setSelectedLocationId('');
    }
  }, [selectedPartnerId]);

  // Set print condition name - use resolved name from RPC function
  useEffect(() => {
    if (matchRequest?.print_condition_name) {
      setPrintConditionName(matchRequest.print_condition_name);
    } else if (matchRequest?.print_condition) {
      setPrintConditionName(matchRequest.print_condition);
    }
  }, [matchRequest?.print_condition_name, matchRequest?.print_condition]);

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
        .eq('collect_color_matches', true)
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
      
      // Auto-select if only one location
      if (locations.length === 1) {
        setSelectedLocationId(locations[0].id);
      }
    } catch (error) {
      console.error('Failed to fetch partner locations:', error);
      toast({
        title: 'Error',
        description: 'Failed to load partner locations',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <Label htmlFor="partner">Partner Organization</Label>
        <Select value={selectedPartnerId} onValueChange={onPartnerChange} disabled={loading}>
          <SelectTrigger className="focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0">
            <SelectValue placeholder={loading ? "Loading partners..." : "Choose an ink supplier"} />
          </SelectTrigger>
          <SelectContent>
            {inkSupplierPartners.map((partner) => (
              <SelectItem 
                key={partner.id} 
                value={partner.id}
                className="hover:bg-muted cursor-pointer"
              >
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

      <div>
        <Label htmlFor="location">Partner Location</Label>
        <Select 
          value={selectedLocationId} 
          onValueChange={setSelectedLocationId}
          disabled={!selectedPartnerId || partnerLocations.length === 0}
        >
          <SelectTrigger className="focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0">
            <SelectValue placeholder={
              !selectedPartnerId 
                ? "Select ink supplier first" 
                : partnerLocations.length === 0 
                  ? "No locations available" 
                  : "Select location"
            } />
          </SelectTrigger>
          <SelectContent className="bg-background border z-[1000]">
            {partnerLocations.map((location) => (
              <SelectItem 
                key={location.id} 
                value={location.id}
                className="hover:bg-muted cursor-pointer"
              >
                {location.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {partnerLocations.length === 0 && selectedPartnerId && (
          <p className="text-xs text-muted-foreground mt-1">
            No partner locations found for the selected ink supplier
          </p>
        )}
      </div>

      <div>
        <Label htmlFor="printCondition">Print Condition</Label>
        <Button 
          variant="outline" 
          className="w-full justify-start text-left font-normal pointer-events-none text-muted-foreground bg-muted"
          disabled
        >
          {printConditionName || 'Print condition will be specified later'}
        </Button>
        <p className="text-xs text-muted-foreground mt-1">
          Print condition from original match request (cannot be changed)
        </p>
      </div>
    </div>
  );
};

export default RouteStep2PrinterDetails;