import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/hooks/use-toast';
import { useProfile } from '@/context/ProfileContext';
import { useRoleAccess } from '@/hooks/useRoleAccess';

const Step1BasicInfo = ({ formData, setFormData, mode }) => {
  const { profile } = useProfile();
  const { isSuperadmin } = useRoleAccess();
  const [organizations, setOrganizations] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loadingLocations, setLoadingLocations] = useState(false);

  useEffect(() => {
    const fetchOrganizations = async () => {
      // Only fetch organizations if user is Superadmin
      if (!isSuperadmin) {
        // For non-Superadmins, just use their current organization
        if (profile?.organization_id) {
          const { data: currentOrg, error: orgErr } = await supabase
            .from('organizations')
            .select('id, name')
            .eq('id', profile.organization_id)
            .single();
          if (!orgErr && currentOrg) {
            setOrganizations([currentOrg]);
          }
        }
        return;
      }

      const { data, error } = await supabase.from('organizations').select('id, name');
      if (error) {
        toast({
          title: 'Error fetching organizations',
          description: error.message,
          variant: 'destructive',
        });
        setOrganizations([]);
        return;
      }
      let orgs = data || [];
      // Ensure the currently assigned org (for edit) is present in the list
      try {
        if (formData?.organizationId && !orgs.some(o => o.id === formData.organizationId)) {
          const { data: currentOrg, error: orgErr } = await supabase
            .from('organizations')
            .select('id, name')
            .eq('id', formData.organizationId)
            .single();
          if (!orgErr && currentOrg) {
            orgs = [currentOrg, ...orgs];
          }
        }
      } catch (e) {
        // noop
      }
      setOrganizations(orgs);
    };
    fetchOrganizations();
  }, [toast, formData?.organizationId, isSuperadmin, profile?.organization_id]);

  useEffect(() => {
    const fetchLocations = async () => {
      const orgId = formData?.organizationId;
      if (orgId) {
        setLoadingLocations(true);
        const { data, error } = await supabase
          .from('organization_locations')
          .select('id, name, organization_id')
          .eq('organization_id', orgId);
        if (error) {
          toast({ title: 'Error fetching locations', description: error.message, variant: 'destructive' });
          setLocations([]);
        } else {
          setLocations(data || []);
        }
        setLoadingLocations(false);
      } else {
        setLocations([]);
      }
    };
    fetchLocations();
  }, [formData?.organizationId, toast]);

  const handleChange = (e) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  const handleCheckedChange = (id, checked) => {
    setFormData(prev => ({ ...prev, [id]: checked }));
  };

  const handleSelectChange = (id, value) => {
    const newFormData = { ...formData, [id]: value };
    if (id === 'organizationId' && value !== formData?.organizationId) {
        newFormData.location = '';
    }
    setFormData(newFormData);
  };

  if (!formData) {
    return null;
  }

  return (
    <div className="space-y-4 max-w-md mx-auto">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="firstName">First Name</Label>
          <Input id="firstName" value={formData.firstName || ''} onChange={handleChange} placeholder="Max" className="placeholder:text-muted-foreground/40"/>
        </div>
        <div>
          <Label htmlFor="lastName">Last Name</Label>
          <Input id="lastName" value={formData.lastName || ''} onChange={handleChange} placeholder="Mustermann" className="placeholder:text-muted-foreground/40"/>
        </div>
      </div>
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" value={formData.email || ''} onChange={handleChange} placeholder="maxmustermann@company.com" className="placeholder:text-muted-foreground/40" />
      </div>
      {mode === 'add' && <div>
        <Label htmlFor="password">Password</Label>
        <Input id="password" type="password" value={formData.password || ''} onChange={handleChange} placeholder="Set a temporary password" className="placeholder:text-muted-foreground/40"/>
      </div>}
      
      {isSuperadmin && (
        <div>
          <Label htmlFor="organizationId">Organization</Label>
          <Select 
            value={formData.organizationId || ''} 
            onValueChange={(value) => handleSelectChange('organizationId', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select an organization" />
            </SelectTrigger>
            <SelectContent className="max-h-[200px] overflow-y-auto">
              {organizations.length > 0 ? (
                organizations.map(org => (
                  <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                ))
              ) : (
                <SelectItem value="no-organizations" disabled>No organizations available</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
      )}

      <div>
        <Label htmlFor="location">Location</Label>
        <Select 
            value={formData.location || ''} 
            onValueChange={(value) => handleSelectChange('location', value)}
            disabled={!formData.organizationId || loadingLocations}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a location" />
          </SelectTrigger>
          <SelectContent>
            {loadingLocations ? (
                <SelectItem value="loading" disabled>Loading locations...</SelectItem>
            ) : locations.length > 0 ? (
                locations.map(loc => (
                    <SelectItem key={loc.name} value={loc.name}>{loc.name}</SelectItem>
                ))
            ) : (
                <SelectItem value="no-locations" disabled>No locations available</SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center space-x-2 pt-2">
        <Checkbox id="allowOtherLocations" checked={formData.allowOtherLocations || false} onCheckedChange={(checked) => handleCheckedChange('allowOtherLocations', checked)} />
        <Label htmlFor="allowOtherLocations" className="font-normal text-sm">Allow user to see other locations</Label>
      </div>
      <div>
        <Label htmlFor="role">Role</Label>
        <Select value={formData.role || 'User'} onValueChange={(value) => handleSelectChange('role', value)}>
          <SelectTrigger>
            <SelectValue placeholder="Select a role" />
          </SelectTrigger>
          <SelectContent>
            {isSuperadmin && <SelectItem value="Superadmin">Superadmin</SelectItem>}
            {isSuperadmin && <SelectItem value="Admin">Admin</SelectItem>}
            <SelectItem value="Color Admin">Color Admin</SelectItem>
            <SelectItem value="Color User">Color User</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <div className="flex items-center space-x-2 pt-2">
        <Checkbox id="limitByTags" checked={formData.limitByTags || false} onCheckedChange={(checked) => handleCheckedChange('limitByTags', checked)} />
        <Label htmlFor="limitByTags" className="font-normal text-sm">Limit content visibility by Organization and/or Sharing tags</Label>
      </div>
    </div>
  );
};

export default Step1BasicInfo;