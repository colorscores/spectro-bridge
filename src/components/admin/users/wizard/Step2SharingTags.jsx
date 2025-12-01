import React, { useState, useMemo, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { Search } from 'lucide-react';
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { buildCategoryHierarchy } from '@/lib/categoryUtils';
import { supabase } from '@/lib/customSupabaseClient';
import { MultiSelect } from '@/components/ui/multi-select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from '@/hooks/use-toast';

const Step2SharingTags = ({ formData, setFormData, tags, categories, brandPartners = [], orgIsBrand = false, taxonomyLoading = false }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [allowedTagIds, setAllowedTagIds] = useState(new Set());
  const [loadingAllowed, setLoadingAllowed] = useState(false);
  const [hasConstraints, setHasConstraints] = useState(false);
  const [parentsByTag, setParentsByTag] = useState(new Map());
  const [stateResetKey, setStateResetKey] = useState(0);
  
  // Determine operation modes
  const isMyCompanyMode = formData.activeBrandId === 'my-company';
  const isPartnerMode = !orgIsBrand && !isMyCompanyMode;

  // Get expected brand organization ID for data validation
  const expectedBrandOrgId = useMemo(() => {
    // For "My Company" mode, expect user's own organization
    if (isMyCompanyMode) {
      return formData.organizationId;
    }
    
    // For partner mode, get the selected brand's organization
    if (isPartnerMode && formData.activeBrandId) {
      const selectedBrand = brandPartners.find(p => p.id === formData.activeBrandId);
      return selectedBrand?.partner_organization_id || null;
    }
    
    return null;
  }, [isMyCompanyMode, isPartnerMode, formData.activeBrandId, brandPartners, formData.organizationId]);

  // CRITICAL: Reset all component state when brand changes to prevent stale data
  useEffect(() => {
    if (!isPartnerMode && !isMyCompanyMode) return;
    
    const activePartnerId = formData.activeBrandId;
    console.info('[Step2SharingTags] Library owner changed, resetting all state', { 
      newBrandId: activePartnerId, 
      resetKey: stateResetKey + 1,
      isMyCompanyMode,
      isPartnerMode
    });
    
    // Force complete state reset
    setSearchTerm('');
    setSelectedCategory(null);
    setAllowedTagIds(new Set());
    setLoadingAllowed(false);
    setHasConstraints(false);
    setParentsByTag(new Map());
    setStateResetKey(prev => prev + 1);
    
    // Clear any selected tags when library owner changes to avoid confusion
    if (formData.sharingTags && formData.sharingTags.length > 0) {
      console.info('[Step2SharingTags] Clearing selected tags due to library owner change');
      setFormData(prev => ({ ...prev, sharingTags: [] }));
    }
  }, [formData.activeBrandId, isPartnerMode, isMyCompanyMode, setFormData]);



  // Fetch partner-allowed tags when active brand changes
  useEffect(() => {
    if (!isPartnerMode) {
      // No partner constraints in brand organizations
      setAllowedTagIds(new Set());
      setHasConstraints(false);
      return;
    }
    const activePartnerId = formData.activeBrandId;
    if (!activePartnerId) {
      setAllowedTagIds(new Set());
      setHasConstraints(false);
      return;
    }
    
    // Skip RPC call for "My Company" - no constraints needed
    if (activePartnerId === 'my-company') {
      console.info('[SharingTags] My Company selected - no tag constraints');
      setAllowedTagIds(new Set());
      setHasConstraints(false);
      setLoadingAllowed(false);
      return;
    }
    
    let active = true;
    setLoadingAllowed(true);
    console.info('[SharingTags] Loading allowed tags for partner', { partnerId: activePartnerId });
    supabase
      .rpc('get_partner_allowed_tags', { p_partner_id: activePartnerId })
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          console.error('Error loading partner tag constraints', error);
          setAllowedTagIds(new Set());
          setHasConstraints(false);
        } else {
          const ids = new Set((data || []).map(r => r.tag_id || r)); // handle function forms
          setAllowedTagIds(ids);
          setHasConstraints(ids.size > 0);
          console.info('[SharingTags] Allowed tags loaded', { count: ids.size });
        }
      })
      .finally(() => active && setLoadingAllowed(false));
    return () => { active = false };
  }, [formData.activeBrandId, isPartnerMode]);

  // Use taxonomy passed from parent (UserWizard) with brand validation and forced refresh on brand change
  const sourceTags = useMemo(() => {
    const rawTags = tags || [];
    
    // CRITICAL: Validate that tags belong to the expected brand organization
    let validatedTags = rawTags;
    if (isPartnerMode && expectedBrandOrgId && rawTags.length > 0 && formData.activeBrandId !== 'my-company') {
      // Check if any tag has organization_id and filter if they don't match
      const firstTagWithOrgId = rawTags.find(t => t.organization_id);
      if (firstTagWithOrgId && firstTagWithOrgId.organization_id !== expectedBrandOrgId) {
        console.warn('[Step2SharingTags] TAGS MISMATCH: Received tags from wrong org', {
          expectedOrgId: expectedBrandOrgId,
          receivedOrgId: firstTagWithOrgId.organization_id,
          brandId: formData.activeBrandId,
          tagCount: rawTags.length,
          clearing: true
        });
        validatedTags = []; // Clear invalid tags to prevent showing wrong data
      } else {
        console.debug('[Step2SharingTags] Tags validated for brand', {
          expectedOrgId: expectedBrandOrgId,
          receivedOrgId: firstTagWithOrgId?.organization_id,
          brandId: formData.activeBrandId,
          tagCount: rawTags.length
        });
      }
    }
    
    console.debug('[Step2SharingTags] Source tags updated', { 
      count: validatedTags.length, 
      brandId: formData.activeBrandId,
      resetKey: stateResetKey,
      expectedBrandOrgId,
      sampleTags: validatedTags.slice(0, 3).map(t => t.name)
    });
    return validatedTags;
  }, [tags, formData.activeBrandId, stateResetKey, isPartnerMode, expectedBrandOrgId]);

  const sourceCategories = useMemo(() => {
    const rawCategories = categories || [];
    
    // CRITICAL: Validate that categories belong to the expected brand organization  
    let validatedCategories = rawCategories;
    if (isPartnerMode && expectedBrandOrgId && rawCategories.length > 0 && formData.activeBrandId !== 'my-company') {
      // Check if any category has organization_id and filter if they don't match
      const firstCatWithOrgId = rawCategories.find(c => c.organization_id);
      if (firstCatWithOrgId && firstCatWithOrgId.organization_id !== expectedBrandOrgId) {
        console.warn('[Step2SharingTags] CATEGORIES MISMATCH: Received categories from wrong org', {
          expectedOrgId: expectedBrandOrgId,
          receivedOrgId: firstCatWithOrgId.organization_id,
          brandId: formData.activeBrandId,
          categoryCount: rawCategories.length,
          clearing: true
        });
        validatedCategories = []; // Clear invalid categories to prevent showing wrong data
      } else {
        console.debug('[Step2SharingTags] Categories validated for brand', {
          expectedOrgId: expectedBrandOrgId,
          receivedOrgId: firstCatWithOrgId?.organization_id,
          brandId: formData.activeBrandId,
          categoryCount: rawCategories.length
        });
      }
    }
    
    console.debug('[Step2SharingTags] Source categories updated', { 
      count: validatedCategories.length, 
      brandId: formData.activeBrandId,
      resetKey: stateResetKey,
      expectedBrandOrgId,
      sampleCategories: validatedCategories.slice(0, 3).map(c => c.name)
    });
    return validatedCategories;
  }, [categories, formData.activeBrandId, stateResetKey, isPartnerMode, expectedBrandOrgId]);

  // Combined taxonomy loading - show loading if taxonomy is loading OR if we just reset state
  const isTaxLoading = !!taxonomyLoading || (isPartnerMode && formData.activeBrandId && formData.activeBrandId !== 'my-company' && sourceTags.length === 0 && !loadingAllowed);

  // Load tag hierarchies for conflict checks (ancestor/descendant)
  useEffect(() => {
    const ids = (sourceTags || []).map(t => t.id);
    if (!ids.length) {
      setParentsByTag(new Map());
      return;
    }
    let active = true;
    console.debug('[Step2SharingTags] Loading tag hierarchies', { tagCount: ids.length, brandId: formData.activeBrandId });
    supabase
      .from('tag_hierarchies')
      .select('tag_id, parent_tag_id')
      .in('tag_id', ids)
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          console.error('[SharingTags] Failed to load tag hierarchies', error);
          setParentsByTag(new Map());
        } else {
          const map = new Map();
          (data || []).forEach(row => {
            const arr = map.get(row.tag_id) || [];
            arr.push(row.parent_tag_id);
            map.set(row.tag_id, arr);
          });
          console.debug('[Step2SharingTags] Tag hierarchies loaded', { hierarchyCount: map.size });
          setParentsByTag(map);
        }
      });
    return () => { active = false };
  }, [sourceTags, formData.activeBrandId, stateResetKey]);

  // Detect overlap between allowed tags and the partner's taxonomy
  const partnerTagIdSet = useMemo(() => new Set((sourceTags || []).map(t => t.id)), [sourceTags]);
  const overlapAllowedCount = useMemo(() => {
    if (!isPartnerMode || allowedTagIds.size === 0) return 0;
    let cnt = 0;
    allowedTagIds.forEach(id => { if (partnerTagIdSet.has(id)) cnt++; });
    return cnt;
  }, [isPartnerMode, allowedTagIds, partnerTagIdSet]);

  // Only enforce constraints if there is overlap (prevents blank states when taxonomies differ)
  const enforceConstraints = useMemo(() => {
    const active = isPartnerMode && hasConstraints && overlapAllowedCount > 0;
    console.debug('[SharingTags] Constraint enforcement check', {
      isPartnerMode, hasConstraints, overlapAllowedCount, enforceConstraints: active
    });
    return active;
  }, [isPartnerMode, hasConstraints, overlapAllowedCount]);

  // Compute allowed categories based on allowedTagIds (when constraints are enforced)
  const allowedCategoryIds = useMemo(() => {
    if (!formData.activeBrandId || !enforceConstraints) return new Set();
    const ids = new Set();
    (sourceTags || []).forEach(t => {
      if (allowedTagIds.has(t.id)) ids.add(t.category_id);
    });
    return ids;
  }, [allowedTagIds, sourceTags, formData.activeBrandId, enforceConstraints]);

  const hierarchy = useMemo(() => buildCategoryHierarchy(sourceCategories || []), [sourceCategories]);
  const hasAnyTags = useMemo(() => (sourceTags || []).length > 0, [sourceTags]);
  const displayedCategories = useMemo(() => {
    // For "My Company" mode or non-partner mode, show all categories
    if (isMyCompanyMode || !isPartnerMode) return hierarchy || [];
    
    // For partner mode, apply constraints if active brand is selected  
    if (!formData.activeBrandId) return [];
    if (!enforceConstraints) return hierarchy || [];
    if (!hasAnyTags) return hierarchy || [];
    // Filter hierarchy to only categories with at least one allowed tag
    return (hierarchy || []).filter(node => allowedCategoryIds.has(node.id));
  }, [hierarchy, allowedCategoryIds, formData.activeBrandId, isMyCompanyMode, isPartnerMode, enforceConstraints, hasAnyTags]);

  useEffect(() => {
    // Reset selected category only when constraints are active and it becomes invalid
    if (!enforceConstraints) return;
    if (selectedCategory && !allowedCategoryIds.has(selectedCategory.id)) {
      setSelectedCategory(null);
    }
  }, [allowedCategoryIds, selectedCategory, enforceConstraints]);

  const handleCategorySelect = (category) => {
    setSelectedCategory(category);
  };

const filteredTags = useMemo(() => {
    if (!selectedCategory) return [];
    let available = (sourceTags || []).filter(tag => tag.category_id === selectedCategory.id);
    
    // For "My Company" mode, show all tags without constraints
    if (isMyCompanyMode) {
      // No constraints for user's own organization
    } else if (isPartnerMode) {
      if (!formData.activeBrandId) return [];
      if (enforceConstraints) {
        available = available.filter(tag => allowedTagIds.has(tag.id));
      }
    }
    
    if (searchTerm) {
      return available.filter(tag => tag.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }
    return available;
  }, [selectedCategory, sourceTags, searchTerm, allowedTagIds, formData.activeBrandId, isMyCompanyMode, isPartnerMode, enforceConstraints]);

  // Single picklist options (Category / Tag)
  const categoryNameById = useMemo(() => {
    const map = new Map();
    (sourceCategories || []).forEach(c => map.set(c.id, c.name));
    return map;
  }, [sourceCategories]);
  const tagNameById = useMemo(() => {
    const map = new Map();
    (sourceTags || []).forEach(t => map.set(t.id, t.name));
    return map;
  }, [sourceTags]);

  const picklistOptions = useMemo(() => {
    let available = sourceTags || [];
    
    // For "My Company" mode, show all tags without constraints
    if (isMyCompanyMode) {
      // No constraints for user's own organization
    } else if (isPartnerMode) {
      if (!formData.activeBrandId) return [];
      if (enforceConstraints) {
        available = available.filter(t => allowedTagIds.has(t.id));
      }
    }
    
    return available
      .map(t => ({
        value: t.id,
        label: `${categoryNameById.get(t.category_id) || 'Uncategorized'} / ${t.name}`,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [sourceTags, isMyCompanyMode, isPartnerMode, formData.activeBrandId, enforceConstraints, allowedTagIds, categoryNameById]);

  const handleTagSelection = (tagId) => {
    if (isPartnerMode && enforceConstraints && !allowedTagIds.has(tagId)) return; // enforce only when overlap exists
    setFormData(prev => {
      const current = prev.sharingTags || [];
      const newSelectedTags = new Set(current);
      if (newSelectedTags.has(tagId)) {
        newSelectedTags.delete(tagId);
      } else {
        newSelectedTags.add(tagId);
      }
      return { ...prev, sharingTags: Array.from(newSelectedTags) };
    });
  };

  const handleBrandChange = (val) => {
    console.info('[Step2SharingTags] Library owner selection changed', { from: formData.activeBrandId, to: val });
    // State reset will happen via useEffect when activeBrandId changes
    setFormData(prev => ({ ...prev, activeBrandId: val }));
  };

  const isAncestor = (descendantId, ancestorId) => {
    if (!descendantId || !ancestorId) return false;
    if (descendantId === ancestorId) return false;
    const visited = new Set();
    const stack = [descendantId];
    while (stack.length) {
      const cur = stack.pop();
      const parents = parentsByTag.get(cur) || [];
      for (const p of parents) {
        if (p === ancestorId) return true;
        if (!visited.has(p)) {
          visited.add(p);
          stack.push(p);
        }
      }
    }
    return false;
  };

  const findHierarchyConflict = (ids) => {
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = ids[i], b = ids[j];
        if (isAncestor(a, b) || isAncestor(b, a)) {
          return [a, b];
        }
      }
    }
    return null;
  };

  const handlePicklistChange = (vals) => {
    if (!formData.limitByTags) {
      setFormData(prev => ({ ...prev, sharingTags: vals }));
      return;
    }
    const conflict = findHierarchyConflict(vals);
    if (conflict) {
      const [a, b] = conflict;
      toast({
        title: 'Tag Hierarchy Conflict',
        description: `Cannot select both "${tagNameById.get(a) || a}" and "${tagNameById.get(b) || b}" because one is an ancestor of the other.`,
        variant: 'destructive'
      });
      return;
    }
    setFormData(prev => ({ ...prev, sharingTags: vals }));
  };

  const showBrandPicker = (isPartnerMode || isMyCompanyMode) && (brandPartners || []).length > 0;
 
  return (
    <div className="space-y-6 pt-4">
      {showBrandPicker && (
        <div className="max-w-md mx-auto">
          <Label className="font-semibold text-gray-600">Library Owner</Label>
          <Select value={formData.activeBrandId || ''} onValueChange={handleBrandChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select a library owner" />
            </SelectTrigger>
            <SelectContent>
              {formData.selectedBrandIds?.map(brandId => {
                const brand = brandPartners.find(b => b.id === brandId) || 
                  (brandId === 'my-company' ? { id: 'my-company', name: 'My Company', partner_name: 'My Company' } : null);
                return brand ? (
                  <SelectItem key={brand.id} value={brand.id}>
                    {brand.id === 'my-company' ? 'My Company' : (brand.partner_name || brand.name)}
                  </SelectItem>
                ) : null;
              })}
            </SelectContent>
          </Select>
          {loadingAllowed && (
            <p className="text-xs text-muted-foreground mt-1">Loading library data…</p>
          )}
          {isTaxLoading && (
            <p className="text-xs text-muted-foreground mt-1">Loading library taxonomy…</p>
          )}
          {isPartnerMode && formData.activeBrandId && hasConstraints && overlapAllowedCount === 0 && !isTaxLoading && !loadingAllowed && (
            <p className="text-xs text-muted-foreground mt-2">
              This connection has tag constraints that don't match the selected library's taxonomy; showing all tags.
            </p>
          )}
        </div>
      )}

      <div className="max-w-md mx-auto">
        <Label className="font-semibold text-gray-600">Access</Label>
        <RadioGroup
          value={formData.limitByTags ? 'limited' : 'full'}
          onValueChange={(val) => setFormData(prev => ({ ...prev, limitByTags: val === 'limited' }))}
          className="mt-2"
        >
          <label htmlFor="access-full" className="flex items-center gap-2">
            <RadioGroupItem id="access-full" value="full" />
            <span>Full access to shared colors</span>
          </label>
          <label htmlFor="access-limited" className="flex items-center gap-2">
            <RadioGroupItem id="access-limited" value="limited" />
            <span>Limited access to shared colors</span>
          </label>
        </RadioGroup>
      </div>

      {formData.limitByTags && (
        <>
          {isPartnerMode && !formData.activeBrandId ? (
            <div className="text-sm text-muted-foreground p-4 text-center">
              Please select a library owner above to configure tag access.
            </div>
          ) : (
            <div className="max-w-md mx-auto">
              <Label className="font-semibold text-gray-600">Tags</Label>
              <div className="mt-2">
                <MultiSelect
                  options={picklistOptions}
                  selected={formData.sharingTags || []}
                  onChange={handlePicklistChange}
                  placeholder={isPartnerMode && !formData.activeBrandId ? 'Select a library owner first' : 'Select tags...'}
                  disabled={(isPartnerMode && !formData.activeBrandId) || isTaxLoading || loadingAllowed}
                  className="w-full"
                />
                {enforceConstraints && (
                  <p className="text-xs text-muted-foreground mt-2">Limited to partner-permitted tags.</p>
                )}
              </div>
            </div>
          )}
        </>
      )}
      
      {!formData.limitByTags && (
        <div className="text-sm text-muted-foreground p-4 text-center max-w-md mx-auto">
          This user will have full access to all shared colors from the selected libraries.
        </div>
      )}
    </div>
  );
};

export default Step2SharingTags;