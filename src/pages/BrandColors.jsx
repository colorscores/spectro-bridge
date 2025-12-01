
import React, { useState, useMemo, useCallback, useRef, useEffect, lazy, Suspense, startTransition } from 'react';
import { Helmet } from 'react-helmet-async';
import { AnimatePresence } from 'framer-motion';
import { useAppContext } from '@/context/AppContext';

import ColorsHeader from '@/components/colors/ColorsHeader';
import SpectroMeasureDialog from '@/components/colors/SpectroMeasureDialog';
import ColorsTableToolbar from '@/components/colors/ColorsTableToolbar';
import ColorsTable from '@/components/colors/ColorsTable';
import ColorDetailPane from '@/components/colors/ColorDetailPane';
import ColorLoadingSkeleton from '@/components/colors/ColorLoadingSkeleton';
import { useNavigate, useLocation } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';

import CxfAddColorDialog from '@/components/colors/CxfAddColorDialog';
import { useCgatsImport } from '@/hooks/useCgatsImport';

import LargeFileWarningDialog from '@/components/colors/LargeFileWarningDialog';

import AssignTagsDialog from '@/components/colors/AssignTagsDialog';
import AddToBookDialog from '@/components/colors/AddToBookDialog';
import ChangeColorTypeDialog from '@/components/colors/ChangeColorTypeDialog';
import DeleteColorsDialog from '@/components/colors/DeleteColorsDialog';
import RemoveDuplicatesDialog from '@/components/colors/RemoveDuplicatesDialog';
import EditColorDialog from '@/components/colors/EditColorDialog';
import AddColorBookDialog from '@/components/colors/AddColorBookDialog';
import { toast } from "@/hooks/use-toast";
import { computeColorsView } from '@/hooks/useMemoizedColors';

import { cxfParser } from '@/lib/cxfParser';
import RemoveFromBookDialog from '@/components/colors/RemoveFromBookDialog';
import DeleteColorBookDialog from '@/components/colors/DeleteColorBookDialog';
import ColorsFilterPane from '@/components/colors/ColorsFilterPane';
import { supabase } from '@/lib/customSupabaseClient';
import MergeModesDialog from '@/components/colors/MergeModesDialog';
import { useProfile } from '@/context/ProfileContext';
import MatchRequestWizardDialog from '@/components/MatchRequestWizardDialog';
import MatchRequirementsDialog from '@/components/match-request/MatchRequirementsDialog';
import MultiFormatExportDialog from '@/components/export/MultiFormatExportDialog';
import { useCxfImport } from '@/hooks/useCxfImport';
import { useColorViews } from '@/context/ColorViewsContext';

const BrandColors = () => {
  const { colors, colorBooks, associations, loading, error, refetch: refetchColors } = useAppContext();
  const { profile } = useProfile();
  const { getViewData, isReady: viewsReady } = useColorViews();
  
  // CGATS import hook (must be at top level with other hooks)
  const {
    fileInputRef: cgatsFileInputRef,
    isCgatsAddOpen,
    cgatsColors,
    setIsCgatsAddOpen,
    handleAddCgatsClick,
    handleFileChange: handleCgatsFileChange,
    handleAddColorsFromCgats,
    isLoading: isCgatsLoading,
    isTransforming: isCgatsTransforming,
    fileMetadata: cgatsFileMetadata,
    showLargeFileWarning: cgatsShowLargeFileWarning,
    processingStage: cgatsProcessingStage
  } = useCgatsImport();
  
  // CxF import hook
  const {
    fileInputRef: cxfFileInputRef,
    isCxfAddOpen,
    setIsCxfAddOpen,
    cxfColors,
    handleAddColorClick: handleCxfImportClick,
    handleFileChange: handleCxfFileChange,
    handleAddColorsFromCxf,
    isLoading: cxfIsLoading,
    isTransforming: cxfIsTransforming,
    parseProgress: cxfParseProgress,
    fileMetadata: cxfFileMetadata,
    resetAllImportState
  } = useCxfImport(refetchColors, profile);
  
  // Advanced filter pane state (declared early to avoid TDZ with hooks using it)
  const [filterPaneOpen, setFilterPaneOpen] = useState(false);
  const orgTypes = Array.isArray(profile?.organization?.type)
    ? profile.organization.type
    : (profile?.organization?.type ? [profile.organization.type] : []);
  const isBrandOrg = orgTypes.some(t => /brand owner/i.test(t));
  const isPartnerOrg = !isBrandOrg;
  
  // Load organization options for filters
  const [partnerOrgOptions, setPartnerOrgOptions] = useState([]);
  const [brandOrgOptions, setBrandOrgOptions] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = searchTerm; // Remove debounce to avoid hook issues
  const [viewMode, setViewMode] = useState('flat');
  const [openGroups, setOpenGroups] = useState(new Set());
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });
  
  const setViewModeDeferred = useCallback((nextMode) => {
    startTransition(() => setViewMode(nextMode));
  }, []);
  
  const scrollContainerRef = useRef(null);
  const navigate = useNavigate();
  

  const [dialogs, setDialogs] = useState({
    isAssignTagsOpen: false,
    isEditDialogOpen: false,
    isDeleteDialogOpen: false,
    isAddToBookOpen: false,
    isRemoveFromBookOpen: false,
    isChangeTypeOpen: false,
    isRemoveDuplicatesOpen: false,
    isDeleteBookOpen: false,
    isCgatsImportOpen: false,
    isAddBookOpen: false,
    isMergeModesOpen: false,
    isMatchRequestOpen: false,
    isMatchRequirementsOpen: false,
    isCxfExportOpen: false,
    isMeasureDialogOpen: false,
  });
  
  // Advanced filter pane state
  const [filterRows, setFilterRows] = useState([]);
  const [pcColorIds, setPcColorIds] = useState({ id: null, ids: new Set() });
  const [printConditions, setPrintConditions] = useState([]);
  const location = useLocation();
  

  // Deep-link filter support via query params -> initialize filterRows
  useEffect(() => {
    try {
      const params = new URLSearchParams(location.search || '');
      const rows = [];
      const tagParam = params.get('tag_id');
      if (tagParam) {
        const tagIds = tagParam.split(',').map(s => s.trim()).filter(Boolean);
        if (tagIds.length) rows.push({ id: 'tags', property: 'tags', value: tagIds });
      }
      const standardTypeParam = params.get('standard_type');
      const pcParam = params.get('print_condition_id');
      if (standardTypeParam && ['master','dependent'].includes(standardTypeParam.toLowerCase())) {
        rows.push({ id: 'std', property: 'standardType', value: { type: standardTypeParam.toLowerCase(), printConditionId: pcParam || null } });
      }
      if (rows.length) setFilterRows(rows);
    } catch {}
  }, [location.search]);

  // Load dependent color associations for selected print condition
  useEffect(() => {
    const run = async () => {
      const stdRow = (filterRows || []).find(r => r.property === 'standardType');
      const stdType = stdRow?.value?.type;
      const pcId = stdRow?.value?.printConditionId || null;
      if (stdType === 'dependent' && pcId) {
        const { data, error } = await supabase
          .from('color_print_condition_associations')
          .select('color_id')
          .eq('print_condition_id', pcId);
        if (!error) {
          setPcColorIds({ id: pcId, ids: new Set((data || []).map(r => r.color_id)) });
        } else {
          console.error('Failed to load color-print associations', error);
          setPcColorIds({ id: null, ids: new Set() });
        }
      } else {
        setPcColorIds({ id: null, ids: new Set() });
      }
    };
    run();
  }, [filterRows]);

// Build tag options from colors (no-hook computation)
const tagOptions = (() => {
  const map = new Map();
  (colors || []).forEach(c => {
    (c.tags || []).forEach(t => {
      if (t?.id && t?.name && !map.has(t.id)) map.set(t.id, t.name);
    });
  });
  return Array.from(map.entries())
    .map(([value, label]) => ({ value, label }))
    .sort((a,b)=>a.label.localeCompare(b.label));
})();

  // Lazy-load print conditions when pane opens
  useEffect(() => {
    const fetchPCs = async () => {
      const { data, error } = await supabase.from('print_conditions').select('id,name');
      if (!error) setPrintConditions(data || []);
    };
    if (filterPaneOpen && printConditions.length === 0) fetchPCs();
  }, [filterPaneOpen, printConditions.length]);

  // Load organization options when filter pane opens
  useEffect(() => {
    const loadOrgOptions = async () => {
      if (isBrandOrg && partnerOrgOptions.length === 0) {
        // Load partner organizations for "Shared to" filter
        const { data, error } = await supabase
          .from('organizations')
          .select('id, name')
          .contains('type', ['partner']);
        if (!error && data) {
          setPartnerOrgOptions(data.map(org => ({ value: org.id, label: org.name })));
        }
      } else if (isPartnerOrg && brandOrgOptions.length === 0) {
        // Load brand organizations for "Owner" filter - use unique org names from colors
        const uniqueOwners = [...new Set(
          (colors || [])
            .map(c => c.owner_org_name)
            .filter(Boolean)
        )].sort();
        setBrandOrgOptions(uniqueOwners.map(name => ({ value: name, label: name })));
      }
    };
    if (filterPaneOpen) loadOrgOptions();
  }, [filterPaneOpen, isBrandOrg, isPartnerOrg, partnerOrgOptions.length, brandOrgOptions.length, colors]);


// Filter helpers (no-hook computation)
const isFilterActive = (() => {
  return (filterRows || []).some(r => {
    if (!r.property) return false;
    const v = r.value;
    if (r.property === 'standardType') return v?.type === 'master' || v?.type === 'dependent';
    if (r.property === 'tags') return Array.isArray(v) && v.length > 0;
    if (r.property === 'measurementMode') return Array.isArray(v) && v.length > 0;
    if (r.property === 'sharedTo') return Array.isArray(v) && v.length > 0;
    if (r.property === 'owner') return Array.isArray(v) && v.length > 0;
    if (r.property === 'createdDate' || r.property === 'updatedDate') return !!(v?.start || v?.end);
    return false;
  });
})();

  const addFilterRow = useCallback(() => {
    const id = `row-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setFilterRows(prev => [...prev, { id, property: '', value: null }]);
  }, []);

  const changeFilterRow = useCallback((id, patch) => {
    setFilterRows(prev => {
      const updated = prev.map(r => r.id === id ? { ...r, ...patch } : r);
      console.log('🔍 Filter row changed:', { id, patch, updated });
      return updated;
    });
  }, []);

  const removeFilterRow = useCallback((id) => {
    setFilterRows(prev => prev.filter(r => r.id !== id));
  }, []);

  const clearFilters = useCallback(() => {
    setFilterRows([]);
  }, []);

// Compute filtered colors (memoized to prevent unnecessary recomputations)
const filteredColors = useMemo(() => {
  console.log('🔍 Computing filtered colors with filterRows:', filterRows);
  if (!colors) return [];
  
  // Debug: Check if measurements are present in the colors array
  const sampleWithMeasurements = colors.find(c => c.measurements?.length > 0);
  console.log('🎨 BrandColors - Colors data check:', {
    totalColors: colors.length,
    sampleName: sampleWithMeasurements?.name || 'none found',
    sampleMeasurements: sampleWithMeasurements?.measurements?.length || 0,
    sampleModes: sampleWithMeasurements?.measurements?.map(m => m.mode) || []
  });
  
  const term = (debouncedSearchTerm || '').trim().toLowerCase(); // Use debounced search
  let filtered = colors.filter(color => {
    if (!term) return true;
    const name = (color.name || '').toLowerCase();
    const hex = (color.hex || '').toLowerCase();
    const code = (color.code || '').toLowerCase();
    const tags = (color.tags || []).map(t => (t.name || '').toLowerCase());
    return (
      name.includes(term) ||
      hex.includes(term) ||
      code.includes(term) ||
      tags.some(t => t.includes(term))
    );
  });

  // Apply advanced filters from filterRows (AND across rows)
  filtered = filtered.filter(color => {
    let include = true;

    for (const row of (filterRows || [])) {
      if (!row?.property) continue;
      const v = row.value;

      if (row.property === 'tags') {
        const selected = Array.isArray(v) ? v : [];
        const operator = row.operator || 'includes';
        if (selected.length > 0) {
          const colorTagIds = (color.tags || []).map(t => t.id);
          const hasAny = colorTagIds.some(id => selected.includes(id));
          if (operator === 'includes' && !hasAny) { include = false; break; }
          if (operator === 'excludes' && hasAny) { include = false; break; }
        }
      }

      if (row.property === 'standardType') {
        const type = v?.type;
        const operator = row.operator || 'is';
        if (type === 'master') {
          const isMaster = !color.master_color_id && (!color.standard_type || color.standard_type === 'master');
          if (operator === 'is' && !isMaster) { include = false; break; }
          if (operator === 'isNot' && isMaster) { include = false; break; }
        } else if (type === 'dependent') {
          const isDependent = !!color.master_color_id || color.standard_type === 'dependent';
          if (operator === 'is' && !isDependent) { include = false; break; }
          if (operator === 'isNot' && isDependent) { include = false; break; }
          const pcId = v?.printConditionId || null;
          if (pcId && pcColorIds.id === pcId) {
            if (!pcColorIds.ids.has(color.id)) { include = false; break; }
          }
        }
      }

      if (row.property === 'measurementMode') {
        const modes = Array.isArray(v) ? v : [];
        const operator = row.operator || 'includes';
        if (modes.length > 0) {
          const colorModes = Array.from(new Set((color.measurements || []).map(m => m.mode))).filter(Boolean);
          const hasAny = colorModes.some(m => modes.includes(m));
          if (operator === 'includes' && !hasAny) { include = false; break; }
          if (operator === 'excludes' && hasAny) { include = false; break; }
        }
      }

      if (row.property === 'createdDate') {
        const operator = row.operator || 'between';
        const start = v?.start ? new Date(`${v.start}T00:00:00`) : null;
        const end = v?.end ? new Date(`${v.end}T23:59:59.999`) : null;
        const ts = new Date(color.created_at);
        
        if (operator === 'between' && (start || end)) {
          if (start && ts < start) { include = false; break; }
          if (end && ts > end) { include = false; break; }
        } else if (operator === 'on' && start) {
          const dayEnd = new Date(`${v.start}T23:59:59.999`);
          if (ts < start || ts > dayEnd) { include = false; break; }
        } else if (operator === 'before' && start) {
          if (ts >= start) { include = false; break; }
        } else if (operator === 'after' && start) {
          if (ts <= start) { include = false; break; }
        }
      }

      if (row.property === 'updatedDate') {
        const operator = row.operator || 'between';
        const start = v?.start ? new Date(`${v.start}T00:00:00`) : null;
        const end = v?.end ? new Date(`${v.end}T23:59:59.999`) : null;
        const ts = new Date(color.updated_at || color.created_at);
        
        if (operator === 'between' && (start || end)) {
          if (start && ts < start) { include = false; break; }
          if (end && ts > end) { include = false; break; }
        } else if (operator === 'on' && start) {
          const dayEnd = new Date(`${v.start}T23:59:59.999`);
          if (ts < start || ts > dayEnd) { include = false; break; }
        } else if (operator === 'before' && start) {
          if (ts >= start) { include = false; break; }
        } else if (operator === 'after' && start) {
          if (ts <= start) { include = false; break; }
        }
      }

      if (row.property === 'sharedTo') {
        const selectedPartnerIds = Array.isArray(v) ? v : [];
        const operator = row.operator || 'includes';
        if (selectedPartnerIds.length > 0) {
          // For brand organizations: filter colors that are shared with selected partners
          const colorTagAssociations = (color.tags || []).flatMap(tag => tag.partner_associations || []);
          const colorPartnerIds = colorTagAssociations.map(assoc => assoc.partner_id);
          const hasSharedPartner = selectedPartnerIds.some(partnerId => colorPartnerIds.includes(partnerId));
          if (operator === 'includes' && !hasSharedPartner) { include = false; break; }
          if (operator === 'excludes' && hasSharedPartner) { include = false; break; }
        }
      }

      if (row.property === 'owner') {
        const selectedOrgNames = Array.isArray(v) ? v : [];
        const operator = row.operator || 'includes';
        if (selectedOrgNames.length > 0) {
          // Filter colors based on their owner organization name
          const colorOwnerName = color.owner_org_name;
          const hasSelectedOwner = selectedOrgNames.includes(colorOwnerName);
          if (operator === 'includes' && !hasSelectedOwner) { include = false; break; }
          if (operator === 'excludes' && hasSelectedOwner) { include = false; break; }
        }
      }
    }

    return include;
  });
  
  // Sort colors based on current sort configuration
  return filtered.sort((a, b) => {
    let aValue, bValue;
    
    if (sortConfig.key === 'name') {
      aValue = a.name.toLowerCase();
      bValue = b.name.toLowerCase();
    } else if (sortConfig.key === 'tags') {
      aValue = (a.tags || []).map(tag => tag.name).join(' ').toLowerCase();
      bValue = (b.tags || []).map(tag => tag.name).join(' ').toLowerCase();
    } else if (sortConfig.key === 'updated_at') {
      aValue = new Date(a.updated_at || a.created_at);
      bValue = new Date(b.updated_at || b.created_at);
    }
    
    if (aValue < bValue) {
      return sortConfig.direction === 'asc' ? -1 : 1;
    }
    if (aValue > bValue) {
      return sortConfig.direction === 'asc' ? 1 : -1;
    }
    return 0;
  });
}, [colors, debouncedSearchTerm, filterRows, sortConfig, pcColorIds]);

// Use pre-computed views if available, otherwise compute on-demand
const precomputedViewData = viewsReady ? getViewData(viewMode) : null;

const { assetGroups, allAssets, hierarchicalAssets } = useMemo(() => {
  const hasSearch = !!(debouncedSearchTerm && debouncedSearchTerm.trim());
  const shouldUsePrecomputed = !!precomputedViewData && !isFilterActive && !hasSearch && Array.isArray(colors) && colors.length > 0;

  let result = shouldUsePrecomputed
    ? precomputedViewData
    : computeColorsView(filteredColors, colorBooks, viewMode, colors, associations);
  
  // Apply sorting to allAssets after view computation
  if (result.allAssets && sortConfig) {
    const sortedAssets = [...result.allAssets].sort((a, b) => {
      let aValue, bValue;
      
      if (sortConfig.key === 'name') {
        aValue = (a.name || '').toLowerCase();
        bValue = (b.name || '').toLowerCase();
      } else if (sortConfig.key === 'tags') {
        aValue = (a.tags || []).map(tag => tag.name).join(' ').toLowerCase();
        bValue = (b.tags || []).map(tag => tag.name).join(' ').toLowerCase();
      } else if (sortConfig.key === 'updated_at') {
        aValue = new Date(a.updated_at || a.created_at);
        bValue = new Date(b.updated_at || b.created_at);
      }
      
      if (aValue < bValue) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
    
    result = { ...result, allAssets: sortedAssets };
  }
  
  return result;
}, [precomputedViewData, filteredColors, colorBooks, viewMode, colors, associations, sortConfig, isFilterActive, debouncedSearchTerm]);

  const ID_DELIMITER = '::';

  const [selectedAssetIds, setSelectedAssetIds] = useState(new Set());
  const [selectedBookIds, setSelectedBookIds] = useState(new Set());
  const [activeAssetId, setActiveAssetId] = useState(null);

const selectedAssetForPane = useMemo(() => {
  if (!activeAssetId || !allAssets) return null;
  const cleanId = activeAssetId.split(ID_DELIMITER)[0];
  return allAssets.find(asset => asset.id === cleanId) || null;
}, [activeAssetId, allAssets]);

  const closePane = useCallback(() => {
    setActiveAssetId(null);
  }, []);

  const handleAssetRowClick = useCallback((assetId, bookId = null) => {
    const uniqueId = bookId ? `${assetId}${ID_DELIMITER}${bookId}` : assetId;
    setActiveAssetId(prev => (prev === uniqueId ? null : uniqueId));
  }, []);

  const handleSelectAsset = useCallback((assetId, isSelected, bookId = null) => {
    const uniqueId = bookId ? `${assetId}${ID_DELIMITER}${bookId}` : assetId;
    setSelectedAssetIds(prev => {
      const newSet = new Set(prev);
      if (isSelected) {
        newSet.add(uniqueId);
      } else {
        newSet.delete(uniqueId);
      }
      return newSet;
    });
  }, []);

  const handleSelectBook = useCallback((bookId, isSelected) => {
    setSelectedBookIds(prev => {
      const newSet = new Set(prev);
      if (isSelected) {
        newSet.add(bookId);
      } else {
        newSet.delete(bookId);
      }
      return newSet;
    });
  }, []);

  const handleSelectAll = useCallback((checked, rowsInView) => {
    if (checked) {
      const newAssetIds = new Set();
      const newBookIds = new Set();
      rowsInView.forEach(row => {
        if (row.isGroup) { // It's a book
          newBookIds.add(row.id);
        } else { // It's a color
          const uniqueId = row.parentBookId ? `${row.id}${ID_DELIMITER}${row.parentBookId}` : row.id;
          newAssetIds.add(uniqueId);
        }
      });
      setSelectedAssetIds(newAssetIds);
      setSelectedBookIds(newBookIds);
    } else {
      setSelectedAssetIds(new Set());
      setSelectedBookIds(new Set());
    }
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedAssetIds(new Set());
    setSelectedBookIds(new Set());
  }, []);

  const getSelectedColorIds = useCallback(() => {
    const colorIds = new Set();
    selectedAssetIds.forEach(id => {
      colorIds.add(id.split(ID_DELIMITER)[0]);
    });
    return [...colorIds];
  }, [selectedAssetIds]);

  // Deselect any selected rows that are no longer visible due to filter pane settings.
  // Note: This intentionally DOES NOT react to search changes; it only runs when the
  // filter pane opens or its rows/options change. Book selections remain intact.
  useEffect(() => {
    if (!colors) return;

    const visible = colors.filter(color => {
      let include = true;
      for (const row of (filterRows || [])) {
        if (!row?.property) continue;
        const v = row.value;

        if (row.property === 'tags') {
          const selected = Array.isArray(v) ? v : [];
          if (selected.length > 0) {
            const colorTagIds = (color.tags || []).map(t => t.id);
            const hasAny = colorTagIds.some(id => selected.includes(id));
            if (!hasAny) { include = false; break; }
          }
        }

        if (row.property === 'standardType') {
          const type = v?.type;
          if (type === 'master') {
            if (color.master_color_id) { include = false; break; }
            if (color.standard_type && color.standard_type !== 'master') { include = false; break; }
          } else if (type === 'dependent') {
            const isDependent = !!color.master_color_id || color.standard_type === 'dependent';
            if (!isDependent) { include = false; break; }
            const pcId = v?.printConditionId || null;
            if (pcId && pcColorIds.id === pcId) {
              if (!pcColorIds.ids.has(color.id)) { include = false; break; }
            }
          }
        }

        if (row.property === 'measurementMode') {
          const modes = Array.isArray(v) ? v : [];
          if (modes.length > 0) {
            const colorModes = Array.from(new Set((color.measurements || []).map(m => m.mode))).filter(Boolean);
            const hasAny = colorModes.some(m => modes.includes(m));
            if (!hasAny) { include = false; break; }
          }
        }

        if (row.property === 'createdDate') {
          const start = v?.start ? new Date(`${v.start}T00:00:00`) : null;
          const end = v?.end ? new Date(`${v.end}T23:59:59.999`) : null;
          if (start || end) {
            const ts = new Date(color.created_at);
            if (start && ts < start) { include = false; break; }
            if (end && ts > end) { include = false; break; }
          }
        }

        if (row.property === 'updatedDate') {
          const start = v?.start ? new Date(`${v.start}T00:00:00`) : null;
          const end = v?.end ? new Date(`${v.end}T23:59:59.999`) : null;
          if (start || end) {
            const ts = new Date(color.updated_at || color.created_at);
            if (start && ts < start) { include = false; break; }
            if (end && ts > end) { include = false; break; }
          }
        }

        if (row.property === 'sharedTo') {
          const selectedPartnerIds = Array.isArray(v) ? v : [];
          if (selectedPartnerIds.length > 0) {
            // For brand organizations: filter colors that are shared with selected partners
            const colorTagAssociations = (color.tags || []).flatMap(tag => tag.partner_associations || []);
            const colorPartnerIds = colorTagAssociations.map(assoc => assoc.partner_id);
            const hasSharedPartner = selectedPartnerIds.some(partnerId => colorPartnerIds.includes(partnerId));
            if (!hasSharedPartner) { include = false; break; }
          }
        }

        if (row.property === 'owner') {
          const selectedOrgNames = Array.isArray(v) ? v : [];
          if (selectedOrgNames.length > 0) {
            const hasSelectedOwner = selectedOrgNames.includes(color.owner_org_name);
            if (!hasSelectedOwner) return false;
          }
        }
      }
      return include;
    });

    const visibleIds = new Set(visible.map(c => c.id));

    // Prune selected asset rows that are no longer visible
    setSelectedAssetIds(prev => {
      let changed = false;
      const next = new Set();
      prev.forEach(uid => {
        const clean = uid.split(ID_DELIMITER)[0];
        if (visibleIds.has(clean)) next.add(uid);
        else changed = true;
      });
      return changed ? next : prev;
    });

    // Close detail pane if the active color is no longer visible
    setActiveAssetId(prev => {
      if (!prev) return prev;
      const clean = prev.split(ID_DELIMITER)[0];
      return visibleIds.has(clean) ? prev : null;
    });
  }, [filterPaneOpen, filterRows, pcColorIds, colors]);

  // Define handleDataChanged callback first
  const handleDataChanged = useCallback(() => {
    console.log('BrandColors - handleDataChanged called, refetching colors...');
    refetchColors();
    console.log('BrandColors - clearing selections...');
    clearSelection();
  }, [refetchColors, clearSelection]);

  // Ensure latest colors after returning to list


  
  const BOOK_OPEN_KEY = 'brandColors:bookOpenGroups';
  const initRef = useRef({ lastViewMode: null });
  const lastToggleAtRef = useRef(new Map()); // debounce guard for group toggles
  const assetGroupsRef = useRef(assetGroups);
  const hierarchicalAssetsRef = useRef(hierarchicalAssets);

  // Keep refs updated with latest data
  useEffect(() => {
    assetGroupsRef.current = assetGroups;
    hierarchicalAssetsRef.current = hierarchicalAssets;
  }, [assetGroups, hierarchicalAssets]);

  // Helper to compare Set contents
  const setsEqual = (setA, setB) => {
    if (setA.size !== setB.size) return false;
    for (const item of setA) {
      if (!setB.has(item)) return false;
    }
    return true;
  };

  useEffect(() => {
    // Only initialize openGroups when viewMode changes, not on every data update
    if (initRef.current.lastViewMode === viewMode) {
      return;
    }
    
    initRef.current.lastViewMode = viewMode;
    
    if (viewMode === 'book') {
      // Restore from session or start with all closed on first visit this session
      try {
        const saved = sessionStorage.getItem(BOOK_OPEN_KEY);
        const validIds = new Set((assetGroupsRef.current || []).filter(g => g.id !== 'unassigned').map(g => String(g.id)));
        if (saved) {
          const arr = JSON.parse(saved) || [];
          const filtered = arr.filter((id) => validIds.has(String(id)));
          const nextOpenGroups = new Set(filtered.map(id => String(id)));
          setOpenGroups(prev => setsEqual(prev, nextOpenGroups) ? prev : nextOpenGroups);
        } else {
          const nextOpenGroups = new Set();
          setOpenGroups(prev => setsEqual(prev, nextOpenGroups) ? prev : nextOpenGroups);
        }
      } catch {
        const nextOpenGroups = new Set();
        setOpenGroups(prev => setsEqual(prev, nextOpenGroups) ? prev : nextOpenGroups);
      }
    } else if (viewMode === 'dependent') {
      const groupsToOpen = (hierarchicalAssetsRef.current || []).filter(m => (m.dependents || []).length > 0);
      const nextOpenGroups = new Set(groupsToOpen.map(g => String(g.id)));
      setOpenGroups(prev => setsEqual(prev, nextOpenGroups) ? prev : nextOpenGroups);
    } else {
      const nextOpenGroups = new Set();
      setOpenGroups(prev => setsEqual(prev, nextOpenGroups) ? prev : nextOpenGroups);
    }
  }, [viewMode]);

  // Persist open groups for the session while in book view
  useEffect(() => {
    if (viewMode === 'book') {
      try {
        sessionStorage.setItem(BOOK_OPEN_KEY, JSON.stringify(Array.from(openGroups)));
      } catch {}
    }
  }, [openGroups, viewMode]);

  // Dev-only: log openGroups changes for debugging flicker
  useEffect(() => {
    if (import.meta.env.MODE !== 'production') {
      try {
        console.log('[BrandColors] openGroups changed', Array.from(openGroups));
      } catch {}
    }
  }, [openGroups]);

const selectedColorsForDialogs = useMemo(() => {
  const colorIds = getSelectedColorIds();
  return allAssets.filter(c => colorIds.includes(c.id));
}, [getSelectedColorIds, allAssets]);
  
  const handleOpenDialog = (dialogName) => {
    console.log('BrandColors - handleOpenDialog called with:', dialogName);
    const colorIds = getSelectedColorIds();
    console.log('BrandColors - Selected color IDs:', colorIds);
    
    if (loading) {
      console.log('BrandColors - Still loading, showing toast');
      toast({ title: "Please wait", description: "Data is still loading." });
      return;
    }

    const actionMap = {
      isAssignTagsOpen: { required: 1, message: "Please select at least one color to assign tags." },
      isEditDialogOpen: { required: 1, exact: true, message: "Please select exactly one color to edit." },
      isDeleteDialogOpen: { required: 1, message: "Please select at least one color to delete." },
      isAddToBookOpen: { required: 1, message: "Please select at least one color to add to a book." },
      isChangeTypeOpen: { required: 1, message: "Please select colors to change their type." },
      isRemoveDuplicatesOpen: { required: 2, message: "Please select at least two colors to find duplicates." },
    };

    if (actionMap[dialogName]) {
      const { required, exact, message } = actionMap[dialogName];
      const selectedCount = colorIds.length;
      console.log('BrandColors - Checking selection:', { selectedCount, required, exact });
      if ((exact && selectedCount !== required) || (!exact && selectedCount < required)) {
        console.log('BrandColors - Not enough colors selected, showing toast:', message);
        toast({ title: "Selection Required", description: message });
        return;
      }
    }
    
    console.log('BrandColors - Opening dialog:', dialogName);
    setDialogs(prev => ({ ...prev, [dialogName]: true }));
  };

  const handleMatchClick = () => {
    const colorIds = getSelectedColorIds();
    if (colorIds.length === 0) {
      toast({ title: "Selection Required", description: "Please select at least one color to start a match request." });
      return;
    }
    
    // Check if user has opted out of seeing the requirements dialog
    const hideRequirementsDialog = localStorage.getItem('hideMatchRequirementsDialog') === 'true';
    
    if (hideRequirementsDialog) {
      setDialogs(prev => ({ ...prev, isMatchRequestOpen: true }));
    } else {
      setDialogs(prev => ({ ...prev, isMatchRequirementsOpen: true }));
    }
  };

  const handleRequirementsProceed = () => {
    setDialogs(prev => ({ ...prev, isMatchRequestOpen: true }));
  };
  
  const handleRemoveFromBookClick = () => {
      if (selectedAssetIds.size === 0) {
        toast({ title: "No colors selected", description: "Please select at least one color to remove from a book." });
        return;
      }
      
      // Check if all selected items are colors in books (have bookId)
      const hasInvalidSelection = Array.from(selectedAssetIds).some(id => !id.includes('::'));
      if (hasInvalidSelection) {
        toast({ 
          title: "Invalid Selection", 
          description: "You can only remove colors that are inside a book. Please select colors from the book view.",
          variant: "destructive" 
        });
        return;
      }
      
      setDialogs(prev => ({...prev, isRemoveFromBookOpen: true}));
  };
  
  const handleDeleteBookClick = () => {
    if (selectedBookIds.size > 0) {
       setDialogs(prev => ({...prev, isDeleteBookOpen: true}));
    } else {
      toast({ title: "No books selected", description: "Please select at least one book to delete." });
    }
  };

  const handleExportClick = () => {
    const colorIds = getSelectedColorIds();
    if (colorIds.length === 0) {
      toast({ title: "Selection Required", description: "Please select at least one color to export." });
      return;
    }
    setDialogs(prev => ({ ...prev, isCxfExportOpen: true }));
  };

  // Handle using measured color from spectrophotometer
  const handleUseMeasuredColor = useCallback(async (measurementData) => {
    try {
      // Create color in database with empty name (user will fill it)
      const { data: colorRow, error: colorError } = await supabase
        .from('colors')
        .insert([{
          name: '',
          hex: measurementData.hex || '#888888',
          standard_type: 'master',
          status: 'In Development',
          organization_id: profile?.organization_id
        }])
        .select('id')
        .single();

      if (colorError) throw colorError;

      // Insert measurements for each mode with spectral data
      const measurements = (measurementData.modes || ['M0']).map(mode => ({
        color_id: colorRow.id,
        mode,
        lab: measurementData.lab,
        spectral_data: measurementData.spectral?.[mode] || measurementData.spectral?.M0 || {}
      })).filter(m => Object.keys(m.spectral_data).length > 0);

      if (measurements.length > 0) {
        const { error: measurementError } = await supabase
          .from('color_measurements')
          .insert(measurements);
        if (measurementError) throw measurementError;
      }

      // Close dialog and navigate to new color
      setDialogs(prev => ({ ...prev, isMeasureDialogOpen: false }));
      navigate(`/colors/${colorRow.id}?mode=new&from=measurement`);
    } catch (error) {
      console.error('Error creating measured color:', error);
      toast({
        title: 'Error',
        description: 'Failed to create color from measurement. Please try again.',
        variant: 'destructive'
      });
    }
  }, [profile?.organization_id, navigate, toast]);


  const toggleGroup = useCallback((groupId) => {
    const id = String(groupId);
    const now = Date.now();
    const lastAt = lastToggleAtRef.current.get(id) || 0;
    if (now - lastAt < 200) {
      if (import.meta.env.MODE !== 'production') {
        console.log('[BrandColors] toggleGroup ignored (debounce)', { id, now, lastAt });
      }
      return;
    }
    lastToggleAtRef.current.set(id, now);

    setOpenGroups(prev => {
      const wasOpen = prev.has(id);
      const next = new Set(prev);
      if (wasOpen) {
        next.delete(id);
      } else {
        next.add(id);
      }
      if (import.meta.env.MODE !== 'production') {
        console.log('[BrandColors] toggleGroup', { id, before: wasOpen, after: !wasOpen, size: next.size });
      }
      return next;
    });
  }, []);

  const handleSort = useCallback((key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  }, []);
  
  const selectedItemsCount = selectedAssetIds.size + selectedBookIds.size;
  const canEdit = selectedColorsForDialogs.length === 1;

const canMergeModes = (() => {
  // Only in flat view and when selecting >= 2 colors
  if (viewMode !== 'flat') return false;
  const selected = selectedColorsForDialogs;
  if (!selected || selected.length < 2) return false;
  // Each selected color must have exactly one unique mode
  const modesPerColor = selected.map(c => Array.from(new Set((c.measurements || []).map(m => m.mode))));
  if (modesPerColor.some(m => m.length !== 1)) return false;
  const modes = modesPerColor.map(m => m[0]);
  const uniqueModes = new Set(modes);
  return uniqueModes.size === modes.length;
})();

  const renderSkeletons = () => (
    <div className="p-4 space-y-4">
      {Array.from({ length: 10 }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-full" />
      ))}
    </div>
  );

  // Show optimized loading state
  if (loading) {
    return (
      <div className="flex-1 flex flex-col space-y-6 p-6">
        <ColorLoadingSkeleton rows={15} />
      </div>
    );
  }

  if (error) {
    return <div className="p-4 text-red-500">Error loading colors: {error}</div>;
  }

  return (
    <>
      <Helmet>
        <title>Brand Colors - Spectral</title>
        <meta name="description" content="Manage and view your organization's brand colors." />
      </Helmet>
        <div className="flex flex-col h-full px-6 pt-6 space-y-6">
          <ColorsHeader 
            onAddColorClick={handleCxfImportClick}
            onAddCgatsClick={handleAddCgatsClick}
            onColorsAdded={handleDataChanged}
            onAddBookClick={() => setDialogs(prev => ({ ...prev, isAddBookOpen: true }))}
            onRequestMatchClick={handleMatchClick}
            onMeasureClick={() => setDialogs(prev => ({ ...prev, isMeasureDialogOpen: true }))}
            selectedCount={getSelectedColorIds().length}
            viewMode={viewMode}
            allColors={colors}
            associations={associations}
          />

            <div className="flex-1 flex min-h-0 min-w-0 gap-4">
              <div className="flex-1 flex flex-col bg-white border border-border rounded-lg min-h-0 min-w-0">
              <div className="flex-none pt-6 space-y-6">
                <div className="px-6">
                  <ColorsTableToolbar
                    searchTerm={searchTerm}
                    onSearchTermChange={setSearchTerm}
                    viewMode={viewMode}
                    setViewMode={setViewModeDeferred}
                    numSelected={selectedItemsCount}
                    selectedColors={selectedColorsForDialogs}
                    onEditClick={() => handleOpenDialog('isEditDialogOpen')}
                    onTagClick={() => handleOpenDialog('isAssignTagsOpen')}
                    onDeleteClick={() => handleOpenDialog('isDeleteDialogOpen')}
                    onAddToBookClick={() => handleOpenDialog('isAddToBookOpen')}
                    onRemoveFromBookClick={() => handleOpenDialog('isRemoveFromBookOpen')}
                    onChangeTypeClick={() => handleOpenDialog('isChangeTypeOpen')}
                    onRemoveDuplicatesClick={() => handleOpenDialog('isRemoveDuplicatesOpen')}
                    onDeleteBookClick={() => handleOpenDialog('isDeleteBookOpen')}
                    onToggleFilter={() => setFilterPaneOpen(prev => !prev)}
                    onMergeModesClick={() => handleOpenDialog('isMergeModesOpen')}
                    canMergeModes={canMergeModes}
                    isFilterOpen={filterPaneOpen}
                    isFilterActive={isFilterActive}
                    onExportClick={() => handleOpenDialog('isCxfExportOpen')}
                  />
                </div>
                
                <AnimatePresence>
                  {filterPaneOpen && (
                    <div className="px-6">
                      <ColorsFilterPane
                        open={filterPaneOpen}
                        rows={filterRows}
                        onAddRow={addFilterRow}
                        onRemoveRow={removeFilterRow}
                        onChangeRow={changeFilterRow}
                        onClear={clearFilters}
                        tagOptions={tagOptions}
                        printConditionOptions={printConditions.map(pc => ({ value: pc.id, label: pc.name }))}
                        isBrandOrg={isBrandOrg}
                        isPartnerOrg={isPartnerOrg}
                        partnerLocationOptions={partnerOrgOptions}
                        brandOrgOptions={brandOrgOptions}
                      />
                    </div>
                  )}
                </AnimatePresence>
              </div>
              
              <div className="flex-1 min-h-0 relative overflow-hidden" ref={scrollContainerRef}>
                <ColorsTable
                scrollContainerRef={scrollContainerRef}
                  assetGroups={assetGroups}
                  allAssets={allAssets}
                  hierarchicalAssets={hierarchicalAssets}
                  selectedAssetIds={selectedAssetIds}
                  selectedBookIds={selectedBookIds}
                  activeAssetId={activeAssetId}
                  openGroups={openGroups}
                  handleSelectAll={handleSelectAll}
                  handleSelectBook={handleSelectBook}
                  handleSelectAsset={handleSelectAsset}
                  handleAssetRowClick={handleAssetRowClick}
                  toggleGroup={toggleGroup}
                  sortConfig={sortConfig}
                  onSort={handleSort}
                  viewMode={viewMode}
                />
                </div>
              </div>
              
              <AnimatePresence>
                {selectedAssetForPane && (
                  <ColorDetailPane
                    color={selectedAssetForPane}
                    onClose={closePane}
                    onViewDetails={() => navigate(`/colors/${selectedAssetForPane.id}`)}
                  />
                )}
              </AnimatePresence>
            </div>
            </div>
        
      {/* Import progress dialogs - Unified large file warning */}
      <LargeFileWarningDialog
        isOpen={cgatsShowLargeFileWarning || isCgatsLoading || isCgatsTransforming}
        fileMetadata={cgatsFileMetadata}
        currentStage={
          isCgatsLoading && cgatsProcessingStage === 'reading' ? 'reading' :
          isCgatsTransforming || cgatsProcessingStage === 'parsing' ? 'parsing' :
          null
        }
        progress={null}
      />
      <LargeFileWarningDialog
        isOpen={
          cxfParseProgress?.stage && 
          cxfParseProgress.stage !== 'complete' &&
          !isCxfAddOpen
        }
        fileMetadata={cxfFileMetadata}
        currentStage={
          (!cxfParseProgress && cxfFileMetadata) ? 'reading' :
          (cxfParseProgress?.stage === 'parsing') ? 'parsing' :
          (cxfIsTransforming ? 'transforming' : null)
        }
        progress={cxfParseProgress?.progress ?? null}
      />
      
      <input
        type="file"
        ref={cxfFileInputRef}
        onChange={handleCxfFileChange}
        accept=".cxf,.xml"
        style={{ display: 'none' }}
      />

      <input
        type="file"
        ref={cgatsFileInputRef}
        onChange={handleCgatsFileChange}
        accept=".txt,.cgats"
        style={{ display: 'none' }}
      />

      <CxfAddColorDialog
        isOpen={isCxfAddOpen}
        setIsOpen={setIsCxfAddOpen}
        cxfColors={cxfColors}
        onAddColors={handleAddColorsFromCxf}
        onRefresh={refetchColors}
        importSource="cxf"
        onCancel={resetAllImportState}
      />
      <CxfAddColorDialog
        isOpen={isCgatsAddOpen}
        setIsOpen={setIsCgatsAddOpen}
        cxfColors={cgatsColors}
        onAddColors={handleAddColorsFromCgats}
        onRefresh={handleDataChanged}
        importSource="cgats"
      />
      <AddColorBookDialog
        isOpen={dialogs.isAddBookOpen}
        setIsOpen={(isOpen) => setDialogs(prev => ({ ...prev, isAddBookOpen: isOpen }))}
        onBookAdded={handleDataChanged}
      />
      {dialogs.isEditDialogOpen && canEdit && (
        <EditColorDialog
          isOpen={dialogs.isEditDialogOpen}
          setIsOpen={(isOpen) => setDialogs(prev => ({ ...prev, isEditDialogOpen: isOpen }))}
          onColorEdited={handleDataChanged}
          color={selectedColorsForDialogs[0]}
          allColors={allAssets}
        />
      )}
      {dialogs.isAssignTagsOpen && (
        <AssignTagsDialog
          isOpen={dialogs.isAssignTagsOpen}
          onOpenChange={(isOpen) => setDialogs(prev => ({ ...prev, isAssignTagsOpen: isOpen }))}
          selectedColors={selectedColorsForDialogs}
        />
      )}
      {dialogs.isAddToBookOpen && (
        <AddToBookDialog
          isOpen={dialogs.isAddToBookOpen}
          setIsOpen={(isOpen) => setDialogs(prev => ({ ...prev, isAddToBookOpen: isOpen }))}
          selectedColorIds={selectedColorsForDialogs.map(c => c.id)}
          onSuccess={handleDataChanged}
          colorBooks={colorBooks}
        />
      )}
      {dialogs.isRemoveFromBookOpen && (
        <RemoveFromBookDialog
          isOpen={dialogs.isRemoveFromBookOpen}
          setIsOpen={(isOpen) => setDialogs(prev => ({ ...prev, isRemoveFromBookOpen: isOpen }))}
          context={{ selectedAssetIds }}
          onSuccess={handleDataChanged}
        />
      )}
      {dialogs.isChangeTypeOpen && (
        <ChangeColorTypeDialog
          isOpen={dialogs.isChangeTypeOpen}
          setIsOpen={(isOpen) => setDialogs(prev => ({ ...prev, isChangeTypeOpen: isOpen }))}
          selectedColors={selectedColorsForDialogs}
          onTypeChanged={handleDataChanged}
        />
      )}
      {dialogs.isDeleteDialogOpen && (
        <DeleteColorsDialog
          isOpen={dialogs.isDeleteDialogOpen}
          setIsOpen={(isOpen) => setDialogs(prev => ({ ...prev, isDeleteDialogOpen: isOpen }))}
          selectedColors={selectedColorsForDialogs}
          onColorsDeleted={handleDataChanged}
        />
      )}
      {dialogs.isDeleteBookOpen && (
        <DeleteColorBookDialog
          isOpen={dialogs.isDeleteBookOpen}
          setIsOpen={(isOpen) => setDialogs(prev => ({ ...prev, isDeleteBookOpen: isOpen }))}
          selectedBookIds={[...selectedBookIds]}
          onBooksDeleted={handleDataChanged}
        />
      )}
      {dialogs.isRemoveDuplicatesOpen && (
        <RemoveDuplicatesDialog
          isOpen={dialogs.isRemoveDuplicatesOpen}
          setIsOpen={(isOpen) => setDialogs(prev => ({ ...prev, isRemoveDuplicatesOpen: isOpen }))}
          selectedColorIds={selectedColorsForDialogs.map(c => c.id)}
          onDuplicatesRemoved={handleDataChanged}
        />
      )}
      <MergeModesDialog
        isOpen={dialogs.isMergeModesOpen}
        onOpenChange={(isOpen) => setDialogs(prev => ({ ...prev, isMergeModesOpen: isOpen }))}
        selectedColors={selectedColorsForDialogs}
        onMerged={handleDataChanged}
      />
      <MatchRequirementsDialog
        open={dialogs.isMatchRequirementsOpen}
        onOpenChange={(isOpen) => setDialogs(prev => ({ ...prev, isMatchRequirementsOpen: isOpen }))}
        onProceed={handleRequirementsProceed}
        selectedColors={selectedColorsForDialogs}
      />
      {dialogs.isMatchRequestOpen && (
        <MatchRequestWizardDialog
          isOpen={dialogs.isMatchRequestOpen}
          onClose={() => setDialogs(prev => ({ ...prev, isMatchRequestOpen: false }))}
          selectedColors={selectedColorsForDialogs}
        />
      )}
      <MultiFormatExportDialog
        isOpen={dialogs.isCxfExportOpen}
        setIsOpen={(isOpen) => setDialogs(prev => ({ ...prev, isCxfExportOpen: isOpen }))}
        references={selectedColorsForDialogs.map(color => ({
          color_id: color.id,
          name: color.name,
          lab: { L: color.lab_l, a: color.lab_a, b: color.lab_b },
          reference_lab: { L: color.lab_l, a: color.lab_a, b: color.lab_b },
          from_ink_condition_id: color.from_ink_condition_id
        }))}
        measurementsByColorId={{}}
        inkConditionsData={selectedColorsForDialogs.filter(c => c.from_ink_condition_id).map(c => ({ name: c.name, from_ink_condition_id: c.from_ink_condition_id }))}
        title="Export Selected Colors"
      />
      <SpectroMeasureDialog
        open={dialogs.isMeasureDialogOpen}
        onOpenChange={(isOpen) => setDialogs(prev => ({ ...prev, isMeasureDialogOpen: isOpen }))}
        onUse={handleUseMeasuredColor}
      />
    </>
  );
};

export default BrandColors;
