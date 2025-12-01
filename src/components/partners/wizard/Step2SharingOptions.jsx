import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { MultiSelect } from '@/components/ui/multi-select';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from 'react-hot-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';

const Step2SharingOptions = ({ mode = 'add', data, updateData, userOrganizationId }) => {
  const [categories, setCategories] = useState([]);
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);

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

  const canCollectMatches = Array.isArray(data.selectedOrgRoles) && data.selectedOrgRoles.some(r => typeof r === 'string' && (r.toLowerCase() === 'print supplier' || r.toLowerCase() === 'ink supplier'));

  return (
    <div className="space-y-6">
      {mode === 'edit' && data.verifiedOrg && (
        <Card>
          <CardHeader>
            <CardTitle>Matching Options</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <Checkbox
                id="collectColorMatches"
                checked={!!data.collectColorMatches}
                onCheckedChange={(checked) => {
                  const isChecked = Boolean(checked);
                  updateData({
                    collectColorMatches: canCollectMatches ? isChecked : false,
                    ...(isChecked
                      ? {}
                      : {
                          autoRequestAnalogDrawdowns: false,
                          forceDirectMeasurement: false,
                        }),
                  });
                }}
                disabled={!canCollectMatches}
              />
              <div className="space-y-1">
                <Label htmlFor="collectColorMatches">Collect color matches</Label>
                {!canCollectMatches && (
                  <p className="text-sm text-muted-foreground">Enable by selecting either 'Print Supplier' or 'Ink Supplier' role.</p>
                )}
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Checkbox
                id="autoRequestAnalogDrawdowns"
                checked={!!data.autoRequestAnalogDrawdowns}
                onCheckedChange={(checked) => updateData({ autoRequestAnalogDrawdowns: Boolean(checked) })}
                disabled={!canCollectMatches || !data.collectColorMatches}
              />
              <div className="space-y-1">
                <Label htmlFor="autoRequestAnalogDrawdowns">Auto-request analog drawdowns for color matches</Label>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Checkbox
                id="forceDirectMeasurement"
                checked={!!data.forceDirectMeasurement}
                onCheckedChange={(checked) => updateData({ forceDirectMeasurement: Boolean(checked) })}
                disabled={!canCollectMatches || !data.collectColorMatches}
              />
              <div className="space-y-1">
                <Label htmlFor="forceDirectMeasurement">Force direct measurement of color matches</Label>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Sharing Options</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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

          {data.sharingOption === 'tags' && (
            loading ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              tagOptions.length > 0 ? (
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
              )
            )
          )}

          <div className="flex items-start gap-3 pt-2 border-t">
            <Checkbox
              id="allowDownload"
              checked={data.allowDownload !== false}
              onCheckedChange={(checked) => updateData({ allowDownload: Boolean(checked) })}
            />
            <div className="space-y-1">
              <Label htmlFor="allowDownload">Allow downloading of shared colors</Label>
              <p className="text-sm text-muted-foreground">
                When unchecked, the partner cannot export or download shared colors
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Step2SharingOptions;