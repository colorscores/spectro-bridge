import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { MultiSelect } from '@/components/ui/multi-select';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/hooks/use-toast';
import { useProfile } from '@/context/ProfileContext';
import { buildCategoryTree } from '@/lib/categoryUtils';

const EditPartnerDialog = ({ isOpen, setIsOpen, partner, onPartnerUpdated }) => {
  const { profile } = useProfile();
  

  // Check if this is a printer-to-ink-supplier connection (no sharing options)
  const isPrinterToInkSupplier = partner?.partner_roles?.length === 1 && 
    partner?.partner_roles[0] === 'Ink Supplier' &&
    profile?.organization?.type?.includes('Print Supplier');

  const [sharingOption, setSharingOption] = useState('all');
  const [selectedTags, setSelectedTags] = useState([]);
  const [allowDownload, setAllowDownload] = useState(true);
  const [allCategories, setAllCategories] = useState([]);
  const [allTags, setAllTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchSharingData = useCallback(async () => {
    if (!profile?.organization_id || !partner?.id) {
      console.log('EditPartnerDialog: Missing profile organization_id or partner id', { 
        profileOrgId: profile?.organization_id, 
        partnerId: partner?.id 
      });
      setLoading(false);
      return;
    }

    console.log('EditPartnerDialog: Fetching sharing data for org:', profile.organization_id);
    setLoading(true);
    try {
      const [categoriesRes, tagsRes, associationsRes] = await Promise.all([
        supabase.from('categories').select('*').eq('organization_id', profile.organization_id),
        supabase.from('tags').select('id, name, category_id').eq('organization_id', profile.organization_id),
        supabase.from('tag_associations').select('tag_id').eq('partner_id', partner.id),
      ]);

      console.log('EditPartnerDialog: Categories response:', categoriesRes);
      console.log('EditPartnerDialog: Tags response:', tagsRes);
      console.log('EditPartnerDialog: Associations response:', associationsRes);

      if (categoriesRes.error) throw categoriesRes.error;
      setAllCategories(categoriesRes.data || []);

      if (tagsRes.error) throw tagsRes.error;
      setAllTags(tagsRes.data || []);

      if (associationsRes.error) throw associationsRes.error;
      const currentTagIds = associationsRes.data?.map(a => a.tag_id) || [];
      setSelectedTags(currentTagIds);
      setSharingOption(currentTagIds.length > 0 ? 'tags' : 'all');
      
      // Set allow_download from partner data
      setAllowDownload(partner?.allow_download ?? true);

    } catch (error) {
      console.error('EditPartnerDialog: Error fetching sharing data:', error);
      toast({
        variant: 'destructive',
        title: 'Error fetching sharing data',
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  }, [profile?.organization_id, partner?.id, toast]);

  useEffect(() => {
    if (isOpen) {
      fetchSharingData();
    }
  }, [isOpen, fetchSharingData]);

  const handleSaveChanges = async () => {
    if (!partner?.id || !profile?.organization_id) return;

    setIsSubmitting(true);
    try {
      const tagsToSet = sharingOption === 'tags' ? selectedTags : [];
      
      // Update both tags and allow_download setting
      const [tagsResult, updateResult] = await Promise.all([
        supabase.rpc('update_partner_tags', {
          p_partner_id: partner.id,
          p_tag_ids: tagsToSet,
          p_organization_id: profile.organization_id
        }),
        supabase
          .from('partners')
          .update({ allow_download: allowDownload })
          .eq('id', partner.id)
      ]);

      if (tagsResult.error) throw tagsResult.error;
      if (updateResult.error) throw updateResult.error;

      toast({
        title: 'Success!',
        description: 'Partner sharing options have been updated.',
      });
      onPartnerUpdated();
      setIsOpen(false);

    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to update partner',
        description: error.message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const categoryTree = useMemo(() => buildCategoryTree(allCategories), [allCategories]);

  const renderCategoryWithTags = (categoryNode) => {
    const categoryTags = allTags
      .filter(t => t.category_id === categoryNode.id)
      .map(t => ({ label: t.name, value: t.id }));
    
    const childrenContent = categoryNode.children.map(childNode => renderCategoryWithTags(childNode));

    if (categoryTags.length === 0 && childrenContent.every(c => c === null)) {
      return null;
    }

    return (
      <div key={categoryNode.id} className="ml-4 space-y-2 border-l pl-4 py-2">
        <h3 className="font-semibold">{categoryNode.name}</h3>
        {categoryTags.length > 0 && (
          <MultiSelect
            options={categoryTags}
            selected={selectedTags}
            onChange={(selectedValues) => {
              const otherCategoryTags = selectedTags.filter(tagId => !categoryTags.some(ct => ct.value === tagId));
              setSelectedTags([...otherCategoryTags, ...selectedValues]);
            }}
            placeholder={`Select ${categoryNode.name} tags...`}
          />
        )}
        {childrenContent}
      </div>
    );
  };

  // Don't show sharing options for printer-to-ink-supplier connections
  if (isPrinterToInkSupplier) {
    return (
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Partner Connection</DialogTitle>
            <DialogDescription>
              {partner?.name} is configured as an Ink Supplier partner.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="p-4 border rounded-lg bg-blue-50 border-blue-200">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> Printer-to-Ink Supplier connections work through direct match requests. 
                No color library sharing configuration is needed for this type of partnership.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setIsOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[650px]">
        <DialogHeader>
          <DialogTitle>Edit Sharing Options for {partner?.name}</DialogTitle>
          <DialogDescription>
            Control what content from your organization is visible to this partner.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-6">
          <RadioGroup
            value={sharingOption}
            onValueChange={setSharingOption}
            className="flex space-x-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="all" id="all" />
              <Label htmlFor="all">Share all colors</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="tags" id="tags" />
              <Label htmlFor="tags">Limit colors by tags</Label>
            </div>
          </RadioGroup>

          {sharingOption === 'tags' && (
            loading ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              <div>
                <Label className="mb-2 block">Select Tags to Share</Label>
                <div className="space-y-4 rounded-md border p-4 max-h-[400px] overflow-y-auto">
                  {categoryTree.length > 0 ? (
                    categoryTree.map(categoryNode => renderCategoryWithTags(categoryNode))
                  ) : (
                    <p className="text-sm text-muted-foreground mt-2">
                        Your organization has no categories or tags to share.
                    </p>
                  )}
                </div>
              </div>
            )
          )}

          <div className="flex items-center space-x-2">
            <Checkbox
              id="allow-download"
              checked={allowDownload}
              onCheckedChange={setAllowDownload}
            />
            <Label htmlFor="allow-download" className="cursor-pointer">
              Allow downloading of shared colors
            </Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSaveChanges} disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditPartnerDialog;