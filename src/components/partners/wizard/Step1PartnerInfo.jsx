import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { MultiSelect } from '@/components/ui/multi-select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from 'react-hot-toast';

const Step1PartnerInfo = ({ mode = 'add', data, updateData, userOrganizationId }) => {
  const [sharingCode, setSharingCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState('');
  const [categories, setCategories] = useState([]);
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);

  const handleVerifyCode = useCallback(async () => {
    if (!sharingCode) {
      setError('Please enter a sharing code.');
      return;
    }

    setIsVerifying(true);
    setError('');

    try {
      const { data: result, error } = await supabase
        .from('sharing_codes')
        .select(`
          code,
          expires_at,
          organization:organizations!sharing_codes_organization_id_fkey (
            id,
            name,
            type
          ),
          location:organization_locations!sharing_codes_location_id_fkey (
            id,
            name
          )
        `)
        .eq('code', sharingCode)
        .single();

      if (error || !result) {
        throw new Error('Invalid sharing code');
      }

      if (new Date(result.expires_at) < new Date()) {
        throw new Error('Sharing code has expired');
      }

      updateData({
        sharingCode,
        verifiedOrg: result.organization,
        verifiedLocation: result.location,
      });

      toast.success('Organization verified successfully!');
    } catch (err) {
      setError(err.message);
      toast.error(`Verification failed: ${err.message}`);
    } finally {
      setIsVerifying(false);
    }
  }, [sharingCode, updateData]);

  const fetchData = useCallback(async () => {
    if (!userOrganizationId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [categoriesRes, tagsRes] = await Promise.all([
        supabase.from('categories').select('*').eq('organization_id', userOrganizationId),
        supabase.from('tags').select('id, name, category_id').eq('organization_id', userOrganizationId)
      ]);

      if (categoriesRes.error) throw categoriesRes.error;
      if (tagsRes.error) throw tagsRes.error;

      setCategories(categoriesRes.data || []);
      setTags(tagsRes.data || []);

    } catch (error) {
      console.error('Error fetching sharing options:', error);
      toast.error(`Error fetching sharing options: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [userOrganizationId]);

  useEffect(() => {
    if (userOrganizationId) {
      fetchData();
    } else {
      setLoading(false);
    }
  }, [fetchData, userOrganizationId]);

  const categoryMap = useMemo(() => new Map(categories.map(c => [c.id, c.name])), [categories]);
  const tagOptions = useMemo(() => tags.map(t => ({
    value: t.id,
    label: `${categoryMap.get(t.category_id) || 'Uncategorized'} / ${t.name}`,
  })), [tags, categoryMap]);

  const displayOrgName = data.verifiedOrg?.name || (mode === 'edit' ? data.verifiedOrg?.name || 'Unknown Organization' : '');
  const displayLocationName = data.verifiedLocation?.name || (mode === 'edit' ? data.verifiedLocation?.name || 'Unknown Location' : '');

  // Generate partner role options based on the verified organization's assigned types
  const partnerRoleOptions = useMemo(() => {
    if (!data.verifiedOrg?.type || !Array.isArray(data.verifiedOrg.type)) {
      return [];
    }
    
    return data.verifiedOrg.type.map(type => ({
      value: type,
      label: type
    }));
  }, [data.verifiedOrg?.type]);

  // Check if this is a printer-to-ink-supplier connection (no sharing needed)
  const isPrinterToInkSupplier = userOrganizationId && 
    data.verifiedOrg && 
    data.selectedOrgRoles?.length === 1 && 
    data.selectedOrgRoles[0] === 'Ink Supplier';

  return (
    <div className="space-y-4">
      {mode !== 'edit' && (
        <Card>
          <CardHeader>
            <CardTitle>Verify Organization</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex space-x-2">
              <Input
                placeholder="Enter sharing code"
                value={sharingCode}
                onChange={(e) => setSharingCode(e.target.value)}
                disabled={isVerifying}
              />
              <Button 
                onClick={handleVerifyCode} 
                disabled={!sharingCode || isVerifying}
              >
                {isVerifying ? 'Verifying...' : 'Verify'}
              </Button>
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </CardContent>
        </Card>
      )}

      {data.verifiedOrg && (
        <Card>
          <CardHeader>
            <CardTitle>Organization Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span><strong>Organization:</strong> {displayOrgName}</span>
                {data.verifiedOrg.type && data.verifiedOrg.type.length > 0 && (
                  <span className="text-sm text-muted-foreground">
                    Type: {data.verifiedOrg.type.join(', ')}
                  </span>
                )}
              </div>
              <div className="mt-2">
                <strong>Location:</strong> {displayLocationName}
              </div>
            </div>

            <div className="space-y-3">
              <Label>Select Partner Roles</Label>
              <MultiSelect
                options={partnerRoleOptions}
                selected={Array.isArray(data.selectedOrgRoles) ? data.selectedOrgRoles : []}
                onChange={(selectedValues) => updateData({ selectedOrgRoles: selectedValues })}
                placeholder="Select roles for this partner..."
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sharing options - Hidden for printer-to-ink-supplier connections */}
      {data.verifiedOrg && !isPrinterToInkSupplier && (
        <Card>
          <CardHeader>
            <CardTitle>Sharing Options</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <RadioGroup
              value={data.sharingOption}
              onValueChange={(value) => updateData({ sharingOption: value })}
              className="flex space-x-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="all" id="all" />
                <Label htmlFor="all">Share all colors</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="tags" id="tags" disabled={!loading && tagOptions.length === 0} />
                <Label htmlFor="tags" className={!loading && tagOptions.length === 0 ? "text-muted-foreground" : ""}>Limit colors by tags</Label>
              </div>
            </RadioGroup>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="allow-download"
                checked={data.allowDownload ?? true}
                onCheckedChange={(checked) => updateData({ allowDownload: checked })}
              />
              <Label htmlFor="allow-download" className="cursor-pointer">
                Allow downloading of shared colors
              </Label>
            </div>

            {data.sharingOption === 'tags' && (
              <div className="space-y-4">
                {loading ? (
                  <Skeleton className="h-10 w-full" />
                ) : tagOptions.length > 0 ? (
                  <MultiSelect
                    options={tagOptions}
                    selected={data.selectedTags}
                    onChange={(selectedValues) => updateData({ selectedTags: selectedValues })}
                    placeholder="Select tags to share..."
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Your organization has no categories or tags to share.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Printer-to-ink-supplier connection note */}
      {isPrinterToInkSupplier && (
        <Card>
          <CardContent className="p-4 bg-blue-50 border-blue-200">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> Printer-to-Ink Supplier connections work through direct match requests. No color library sharing is needed.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Step1PartnerInfo;