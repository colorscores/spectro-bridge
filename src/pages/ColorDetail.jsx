import React, { useState, useEffect, useCallback, useMemo, useRef, startTransition } from 'react';
import { Helmet } from 'react-helmet-async';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/hooks/use-toast';
import { motion } from 'framer-motion';
import Breadcrumb from '@/components/Breadcrumb';
import ColorInfoTab from '@/components/colors/ColorInfoTab';
import SimilarColorsTab from '@/components/colors/SimilarColorsTab';
import ColorMatchesTab from '@/components/colors/ColorMatchesTab';
import HistoryTab from '@/components/common/HistoryTab';
import InkBasedColorInfoTab from '@/components/colors/InkBasedColorInfoTab';
import ColorSettingsBox from '@/components/ColorSettingsBox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useColors } from '@/context/ColorContext';
import { useAppContext } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import ColorDetailHeader from '@/components/colors/ColorDetailHeader';
import ImportedColorHeader from '@/components/colors/ImportedColorHeader';
import { useProfile } from '@/context/ProfileContext';
import { useWeightingTools } from '@/context/WeightingToolsContext';
import WeightingFunctionImport from '@/components/colors/WeightingFunctionImport';
import { normalizeColorForUI, applyColorDeltaForUI } from '@/lib/colorNormalization';
import { extractMeasurementSettingsFromRules } from '@/lib/qualitySetUtils';
import { isValidDeltaEMethod, DEFAULT_DELTA_E_METHOD } from '@/lib/constants/deltaEMethods';
import PrintConditionInfo from '@/components/print-conditions/PrintConditionInfo';
import PrintConditionVisuals from '@/components/print-conditions/PrintConditionVisuals';
import PrintConditionSubstrateMismatchCard from '@/components/print-conditions/PrintConditionSubstrateMismatchCard';
import SpectralPlot from '@/components/conditions/SpectralPlot';
import ColorInfoPanel from '@/components/conditions/ColorInfoPanel';
import PrintConditionConstructionPanel from '@/components/print-conditions/PrintConditionConstructionPanel';
import { sortMeasurementModes } from '@/lib/utils/measurementUtils';
import { calculateDeltaE } from '@/lib/deltaE';
import { spectralToLabASTME308, labToHex, labToChromaHue, labToHexD65 } from '@/lib/colorUtils';
import SpectralDataSourceToggle from '@/components/colors/SpectralDataSourceToggle';
import UseColorSpectralDataRunner from '@/components/colors/UseColorSpectralDataRunner';
import PrintColorCardPanel from '@/components/matching/PrintColorCardPanel';

// Silence verbose logs in this module (only keep errors)
const __SILENCE_LOGS__ = false;
// eslint-disable-next-line no-shadow
const console = __SILENCE_LOGS__ ? { ...globalThis.console, log: () => {}, info: () => {}, debug: () => {}, warn: () => {} } : globalThis.console;

// Spectral adaptation functions for substrate mismatch - Method B: Linear Interpolation
const estimateSubstrateBleedSpectral = (substrateSpectral, inkSpectral, tintPercentage) => {
  if (!substrateSpectral || !inkSpectral) return substrateSpectral;
  
  const tintRatio = (tintPercentage || 100) / 100;
  const substrateRatio = 1 - tintRatio;
  const adaptedSpectralData = {};
  
  Object.keys(inkSpectral).forEach(wavelength => {
    const substrateValue = substrateSpectral[wavelength] || 0;
    const inkValue = inkSpectral[wavelength] || 0;
    // Linear interpolation based on tint percentage
    adaptedSpectralData[wavelength] = (substrateValue * substrateRatio) + (inkValue * tintRatio);
  });
  
  return adaptedSpectralData;
};

const estimateSubstrateBleedColor = (substrateHex, tintHex, tintPercentage) => {
  const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  };

  const rgbToHex = (r, g, b) => {
    return "#" + ((1 << 24) + (Math.round(r) << 16) + (Math.round(g) << 8) + Math.round(b)).toString(16).slice(1);
  };

  const substrate = hexToRgb(substrateHex);
  const tint = hexToRgb(tintHex);
  
  if (!substrate || !tint) return substrateHex;

  const bleedFactor = Math.max(0.1, 1 - (tintPercentage / 100) * 0.8);
  
  const blendedR = substrate.r * bleedFactor + tint.r * (1 - bleedFactor);
  const blendedG = substrate.g * bleedFactor + tint.g * (1 - bleedFactor);
  const blendedB = substrate.b * bleedFactor + tint.b * (1 - bleedFactor);
  
  return rgbToHex(blendedR, blendedG, blendedB);
};

const ColorDetail = () => {
    const { appMode, setAppMode, setNavGroupSelections } = useAppContext();
    const { colorId } = useParams();
    const navigate = useNavigate();
    // Use the correctly implemented substrate bleed function defined above

    // Lab value interpolation for substrate adaptation
    const estimateSubstrateBleedLab = (substrateLab, inkLab, tintPercentage) => {
        if (!substrateLab || !inkLab) return substrateLab;
        
        const tintRatio = (tintPercentage || 100) / 100;
        const substrateRatio = 1 - tintRatio;
        
        return {
            L: (substrateLab.L * substrateRatio) + (inkLab.L * tintRatio),
            a: (substrateLab.a * substrateRatio) + (inkLab.a * tintRatio),
            b: (substrateLab.b * substrateRatio) + (inkLab.b * tintRatio)
        };
    };
  const { refetch: refetchColors } = useColors();
    const { updateColorOptimistically, addColorsOptimistically } = useAppContext();
    const { profile } = useProfile();
    const { isEnabled: weightingToolsEnabled, canAccess: canAccessWeightingTools } = useWeightingTools();
    const [color, setColor] = useState(null);
    const [loading, setLoading] = useState(true);
    const [organization, setOrganization] = useState(null);
    const [qualitySet, setQualitySet] = useState(null);
    const [qualitySetDefaults, setQualitySetDefaults] = useState(null);
    const [searchParams] = useSearchParams();
    const fromInkConditionId = searchParams.get('fromInkConditionId');
    const modeParam = searchParams.get('mode');
    const fromParam = searchParams.get('from');
    const isNewFromInk = !!fromInkConditionId;
    const isNewFromSimilar = modeParam === 'new' && fromParam === 'similar';
    const isNewFromMeasurement = modeParam === 'new' && fromParam === 'measurement';
    const isNew = isNewFromInk || isNewFromSimilar || isNewFromMeasurement;
    
    console.log('[ColorDetail] URL analysis:', {
        colorId,
        fromInkConditionId,
        modeParam,
        fromParam,
        isNewFromInk,
        isNewFromSimilar,
        isNew,
        onSaveWillBe: isNew ? 'NULL' : 'handleSaveColorInfo'
    });
    
    // Removed: editParam - no longer using URL-based edit mode for existing colors
    const [fromInkCondition, setFromInkCondition] = useState(null);
    const [saving, setSaving] = useState(false);
    const [isEditing, setIsEditing] = useState(isNew);
    const colorInfoRef = useRef(null);
    const [canSaveNew, setCanSaveNew] = useState(isNew ? Boolean(color?.name?.trim()) : true);
    // Check if this color has a linked ink condition (from database or URL param)
    const hasFromInkCondition = !!fromInkConditionId || !!color?.from_ink_condition_id;
    const [activeTab, setActiveTab] = useState('info');
    const [dynamicTabs, setDynamicTabs] = useState([]);
    const [forcedPrintConditionId, setForcedPrintConditionId] = useState(null);
    const [isPrintPanelOpen, setIsPrintPanelOpen] = useState(false);
    const [printColorData, setPrintColorData] = useState(null);

    // Card-level edit states for existing colors
    const [isEditingColorInfo, setIsEditingColorInfo] = useState(false);
    const [originalColorInfo, setOriginalColorInfo] = useState(null);

    // Reset tab to 'info' when navigating to a different color or for new colors
    useEffect(() => {
        setActiveTab('info');
    }, [colorId, isNew]);

    // Sync local color tags with AppContext cache for optimistic updates
    const { colors } = useAppContext();
    useEffect(() => {
        if (!color?.id || !colors?.length) return;
        
        const cachedColor = colors.find(c => c.id === color.id);
        if (cachedColor && cachedColor.tags) {
            setColor(prev => ({
                ...prev,
                tags: cachedColor.tags
            }));
        }
    }, [colors, color?.id]);

    // Card-level handlers for ColorInfo editing
    const handleEditColorInfo = useCallback(() => {
        if (!color) return;
        setIsEditingColorInfo(true);
        setOriginalColorInfo({
            name: color.name,
            standardType: color.standard_type,
            status: color.status,
            tags: color.tags ? [...color.tags] : []
        });
    }, [color]);

    const handleSaveColorInfo = useCallback(async (updatedData) => {
        if (!color?.id) {
            return;
        }
        
        setSaving(true);
        try {
            // First, save tags via ColorInfoTab's saveChanges if available
            if (colorInfoRef.current?.saveChanges) {
                await colorInfoRef.current.saveChanges();
            }
            
            const { error } = await supabase
                .from('colors')
                .update({
                    name: updatedData.name,
                    standard_type: updatedData.standardType,
                    status: updatedData.status,
                    updated_at: new Date().toISOString()
                })
                .eq('id', color.id);

            if (error) {
                throw error;
            }

            // Update local color state including tags
            setColor(prev => ({
                ...prev,
                ...updatedData,
                standard_type: updatedData.standardType,
                tags: updatedData.tags || prev.tags
            }));

            // Refresh colors in context and wait for it to complete
            await refetchColors();
            
            toast({ title: 'Success', description: 'Color information updated successfully' });
            
            // Only exit edit mode after refetch completes
            setIsEditingColorInfo(false);
            setOriginalColorInfo(null);
        } catch (error) {
            console.error('Error saving color info:', error);
            toast({ 
                title: 'Error', 
                description: 'Failed to save color information. Please try again.', 
                variant: 'destructive' 
            });
        } finally {
            setSaving(false);
        }
    }, [color?.id, refetchColors, toast]);

    const handleCancelColorInfo = useCallback(() => {
        if (originalColorInfo && color) {
            // Restore original values
            setColor(prev => ({
                ...prev,
                name: originalColorInfo.name,
                standard_type: originalColorInfo.standardType,
                status: originalColorInfo.status,
                tags: originalColorInfo.tags
            }));
        }
        setIsEditingColorInfo(false);
        setOriginalColorInfo(null);
    }, [originalColorInfo, color]);

    // Persistent state for "From Ink" tab
    const [fromInkTabState, setFromInkTabState] = useState({
        selectedWedge: null, // Initialize to null to default to solid tint
        selectedPrintConditionId: null,
        showSubstrateOptions: false,
        substrateAdaptationMode: 'adapt',
        substrateDeltaE: null,
        selectedPrintCondition: null,
        selectedBackground: 'Substrate',
        editOriginalPrintConditionId: null,
        activeDataMode: null,
        hasAcceptedAdaptation: false,
        acceptedAdaptationData: null,
        // New persisted flags for stable mismatch behaviour
        hasBeenAdapted: false,
        adaptedForPrintConditionId: null,
    });
    
    // State for tracking mismatch on "From Ink" tab
    const [fromInkHasMismatch, setFromInkHasMismatch] = useState(false);
    
    // State for tracking if Print Condition tab is complete
    const [isPrintConditionComplete, setIsPrintConditionComplete] = useState(false);
    
    // Note: activeDataMode is now managed by fromInkTabState for ink-based colors
    

    // Function to validate print condition name and return completeness
    const validatePrintConditionTab = useCallback((tabId, name) => {
        const isComplete = name && name.trim();
        setIsPrintConditionComplete(isComplete);
        
        // Don't clear alert state based on typing - only clear when actually saved
        return isComplete;
    }, []);

    const handlePrintConditionSave = useCallback(async (tabId) => {
        const tab = dynamicTabs.find(t => t.id === tabId);
        if (!tab) return;

        const condition = { ...tab.prePopulatedData, ...tab.condition };
        
        // Only validate that name is required - other fields are optional
        if (!condition.name?.trim()) {
            toast({ title: "Error", description: "Print condition name is required", variant: "destructive" });
            return;
        }

        setSaving(true);
        try {
            const { data, error } = await supabase
                .from('print_conditions')
                .insert({
                    name: condition.name.trim(),
                    print_process: condition.print_process,
                    substrate_type_id: condition.substrate_type_id,
                    substrate_material_id: condition.substrate_material_id,
                    pack_type: condition.pack_type,
                    version: condition.version,
                    color_hex: condition.color_hex,
                    spectral_data: condition.spectral_data,
                    lab: condition.lab,
                    ch: condition.ch,
                    construction_details: tab.constructionDetails,
                    organization_id: organization?.id,
                    is_part_of_structure: condition.is_part_of_structure
                })
                .select()
                .single();

            if (error) throw error;

            toast({ title: "Success", description: "Print condition saved successfully" });
            
            // Set forced print condition ID to auto-configure Print Condition Info
            setForcedPrintConditionId(data.id);
            
            // Update From-Ink tab state with the newly created print condition
            setFromInkTabState(prev => ({
                ...prev,
                selectedPrintConditionId: data.id,
                selectedPrintCondition: data, // Set the full print condition data
                showSubstrateOptions: false, // Hide mismatch card
                substrateDeltaE: null // Clear mismatch detection
            }));
            
            // Clear mismatch state
            setFromInkHasMismatch(false);
            
            // Trigger color data refresh to update Color Information tab
            setTimeout(() => fetchColorDetails(), 100);
            
            // Remove the tab from dynamicTabs
            setDynamicTabs(prevTabs => prevTabs.filter(t => t.id !== tabId));
            
            // Switch back to From-Ink tab to show the updated selection
            startTransition(() => {
                if (color?.from_ink_condition_id) {
                    setActiveTab('from-ink');
                } else {
                    // Fallback to remaining tabs or info
                    const remainingTabs = dynamicTabs.filter(t => t.id !== tabId);
                    if (remainingTabs.length > 0) {
                        setActiveTab(remainingTabs[0].id);
                    } else {
                        setActiveTab('info');
                    }
                }
            });

            // Clear validation for this tab
            setIsPrintConditionComplete(false);

        } catch (error) {
            console.error('Error saving print condition:', error);
            toast({ 
                title: "Error", 
                description: "Failed to save print condition. Please try again.", 
                variant: "destructive" 
            });
        } finally {
            setSaving(false);
        }
    }, [dynamicTabs, organization?.id, color?.from_ink_condition_id, toast]);

    // DISABLED: Load print condition association - now handled by InkBasedColorInfoTab
    // This effect was causing double-render because it duplicates the query in InkBasedColorInfoTab.loadPersistedSelection
    // InkBasedColorInfoTab is now the single source of truth for print condition association data
    /*
    React.useEffect(() => {
        const loadPrintConditionAssociation = async () => {
            if (!color?.id || !hasFromInkCondition || fromInkTabState.selectedPrintConditionId !== null) return;
            
            try {
                const { data, error } = await supabase
                    .from('color_print_condition_associations')
                    .select('print_condition_id')
                    .eq('color_id', color.id)
                    .maybeSingle();
                
                if (error) throw error;
                
                if (data?.print_condition_id) {
                    // Fetch full print condition details in the same flow
                    let pc = null;
                    try {
                        const { data: pcData } = await supabase
                            .from('print_conditions')
                            .select('*')
                            .eq('id', data.print_condition_id)
                            .maybeSingle();
                        pc = pcData || null;
                    } catch (pcErr) {
                        console.warn('[ColorDetail] Failed to load print condition details:', pcErr);
                    }

                    setFromInkTabState(prev => ({
                        ...prev,
                        selectedPrintConditionId: data.print_condition_id,
                        selectedPrintCondition: pc || prev.selectedPrintCondition
                    }));
                }
            } catch (e) {
                console.warn('[ColorDetail] Failed to load print condition association:', e);
            }
        };
        
        loadPrintConditionAssociation();
    }, [color?.id, hasFromInkCondition, fromInkTabState.selectedPrintConditionId, supabase]);
    */

    // Removed auto-select logic - wait for DB preference only

    // STRICT data mode resolution - no fallbacks, wait for DB preference only
    const resolvedActiveDataMode = useMemo(() => {
        if (!hasFromInkCondition || !color) return undefined;
        
        // STRICT: Only use the explicitly set mode from state or DB
        // If activeDataMode is null, it means we haven't resolved preference yet - gate rendering
        if (fromInkTabState.activeDataMode === null) {
            console.log('[ColorDetail] activeDataMode not resolved yet - gating render');
            return null;
        }
        
        // Use the explicitly resolved mode
        console.log(`[ColorDetail] Using resolved activeDataMode: ${fromInkTabState.activeDataMode}`);
        return fromInkTabState.activeDataMode;
    }, [hasFromInkCondition, color, fromInkTabState.activeDataMode]);

    // Removed: auto-switching to 'from-ink' tab - always default to 'info' tab

    // Default activeDataMode to a sensible value to avoid gating deadlocks
    React.useEffect(() => {
        if (!hasFromInkCondition) return;
        if (fromInkTabState.activeDataMode !== null) return;

        console.log(`[ColorDetail] Setting initial activeDataMode: hasAdaptedData=${color?.hasAdaptedData}, measurements=${color?.measurements?.length || 0}`);
        
        // PRIORITY 1: Check if fromInkCondition has ui_state (especially for creation_origin='from_ink')
        const inkConditionPreference = fromInkCondition?.ui_state?.active_data_mode;
        if (inkConditionPreference && ['imported', 'adapted'].includes(inkConditionPreference)) {
            console.log(`[ColorDetail] Setting activeDataMode from ink condition ui_state: ${inkConditionPreference}`);
            setFromInkTabState(prev => ({ ...prev, activeDataMode: inkConditionPreference }));
            return;
        }
        
        // PRIORITY 2: Prefer adapted when we already have adapted measurements
        if (color?.hasAdaptedData) {
            console.log('[ColorDetail] Setting activeDataMode to adapted (has adapted data)');
            setFromInkTabState(prev => ({ ...prev, activeDataMode: 'adapted' }));
            return;
        }

        // PRIORITY 3: Fall back to imported when ink condition data exists
        if (fromInkCondition && (fromInkCondition.imported_tints || fromInkCondition.spectral_data)) {
            console.log('[ColorDetail] Setting activeDataMode to imported (has ink condition data)');
            setFromInkTabState(prev => ({ ...prev, activeDataMode: 'imported' }));
        }
    }, [hasFromInkCondition, fromInkTabState.activeDataMode, color?.hasAdaptedData, fromInkCondition]);

    // DISABLED: Resolve activeDataMode from DB preference - now handled by InkBasedColorInfoTab
    // This effect was causing double-render because it duplicates the query in InkBasedColorInfoTab.loadPersistedSelection
    // InkBasedColorInfoTab is now the single source of truth for preferred_data_mode and activeDataMode resolution
    /*
    React.useEffect(() => {
        const resolvePreference = async () => {
            if (!hasFromInkCondition || !color?.id) return;
            const pcId = fromInkTabState.selectedPrintConditionId;
            if (!pcId) return;
            // Only resolve when still unresolved (null)
            if (fromInkTabState.activeDataMode !== null) return;
            try {
                const { data, error } = await supabase
                    .from('color_print_condition_associations')
                    .select('id, preferred_data_mode, is_adapted')
                    .eq('color_id', color.id)
                    .eq('print_condition_id', pcId)
                    .maybeSingle();
                if (error) throw error;
                const preferred = data?.preferred_data_mode;
                const assocId = data?.id;
                const isAdapted = data?.is_adapted;
                
                // CRITICAL FIX: Detect and correct contradictory data (is_adapted=true but preferred_data_mode='imported')
                if (isAdapted && preferred && preferred !== 'adapted') {
                    console.log(`[ColorDetail] 🔧 FIXING DATA CONTRADICTION: is_adapted=true but preferred_data_mode='${preferred}' - correcting to 'adapted'`);
                    setFromInkTabState(prev => ({ ...prev, activeDataMode: 'adapted' }));
                    // Persist the correction
                    if (assocId) {
                        await supabase
                            .from('color_print_condition_associations')
                            .update({ preferred_data_mode: 'adapted' })
                            .eq('id', assocId);
                    }
                    return;
                }
                
                if (preferred) {
                    console.log(`[ColorDetail] Setting activeDataMode from DB: ${preferred}`);
                    setFromInkTabState(prev => ({ ...prev, activeDataMode: preferred }));
                    return;
                }
                // One-time safe migration: if we have adapted signals, auto-prefer and persist 'adapted'
                const hasAdaptedSignal = !!data?.is_adapted || !!color?.hasAdaptedData;
                if (hasAdaptedSignal) {
                    console.log('[ColorDetail] Auto-migrating preferred_data_mode to "adapted" based on adapted signals');
                    setFromInkTabState(prev => ({ ...prev, activeDataMode: 'adapted' }));
                    try {
                        if (assocId) {
                            await supabase
                                .from('color_print_condition_associations')
                                .update({ preferred_data_mode: 'adapted', is_adapted: true, adapted_at: new Date().toISOString() })
                                .eq('id', assocId);
                        } else {
                            await supabase.from('color_print_condition_associations').insert({
                                color_id: color.id,
                                print_condition_id: pcId,
                                organization_id: color.organization_id,
                                preferred_data_mode: 'adapted',
                                is_adapted: true,
                                adapted_at: new Date().toISOString(),
                            });
                        }
                        console.log('[ColorDetail] Persisted preferred_data_mode = adapted');
                    } catch (persistErr) {
                        console.warn('[ColorDetail] Failed to persist migrated preferred_data_mode', persistErr);
                    }
                    return;
                }
                console.log('[ColorDetail] No preferred_data_mode in DB and no adapted signal - keeping null to gate rendering');
            } catch (e) {
                console.warn('[ColorDetail] Failed to load preferred_data_mode, keeping null to block rendering', e);
                // Do not set any mode - keep null to block rendering until resolved
            }
        };
        resolvePreference();
    }, [hasFromInkCondition, color?.id, color?.hasAdaptedData, fromInkTabState.selectedPrintConditionId, fromInkTabState.activeDataMode, supabase]);
    */

    // Persist preferred_data_mode when user changes data mode
    React.useEffect(() => {
        const persistPreference = async () => {
            if (!hasFromInkCondition || !color?.id) return;
            const pcId = fromInkTabState.selectedPrintConditionId || color.print_condition_id;
            const mode = fromInkTabState.activeDataMode;
            if (!pcId || !mode) return;

            // Only persist 'adapted' when we truly have adapted signals OR when computed
            const hasAdaptedSignal = (
                mode === 'adapted' && (
                    !!color?.hasAdaptedData || !!fromInkTabState?.hasAcceptedAdaptation
                )
            );
            if (mode === 'adapted' && !hasAdaptedSignal) {
                console.log('[ColorDetail] Skipping persist of adapted mode - no adapted signals');
                return;
            }
            try {
                const { data: updated, error: updErr } = await supabase
                    .from('color_print_condition_associations')
                    .update({ preferred_data_mode: mode })
                    .eq('color_id', color.id)
                    .eq('print_condition_id', pcId)
                    .select();
                if (updErr) throw updErr;
                const updatedCount = Array.isArray(updated) ? updated.length : 0;
                if (updatedCount === 0) {
                    await supabase.from('color_print_condition_associations').insert({
                        color_id: color.id,
                        print_condition_id: pcId,
                        organization_id: color.organization_id,
                        preferred_data_mode: mode,
                        is_adapted: mode === 'adapted',
                        adapted_at: mode === 'adapted' ? new Date().toISOString() : null,
                    });
                }
            } catch (e) {
                console.warn('[ColorDetail] Failed to persist preferred_data_mode', e);
            }
        };
        persistPreference();
    }, [fromInkTabState.activeDataMode, fromInkTabState.selectedPrintConditionId, color?.id, color?.organization_id, color?.print_condition_id, hasFromInkCondition, color?.hasAdaptedData]);

    // Enter edit mode when ?edit=1 or ?edit=true is present
    // Removed: URL-based edit mode for existing colors
    // No longer using ?edit=1 parameter

    // Automatically enter edit mode for colors created from ink conditions


    // Normalize function-valued conditions back to objects to prevent locked state
    React.useEffect(() => {
        setDynamicTabs(prevTabs => 
            prevTabs.map(tab => {
                if (tab.condition && typeof tab.condition === 'function') {
                    console.warn(`Tab ${tab.id}: Converting function condition back to object`);
                    return { ...tab, condition: {} };
                }
                return tab;
            })
        );
    }, [dynamicTabs.length]); // Only run when tabs are added/removed, not on every condition change
    
    // Measurement controls state - shared across all tabs
    const [controls, setControls] = useState({
        mode: 'M1', // Default fallback, will be updated by useEffect
        illuminant: 'D50',
        observer: '2',
        table: '5',
        deltaE: 'dE76'
    });
    
    const [standards, setStandards] = useState({
        illuminants: [],
        observers: [],
        astmTables: [],
        loading: true,
    });

    const availableModes = useMemo(() => sortMeasurementModes(Array.from(new Set((color?.measurements || []).map(m => m.mode)))), [color?.measurements]);
    
    // Derive substrate spectral for selected print condition (fallback to ink substrate)
    const pcSubstrateSpectral = fromInkTabState?.selectedPrintCondition?.substrate_spectral_data
        || fromInkTabState?.selectedPrintCondition?.spectral_data
        || fromInkCondition?.substrate_spectral_data
        || null;
    
// Safely execute the spectral data hook via a runner to avoid dispatcher issues in parent
const [spectralHookResult, setSpectralHookResult] = useState(null);
const spectralDataSource = spectralHookResult?.spectralDataSource;
const availableDataSources = spectralHookResult?.availableDataSources || [];
const canSwitchDataSource = !!spectralHookResult?.canSwitchDataSource;

// Mount the runner when color is available; it returns null visually
// It will push results back into state for this component to use
// Note: This JSX is rendered later in the return tree to preserve layout


    // Central gating logic - only render tabs when DB preference and correct data are ready
    const dataReadyForMode = useMemo(() => {
        if (!hasFromInkCondition) return true; // Non-ink colors don't need gating
        if (!resolvedActiveDataMode || !spectralDataSource) return false;
        const { source, data, isLoading } = spectralDataSource || {};
        if (isLoading || source === 'loading') return false;
        if (resolvedActiveDataMode === 'adapted') {
            const adaptedReady = (source === 'color_measurements' || source === 'computed_adapted') && 
                                 data?.spectral_data && Object.keys(data.spectral_data).length > 0;
            return adaptedReady;
        }
        if (resolvedActiveDataMode === 'imported') {
            const importedReady = (source === 'ink_condition_tints' || source === 'ink_condition_substrate') && 
                                  data?.spectral_data && Object.keys(data.spectral_data).length > 0;
            return importedReady;
        }
        return false;
    }, [hasFromInkCondition, resolvedActiveDataMode, spectralDataSource]);

    const shouldShowGatingMessage = hasFromInkCondition && (!resolvedActiveDataMode || !dataReadyForMode);

    const fetchColorDetails = useCallback(async (options = {}) => {
        const { silent = false } = options;
        if (!silent) setLoading(true);
        try {
            // Bypass materialized view to get fresh data and avoid stale "imported" mode
            // Debug current auth/profile/organization for RLS
            try {
                const dbg = await supabase.rpc('debug_profile_access');
                console.log('[ColorDetail] debug_profile_access:', dbg);
            } catch (e) {
                console.warn('[ColorDetail] debug_profile_access failed:', e);
            }
            // Fetch color data first, then fetch related data in parallel
            const { data: colorRow, error: colorError } = await supabase
                .from('colors')
                .select('*')
                .eq('id', colorId)
                .maybeSingle();
            if (colorError) { console.warn('[ColorDetail] Color fetch error:', colorError); }
            if (!colorRow) {
                // Extra diagnostics to help identify partner/rls state
                try {
                    const partners = await supabase
                        .from('partners')
                        .select('id,status,organization_id,partner_organization_id,sharing_option,updated_at');
                    console.log('[ColorDetail] partners for current org:', partners);
                } catch (e) {
                    console.warn('[ColorDetail] partners fetch failed:', e);
                }
                throw new Error('Color not found or access denied');
            }
            let base = colorRow;

            // Sanitize LAB fields (view can return strings like "undefined")
            const sanitizeLab = (v) => {
                if (v === undefined || v === null) return null;
                if (typeof v === 'string') {
                    const s = v.trim();
                    if (s === '' || s.toLowerCase() === 'undefined' || s.toLowerCase() === 'null' || s.toLowerCase() === 'nan') return null;
                    const n = Number(s);
                    return Number.isFinite(n) ? n : null;
                }
                const n = Number(v);
                return Number.isFinite(n) ? n : null;
            };

            if (base) {
                base = {
                    ...base,
                    lab_l: sanitizeLab(base.lab_l),
                    lab_a: sanitizeLab(base.lab_a),
                    lab_b: sanitizeLab(base.lab_b),
                };
            }

            if (base) {
                // Fetch related data in parallel after we have the color
                const [measurementsResult, editorResult, associationsResult, tagAssocResult] = await Promise.all([
                    supabase.from('color_measurements')
                        .select('id, mode, spectral_data, lab, tint_percentage, illuminant, observer, created_at')
                        .eq('color_id', base.id),
                    base.last_edited_by 
                        ? supabase.from('profiles').select('full_name').eq('id', base.last_edited_by).maybeSingle()
                        : Promise.resolve({ data: null }),
                    supabase.from('color_print_condition_associations')
                        .select('is_adapted')
                        .eq('color_id', base.id),
                    supabase.from('tag_associations')
                        .select('tag_id')
                        .eq('color_id', base.id)
                ]);

                // Fetch tag details if we have tag associations
                const tagIds = (tagAssocResult.data || []).map(ta => ta.tag_id);
                let tags = [];
                if (tagIds.length > 0) {
                    const { data: tagData } = await supabase
                        .from('tags')
                        .select('id, name, category_id')
                        .in('id', tagIds);
                    tags = tagData || [];
                }

                const measurementsFinal = measurementsResult.data || [];
                console.log(`[ColorDetail] Using ${measurementsFinal.length} measurements from parallel fetch:`, 
                    measurementsFinal.map(m => ({ mode: m.mode, tint: m.tint_percentage })));

                // Ensure fields present even if the view doesn't expose them
                let statusValue = base.status;
                if (typeof statusValue === 'undefined') {
                    const { data: statusRow } = await supabase
                        .from('colors')
                        .select('status')
                        .eq('id', base.id)
                        .maybeSingle();
                    statusValue = statusRow?.status || 'Production';
                }

                // Ensure from_ink_condition_id is present even if the view doesn't expose it
                let fromInkConditionIdDb = base.from_ink_condition_id ?? null;
                if (typeof base.from_ink_condition_id === 'undefined') {
                    const { data: fromInkRow } = await supabase
                        .from('colors')
                        .select('from_ink_condition_id')
                        .eq('id', base.id)
                        .maybeSingle();
                    fromInkConditionIdDb = fromInkRow?.from_ink_condition_id ?? null;
                }

                // Use last editor name from parallel fetch
                const last_edited_by_name = editorResult.data?.full_name || null;

                // Check for adapted measurements and reconstruct tint data
                const adaptedMeasurements = measurementsFinal.filter(m => m.mode === 'adapted' && m.tint_percentage !== null && m.tint_percentage !== undefined);
                
                // Check associations for is_adapted flag (already fetched in parallel)
                const hasAdaptedFromAssociations = associationsResult.data?.some(a => a.is_adapted === true) || false;
                
                // hasAdaptedData is true if we have adapted measurements OR associations marked as adapted
                let hasAdaptedData = adaptedMeasurements.length > 0 || hasAdaptedFromAssociations;
                
                console.log(`[ColorDetail] Processing ${base.name}: Found ${adaptedMeasurements.length} adapted measurements out of ${measurementsFinal.length} total, hasAdaptedFromAssociations=${hasAdaptedFromAssociations}, final hasAdaptedData=${hasAdaptedData}`);
                
                if (adaptedMeasurements.length > 0) {
                    // When adapted measurements exist, REPLACE the original imported_tints entirely
                    // This prevents showing both original and adapted data
                    const adaptedTints = adaptedMeasurements.map(m => ({
                        tintPercentage: m.tint_percentage,
                        spectralData: m.spectral_data,
                        lab: m.lab,
                        colorHex: m.lab ? (() => {
                            try {
                                return labToHex(m.lab.L, m.lab.a, m.lab.b);
                            } catch (e) {
                                return '#000000';
                            }
                        })() : '#000000',
                        isAdapted: true, // Mark as adapted data
                        measurements: [{
                            mode: m.mode,
                            spectral_data: m.spectral_data,
                            lab: m.lab
                        }]
                    })).sort((a, b) => a.tintPercentage - b.tintPercentage);
                    
                    // Replace the original imported_tints with adapted data
                    base.imported_tints = adaptedTints;
                    hasAdaptedData = true;
                    console.log(`[ColorDetail] ${base.name}: Replaced imported_tints with ${adaptedTints.length} adapted data points`);
                } else if (base.imported_tints) {
                    // Ensure original imported_tints have the isAdapted flag set to false
                    if (Array.isArray(base.imported_tints)) {
                        base.imported_tints = base.imported_tints.map(tint => ({
                            ...tint,
                            isAdapted: false
                        }));
                    }
                }

                const enriched = { 
                    ...base, 
                    status: statusValue, 
                    from_ink_condition_id: fromInkConditionIdDb, 
                    measurements: measurementsFinal, 
                    last_edited_by_name,
                    hasAdaptedData,
                    tags
                };
                
                console.log(`[ColorDetail] ${base.name}: Final color object has hasAdaptedData=${hasAdaptedData}, measurements.length=${measurementsFinal.length}`);
                
                // Normalize color data for consistent UI consumption
                const normalizedColor = normalizeColorForUI(enriched, measurementsFinal);
                setColor(normalizedColor);
                
                // Update canSaveNew state when color name changes
                if (isNew) {
                    setCanSaveNew(Boolean(normalizedColor?.name?.trim()));
                }
                // Fetch organization defaults
                if (base.organization_id) {
                    const { data: orgData } = await supabase
                        .from('organizations')
                        .select('*')
                        .eq('id', base.organization_id)
                        .single();
                    
                if (orgData) {
                    setOrganization(orgData);
                }
                }
            }
        } catch (error) {
            const message = error?.message === 'Color not found or access denied'
                ? 'This color is not shared with your organization or does not exist.'
                : 'Could not fetch color details.';
            toast({
                title: 'Error',
                description: message,
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    }, [colorId, toast]);

    // Fetch measurement standards
    useEffect(() => {
        const fetchStandards = async () => {
            try {
                const [illuminantsRes, observersRes, astmTablesRes] = await Promise.all([
                    supabase.from('illuminants').select('*'),
                    supabase.from('observers').select('*'),
                    supabase.from('astm_e308_tables').select('*')
                ]);

                if (illuminantsRes.error) throw illuminantsRes.error;
                if (observersRes.error) throw observersRes.error;
                if (astmTablesRes.error) throw astmTablesRes.error;

                setStandards({
                    illuminants: illuminantsRes.data,
                    observers: observersRes.data,
                    astmTables: astmTablesRes.data,
                    loading: false,
                });
            } catch (error) {
                console.error('Error fetching measurement standards:', error);
                setStandards(s => ({ ...s, loading: false }));
            }
        };
        fetchStandards();
    }, []);

    // Fetch ink condition for the "From Ink" tab (from URL param or database field)
    useEffect(() => {
        const inkConditionId = fromInkConditionId || color?.from_ink_condition_id;
        console.log('🔍 [ColorDetail] Checking ink condition fetch:', {
            fromInkConditionId,
            colorFromInkConditionId: color?.from_ink_condition_id,
            inkConditionId,
            hasColor: !!color
        });
        
        if (!inkConditionId) {
            console.log('⚠️ [ColorDetail] No ink condition ID found, skipping fetch');
            return;
        }
        
        const run = async () => {
            try {
                console.log('🚀 [ColorDetail] Fetching ink condition:', inkConditionId);
                const { data, error } = await supabase
                    .from('ink_conditions')
                    .select('*')
                    .eq('id', inkConditionId)
                    .maybeSingle();
                    
                console.log('📦 [ColorDetail] Ink condition fetch result:', { data, error });
                
                if (error) {
                    console.error('❌ [ColorDetail] Error fetching ink condition:', error);
                }
                
                if (!error && data) {
                    console.log('✅ [ColorDetail] Setting ink condition:', data);
                    setFromInkCondition(data);
                } else if (!data) {
                    console.warn('⚠️ [ColorDetail] No ink condition data returned for ID:', inkConditionId);
                }
            } catch (e) {
                console.error('💥 [ColorDetail] Exception fetching ink condition:', e);
            }
        };
        run();
    }, [fromInkConditionId, color?.from_ink_condition_id]);

    // If ink condition has a substrate_condition, fetch and attach its color/lab/spectral so substrate renders
    useEffect(() => {
        const attachSubstrate = async () => {
            if (!fromInkCondition?.substrate_condition) return;
            try {
                // Handle possible composite substrate_condition values like "type_uuid"
                let raw = fromInkCondition.substrate_condition;
                let substrateId = raw;
                if (typeof raw === 'string' && raw.includes('_')) {
                    const maybeUuid = raw.split('_')[1];
                    if (maybeUuid && maybeUuid.length === 36) substrateId = maybeUuid;
                }

                const { data } = await supabase
                    .from('substrate_conditions')
                    .select('color_hex, spectral_data, lab, ch')
                    .eq('id', substrateId)
                    .maybeSingle();
                if (data) {
                    setFromInkCondition((prev) => ({
                        ...prev,
                        substrate_color_hex: data.color_hex,
                        substrate_spectral_data: data.spectral_data,
                        substrate_lab: data.lab,
                        substrate_ch: data.ch,
                    }));
                }
            } catch (e) {
                console.error('Error attaching substrate details:', e);
            }
        };
        attachSubstrate();
    }, [fromInkCondition?.substrate_condition]);

    // Fetch quality sets for the color's organization
    useEffect(() => {
        const fetchQualitySet = async () => {
            if (!color?.organization_id) return;
            
            try {
                const { data: qualitySets, error } = await supabase
                    .from('quality_sets')
                    .select(`
                        id, name, measurement_settings,
                        rules:quality_rules(
                            id, name, reference,
                            levels:quality_levels(id, name, range_from, range_to, action, display_color)
                        )
                    `)
                    .eq('organization_id', color.organization_id)
                    .order('updated_at', { ascending: false })
                    .limit(1);

                if (error) throw error;

                if (qualitySets && qualitySets.length > 0) {
                    const qualitySet = qualitySets[0];
                    setQualitySet(qualitySet);
                    
                    // Extract measurement settings from quality set
                    let extractedSettings = null;
                    if (qualitySet.measurement_settings) {
                        extractedSettings = qualitySet.measurement_settings;
                    } else if (qualitySet.rules && qualitySet.rules.length > 0) {
                        extractedSettings = extractMeasurementSettingsFromRules(qualitySet);
                    }
                    
                    if (extractedSettings) {
                        setQualitySetDefaults(extractedSettings);
                    }
                }
            } catch (error) {
                console.error('Error fetching quality set:', error);
            }
        };

        fetchQualitySet();
    }, [color?.organization_id]);

    // Handler for printing color card
    const handlePrintColorCard = useCallback(() => {
        if (!color) {
            toast({
                title: "No color data",
                description: "Color data not available for printing",
                variant: "destructive"
            });
            return;
        }

        // Get the first measurement with spectral data
        const measurement = color.measurements?.find(m => m.spectral_data && Object.keys(m.spectral_data).length > 0);
        
        if (!measurement?.spectral_data) {
            toast({
                title: "No spectral data",
                description: "This color does not have spectral data available for printing",
                variant: "destructive"
            });
            return;
        }

        // Prepare color data for PrintColorCardPanel
        setPrintColorData({
            name: color.name,
            spectral_data: measurement.spectral_data,
            illuminant: measurement.illuminant || 'D50',
            observer: measurement.observer || '2',
            lab: measurement.lab || color.lab
        });
        setIsPrintPanelOpen(true);
    }, [color, toast]);


    // Normalize deltaE method to ensure consistency
    const normalizeDeltaEMethod = useCallback((method) => {
        if (!method) return DEFAULT_DELTA_E_METHOD;
        
        // Handle common variations and normalize to standard format
        const normalized = method.toString().toLowerCase().trim();
        const mappings = {
            'de2000': 'dE00',
            'de00': 'dE00', 
            'ciede2000': 'dE00',
            'deltae2000': 'dE00',
            'de76': 'dE76',
            'deltae76': 'dE76',
            'cielab': 'dE76',
            'de94': 'dE94',
            'deltae94': 'dE94',
            'decmc': 'dECMC2:1',
            'decmc21': 'dECMC2:1',
            'decmc11': 'dECMC1:1',
            'cmc': 'dECMC2:1',
            'cmc21': 'dECMC2:1',
            'cmc11': 'dECMC1:1'
        };
        
        const mapped = mappings[normalized] || method;
        return isValidDeltaEMethod(mapped) ? mapped : DEFAULT_DELTA_E_METHOD;
    }, []);

    // Update controls based on quality set, available modes, and organization defaults
    useEffect(() => {
        if (!organization) return;

        const getLowestAvailableMode = () => {
            const modeOrder = ['M0', 'M1', 'M2', 'M3'];
            if (availableModes && availableModes.length > 0) {
                return modeOrder.find(mode => availableModes.includes(mode)) || availableModes[0];
            }
            // Fallback to org default or M1 when no measurements available
            return organization?.default_measurement_mode || 'M1';
        };

        let targetMode, targetIlluminant, targetObserver, targetTable, targetDeltaE;

        // Priority 1: Quality set defaults (if quality set mode is available)
        if (qualitySetDefaults) {
            const qualitySetMode = qualitySetDefaults.mode;
            if (qualitySetMode && availableModes.includes(qualitySetMode)) {
                targetMode = qualitySetMode;
                targetIlluminant = qualitySetDefaults.illuminant;
                targetObserver = qualitySetDefaults.observer;
                targetTable = qualitySetDefaults.table;
                targetDeltaE = normalizeDeltaEMethod(qualitySetDefaults.deltaE);
            } else {
                // Quality set mode not available, use lowest available mode but keep other quality set settings
                targetMode = getLowestAvailableMode();
                targetIlluminant = qualitySetDefaults.illuminant;
                targetObserver = qualitySetDefaults.observer;
                targetTable = qualitySetDefaults.table;
                targetDeltaE = normalizeDeltaEMethod(qualitySetDefaults.deltaE);
            }
        } else {
            // Priority 2: Use lowest available mode + organization defaults
            targetMode = getLowestAvailableMode();
            targetIlluminant = organization.default_illuminant || 'D50';
            targetObserver = organization.default_observer || '2';
            targetTable = organization.default_astm_table || '5';
            targetDeltaE = normalizeDeltaEMethod(organization.default_delta_e || 'dE00');
        }

        // Only update if values actually changed to prevent unnecessary rerenders
        setControls(current => {
            if (current.mode === targetMode &&
                current.illuminant === targetIlluminant &&
                current.observer === targetObserver &&
                current.table === targetTable &&
                current.deltaE === targetDeltaE) {
                return current; // No change needed
            }

            console.log('ColorDetail - Updating controls with normalized deltaE:', {
                originalQualitySet: qualitySetDefaults?.deltaE,
                originalOrg: organization.default_delta_e,
                normalized: targetDeltaE,
                modeChanged: current.mode !== targetMode
            });

            return {
                mode: targetMode,
                illuminant: targetIlluminant,
                observer: targetObserver,
                table: targetTable,
                deltaE: targetDeltaE
            };
        });
    }, [organization, qualitySetDefaults, availableModes, normalizeDeltaEMethod]);

    // Ensure solid spectral/lab measurement exists on new-from-ink flow
    useEffect(() => {
        const maybeCopySolid = async () => {
            if (!isNewFromInk || !fromInkCondition || !color?.id) return;
            // Skip if measurements already exist
            if (Array.isArray(color.measurements) && color.measurements.length > 0) return;

            const tints = fromInkCondition.imported_tints?.tints || [];
            const getPct = (t) => (t?.tintPercentage ?? t?.tint ?? t?.tint_percentage);
            const solid = tints.find((t) => getPct(t) === 100) || null;

            let spectral = solid?.spectralData || solid?.spectral_data || null;
            let lab = solid?.lab || null;

            if (!spectral) {
                spectral = fromInkCondition.spectral_data || null;
                lab = fromInkCondition.lab || lab;
            }
            if (!spectral) return;

            const mode = controls.mode || 'M1';
            const { error } = await supabase.from('color_measurements').insert([
                {
                    color_id: color.id,
                    mode,
                    spectral_data: spectral,
                    lab
                }
            ]);
            if (!error) {
                await fetchColorDetails();
            }
        };
        maybeCopySolid();
    }, [isNewFromInk, fromInkCondition, color?.id, controls.mode, fetchColorDetails]);

    useEffect(() => {
        fetchColorDetails();
    }, [fetchColorDetails]);

    // Recompute adapted data when measurement controls change
    useEffect(() => {
        if (!standards?.illuminants || !standards?.astmTables) return;
        
        setDynamicTabs(prevTabs => 
            prevTabs.map(tab => {
                if (tab.type === 'new-print-condition' && 
                    tab.adaptationMode === 'adapt' && 
                    tab.importedSubstrate && 
                    tab.printConditionSubstrate) {
                    
                    const solidCoverage = 100;
                    const adaptedSpectralData = estimateSubstrateBleedSpectral(
                        tab.printConditionSubstrate.spectralData,
                        tab.importedSubstrate.spectralData,
                        solidCoverage
                    );
                    
                    let adaptedLab = null;
                    let adaptedColorHex = null;
                    let adaptedCh = null;
                    
                    if (adaptedSpectralData) {
                        try {
                            const weightingTable = standards.astmTables.filter(t => 
                                t.table_number === parseInt(controls.table || '5', 10) && 
                                t.illuminant_name === controls.illuminant
                            );
                            
                            if (weightingTable.length > 0) {
                                adaptedLab = spectralToLabASTME308(adaptedSpectralData, weightingTable);
                                if (adaptedLab) {
                                    adaptedColorHex = labToHex(adaptedLab.L, adaptedLab.a, adaptedLab.b, controls.illuminant);
                                    adaptedCh = labToChromaHue(adaptedLab.L, adaptedLab.a, adaptedLab.b);
                                }
                            }
                        } catch (error) {
                            console.error('Error recalculating adapted Lab/Color:', error);
                        }
                    }
                    
                    return {
                        ...tab,
                        adaptedData: {
                            spectral_data: adaptedSpectralData,
                            lab: adaptedLab,
                            color_hex: adaptedColorHex,
                            ch: adaptedCh
                        }
                    };
                }
                return tab;
            })
        );
    }, [controls.illuminant, controls.table, standards]);

    // Refetch organization data when component mounts to get latest settings
    useEffect(() => {
        const refetchOrganization = async () => {
            if (organization?.id) {
                console.log('Refetching organization data for ColorDetail page');
                const { data: orgData, error: orgError } = await supabase
                    .from('organizations')
                    .select('*')
                    .eq('id', organization.id)
                    .single();
                
                if (!orgError && orgData) {
                    setOrganization(orgData);
                }
            }
        };
        refetchOrganization();
    }, []); // Empty dependency - runs only on mount

    const handleColorUpdate = async (updatedColor, options = {}) => {
        if (!color?.id) return;
        
        setSaving(true);
        try {
            const updateData = { ...updatedColor };
            
            // Remove view-only fields that don't belong in the base colors table
            delete updateData.tags;
            delete updateData.book_ids;
            delete updateData.book_associations;
            delete updateData.measurements;
            
            // Create payload with only allowed base table columns
            const allowedFields = [
                'name', 'hex', 'standard_type', 'status', 'master_color_id',
                'lab_l', 'lab_a', 'lab_b', 'lab_illuminant', 'lab_observer', 'lab_table',
                'last_edited_by'
            ];
            
            // If updatedColor has lab values, use them directly
            if (updateData.lab_l !== undefined && updateData.lab_a !== undefined && updateData.lab_b !== undefined) {
                // Skip spectral recalculation, use provided Lab values
                if (!updateData.hex && updateData.lab_l !== null && updateData.lab_a !== null && updateData.lab_b !== null) {
                    updateData.hex = labToHex(updateData.lab_l, updateData.lab_a, updateData.lab_b, updateData.lab_illuminant || 'D50');
                }
            } else if (updateData.adapt_to_print_condition && updateData.spectral_data && standards.illuminants?.length > 0 && standards.astmTables?.length > 0) {
                // Recalculate Lab from adapted spectral data with proper standards
                const illuminant = standards.illuminants.find(i => i.name === (controls.illuminant || 'D50'));
                const weightingTable = standards.astmTables.filter(t => 
                    t.table_number === parseInt(controls.table || '5', 10) && 
                    t.illuminant_name === (controls.illuminant || 'D50')
                );
                
                if (weightingTable.length > 0) {
                    const lab = spectralToLabASTME308(updateData.spectral_data, weightingTable);
                    updateData.lab_l = lab.L;
                    updateData.lab_a = lab.a;
                    updateData.lab_b = lab.b;
                    updateData.lab_illuminant = controls.illuminant || 'D50';
                    updateData.lab_observer = controls.observer || '2';
                    updateData.lab_table = controls.table || '5';
                    
                    if (!updateData.hex) {
                        updateData.hex = labToHex(lab.L, lab.a, lab.b, controls.illuminant || 'D50');
                    }
                }
            }

            // Build payload AFTER any recalculations so new Lab/Hex are included
            const allowedPayload = {};
            allowedFields.forEach(field => {
                if (updateData.hasOwnProperty(field)) {
                    allowedPayload[field] = updateData[field];
                }
            });

            if (Object.keys(allowedPayload).length === 0) {
                console.debug('[ColorDetail] Skipping base colors update (no base-table fields in payload)');
            } else {
                const { error } = await supabase
                    .from('colors')
                    .update({
                        ...allowedPayload,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', color.id);
                
                if (error) throw error;
            }

            // Only upsert color measurement if we have valid data to save
            const hasValidLab = updateData.lab_l !== undefined && updateData.lab_a !== undefined && updateData.lab_b !== undefined &&
                                updateData.lab_l !== null && updateData.lab_a !== null && updateData.lab_b !== null;
            const hasValidSpectral = updateData.spectral_data && Object.keys(updateData.spectral_data).length > 0;
            
            if (hasValidLab || hasValidSpectral) {
                const validModes = ['M0', 'M1', 'M2', 'M3'];
                const measurementMode = validModes.includes(controls.mode) ? controls.mode : 'M1';
                
                const measurementData = {
                    color_id: color.id,
                    mode: measurementMode,
                    tint_percentage: 100,
                    illuminant: updateData.lab_illuminant || controls.illuminant || 'D50',
                    observer: updateData.lab_observer || controls.observer || '2',
                };
                
                // Only include lab if we have valid values
                if (hasValidLab) {
                    measurementData.lab = {
                        L: updateData.lab_l,
                        a: updateData.lab_a,
                        b: updateData.lab_b
                    };
                }
                
                // Only include spectral_data if we have valid data
                if (hasValidSpectral) {
                    measurementData.spectral_data = updateData.spectral_data;
                }
                
                console.info('ColorDetail: Saving measurement with valid data:', { 
                    mode: measurementMode, 
                    hasLab: hasValidLab, 
                    hasSpectral: hasValidSpectral 
                });
                
                const { error: measurementError } = await supabase
                    .from('color_measurements')
                    .upsert(measurementData, {
                        onConflict: 'color_id,mode,tint_percentage'
                    });
                
                if (measurementError) console.warn('Failed to update measurements:', measurementError);
            } else {
                console.info('ColorDetail: Skipping measurement save - no valid Lab or spectral data');
            }
            
            // Optimistically update the color in the global list
            if (updateColorOptimistically && color?.id) {
                updateColorOptimistically(color.id, allowedPayload);
            }
            
            // Local update for the detail view - combine all updates into single render
            const localPayload = { ...allowedPayload };
            if (updatedColor?.tags) {
                localPayload.tags = updatedColor.tags;
            }
            setColor(current => applyColorDeltaForUI(current, localPayload));
            
            // Trigger a refresh to update all dependent data silently
            await fetchColorDetails({ silent: true });
            
            // Handle print condition association updates
            if (updateData.adapt_to_print_condition && updateData.print_condition_id) {
                try {
                    const { error: rpcError } = await supabase.rpc('update_color_print_conditions', {
                        p_color_id: color.id,
                        p_print_condition_ids: [updateData.print_condition_id],
                        p_organization_id: color.organization_id,
                    });
                    
                    if (rpcError) {
                        console.warn('Failed to update print condition association:', rpcError);
                    } else {
                        // Update association to mark as adapted
                        const { error: updateError } = await supabase
                            .from('color_print_condition_associations')
                            .update({ 
                                is_adapted: true, 
                                adapted_at: new Date().toISOString() 
                            })
                            .eq('color_id', color.id)
                            .eq('print_condition_id', updateData.print_condition_id);
                        
                        if (updateError) {
                            console.warn('Failed to mark association as adapted:', updateError);
                        }
                    }
                } catch (error) {
                    console.warn('Error updating print condition association:', error);
                }
            }
            
        } catch (error) {
            console.error('Error updating color:', error);
            toast({
                title: 'Error updating color',
                description: error.message,
                variant: 'destructive'
            });
        } finally {
            setSaving(false);
        }
    };

    const handleCancel = async () => {
        if (isNew) {
            // Delete the unsaved color
            try {
                await supabase.from('colors').delete().eq('id', colorId);
                
                // Also delete copied ink condition if from ink
                if (isNewFromInk && fromInkConditionId) {
                    await supabase
                        .from('ink_conditions')
                        .delete()
                        .eq('id', fromInkConditionId)
                        .eq('creation_origin', 'from_ink')
                        .eq('is_hidden', true);
                }
            } catch (error) {
                console.warn('Failed to clean up unsaved color:', error);
            }
            
            // Navigate back to referrer or fallback
            let referrer = null;
            try {
                referrer = sessionStorage.getItem('newColorReferrer');
                sessionStorage.removeItem('newColorReferrer');
            } catch {}
            
            if (referrer) {
                startTransition(() => navigate(referrer));
            } else if (isNewFromInk && fromInkCondition?.ink_id) {
                // Navigate back to original ink condition
                setAppMode('assets');
                setNavGroupSelections(prev => ({
                    ...prev,
                    assets: `/assets/inks/${fromInkCondition.ink_id}/conditions/${fromInkConditionId}`
                }));
                startTransition(() => {
                    navigate(`/assets/inks/${fromInkCondition.ink_id}/conditions/${fromInkConditionId}`);
                });
            } else {
                // Fallback
                setAppMode('matching');
                startTransition(() => navigate('/colors'));
            }
        } else {
            // Standard cancel for existing colors
            setIsEditing(false);
        }
    };

    const handleSaveNew = async () => {
        try {
            setSaving(true);
            
            // Build adapted color data if we have accepted adaptation
            const adaptedColorData = fromInkTabState.hasAcceptedAdaptation && fromInkTabState.acceptedAdaptationData ? {
                lab_l: fromInkTabState.acceptedAdaptationData.lab?.L,
                lab_a: fromInkTabState.acceptedAdaptationData.lab?.a,
                lab_b: fromInkTabState.acceptedAdaptationData.lab?.b,
                color_hex: fromInkTabState.acceptedAdaptationData.hex,
                spectral_data: fromInkTabState.acceptedAdaptationData.spectralData
            } : null;
            
            // Always call saveChanges to persist the color name and other basic info
            if (!colorInfoRef.current) {
                console.error('❌ ColorInfoRef is null - cannot save');
                setSaving(false);
                return;
            }
            
            console.log('💾 Saving new color with data:', { adaptedColorData, hasRef: !!colorInfoRef.current });
            const result = await colorInfoRef.current.saveChanges(adaptedColorData);
            
            // Guard against null result
            if (!result) {
                console.error('❌ Save returned null - aborting');
                setSaving(false);
                return;
            }
            
            // Clear accepted adaptation after successful save
            if (fromInkTabState.hasAcceptedAdaptation) {
                setFromInkTabState(prev => ({
                    ...prev,
                    hasAcceptedAdaptation: false,
                    acceptedAdaptationData: null
                }));
            }
            
            // Optimistically add the newly saved color to the cache
            const newColorForCache = {
                id: color.id,
                name: result.name || color.name,
                hex: result.hex || color.hex,
                standard_type: result.standard_type || color.standard_type,
                status: result.status || color.status || 'Production',
                organization_id: color.organization_id,
                master_color_id: color.master_color_id,
                lab_l: result.lab_l ?? color.lab_l,
                lab_a: result.lab_a ?? color.lab_a,
                lab_b: result.lab_b ?? color.lab_b,
                created_at: color.created_at,
                updated_at: new Date().toISOString(),
                measurements: color.measurements || [],
                tags: result.tags || color.tags || [],
                book_ids: color.book_ids || [],
                from_ink_condition_id: color.from_ink_condition_id,
            };
            addColorsOptimistically([newColorForCache]);
            
            // Refresh the materialized view so the Brand Colors list picks up the new color immediately
            await supabase.rpc('refresh_colors_with_full_details');
            
            toast({ title: 'Color saved', description: 'New color has been added to your library.' });
            
            // Navigate to colors list
            setNavGroupSelections(prev => ({
                ...prev,
                matching: '/colors'
            }));
            
            startTransition(() => {
                navigate('/colors', { replace: true });
            });
        } catch (e) {
            toast({ title: 'Save failed', description: e.message, variant: 'destructive' });
        } finally {
            setSaving(false);
        }
    };

    const handleEditStart = () => {
        setIsEditing(true);
        // Set the baseline for detecting unsaved changes in the "From Ink" tab
        setFromInkTabState(prev => ({
            ...prev,
            editOriginalPrintConditionId: prev.selectedPrintConditionId
        }));
    };
    const handleEditCancel = () => {
        setIsEditing(false);
        // Clear the edit baseline
        setFromInkTabState(prev => ({
            ...prev,
            editOriginalPrintConditionId: null
        }));
    };
    
    // Toggle edit mode for pencil icon
    const handleEditToggle = () => {
        if (isEditing) {
            handleEditCancel();
        } else {
            handleEditStart();
        }
    };

    // Handle dynamic tab creation and switching with optional auto-switching
    const handleTabSwitch = useCallback((tabId, tabData = null, autoSwitch = true) => {
        // Special case: remove print condition tabs
        if (tabId === 'remove-print-condition-tabs') {
            console.log('ColorDetail.handleTabSwitch - removing print condition tabs');
            setDynamicTabs(prev => {
                const filtered = prev.filter(tab => tab.type !== 'new-print-condition');
                console.log('ColorDetail.handleTabSwitch - tabs count after removal:', { before: prev.length, after: filtered.length });
                return filtered;
            });
            // Switch back to info tab if we were on a removed tab
            if (activeTab.startsWith('new-print-condition')) {
                startTransition(() => {
                    setActiveTab('info');
                });
            }
            return;
        }
        
        if (tabData) {
            console.log('ColorDetail.handleTabSwitch - creating/updating tab', { tabId, tabData, autoSwitch });
            setDynamicTabs(prev => {
                // Remove any existing print condition tabs to avoid duplicates
                const withoutPrintConditions = prev.filter(tab => tab.type !== 'new-print-condition');
                // Check if specific tab already exists
                const exists = withoutPrintConditions.some(tab => tab.id === tabId);
                if (!exists) {
                    // Sanitize print_side data before creating tab
                    const sanitizedTabData = { 
                        ...tabData, 
                        label: tabData.label || 'Print Condition',
                        condition: tabData.condition ? {
                            ...tabData.condition,
                            printing_side: sanitizePrintSide(tabData.condition.printing_side || tabData.condition.print_side)
                        } : tabData.condition
                    };
                    const next = [...withoutPrintConditions, sanitizedTabData];
                    console.log('ColorDetail.handleTabSwitch - tabs count:', { before: prev.length, after: next.length });
                    try {
                        // User feedback when a tab is created
                        toast({ title: 'New tab added', description: sanitizedTabData.label });
                    } catch (e) {
                        console.warn('Toast failed in handleTabSwitch', e);
                    }
                    return next;
                }
                console.log('ColorDetail.handleTabSwitch - tab already exists, skipping add', { tabId });
                return prev;
            });
            // Only switch to the new tab if autoSwitch is true
            if (autoSwitch) {
                startTransition(() => {
                    setActiveTab(tabId);
                });
            }
        } else {
            // Just switching to existing tab
            startTransition(() => {
                setActiveTab(tabId);
            });
        }
    }, [activeTab, toast]);
    // Helper function to sanitize print_side data
    const sanitizePrintSide = (printSide) => {
        if (!printSide) return 'surface';
        if (typeof printSide === 'object' && printSide.value) {
            return printSide.value === 'undefined' ? 'surface' : printSide.value;
        }
        return printSide === 'undefined' ? 'surface' : printSide;
    };

    const handleEditSave = async () => {
        try {
            setSaving(true);
            
            // For ink-based colors, adaptation has already been saved via background save
            // Just need to update UI state and exit edit mode
            
            // Clear accepted adaptation state
            if (fromInkTabState.hasAcceptedAdaptation) {
                setFromInkTabState(prev => ({
                    ...prev,
                    hasAcceptedAdaptation: false,
                    acceptedAdaptationData: null
                }));
            }
            
            // Update activeDataMode to match preferredDataMode now that user confirmed
            setFromInkTabState(prev => ({
                ...prev,
                activeDataMode: prev.preferredDataMode || prev.activeDataMode
            }));
            
            if (colorInfoRef.current?.saveChanges) {
                await colorInfoRef.current.saveChanges();
            }
            setIsEditing(false);
            setHasUnsavedChanges(false);
            
            // Refresh color data to update measurements on Color Info tab
            await fetchColorDetails({ silent: true });
            
            toast({ title: 'Changes saved' });
            
            // Trigger refetch to ensure UI is in sync
            if (onColorUpdate) {
                onColorUpdate({ _refetch: true });
            }
        } catch (e) {
            toast({ title: 'Save failed', description: e.message, variant: 'destructive' });
        } finally {
            setSaving(false);
        }
    };
    // Gate rendering only while fetching base color data; allow UI to render while data mode resolves
    if (loading) {
        console.log('[ColorDetail] Blocking render: loading color data');
        return (
            <div className="p-6 space-y-4">
                <Skeleton className="h-8 w-1/4" />
                <Skeleton className="h-96 w-full" />
                <Skeleton className="h-64 w-full" />
            </div>
        );
    }

    if (!color) {
        return <div>Color not found.</div>;
    }

    return (
        <>
            <Helmet>
                <title>{`${color.name} - Color Details`}</title>
                <meta name="description" content={`Detailed information for color ${color.name}.`} />
            </Helmet>
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="p-2 sm:p-3 md:p-4 h-full flex flex-col min-h-0"
            >
                <div className="w-full h-full flex flex-col min-h-0">
                    <div className="flex items-center justify-between mb-2 sm:mb-3">
                        <div>
                            {(() => {
                                return (
                                    <Breadcrumb items={[
                                        { label: 'Colors', href: '/assets/colors' },
                                        { label: color.name }
                                    ]} />
                                );
                            })()}
                            <div className="mt-1">
                                <h1 className="text-2xl font-bold text-gray-900">
                                    {color.name}
                                </h1>
                            </div>
                        </div>
                        <div className="flex gap-2 items-center">
                            <ColorDetailHeader
                                isNew={isNew}
                                isEditing={isEditing}
                                showEditButton={!isNew && !isEditing}
                                onEdit={handleEditStart}
                                onCancel={isEditing ? handleEditCancel : handleCancel}
                                onSaveNew={handleSaveNew}
                                onSave={handleEditSave}
                                saving={saving}
                                requiredFieldsFilled={isNew ? canSaveNew : true}
                                onPrintColorCard={handlePrintColorCard}
                            />
                        </div>
                    </div>
                    
                
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col min-h-0">
                        <div className="flex items-center justify-between mb-1 relative">
                            <TabsList>
                                <TabsTrigger value="info">Color Info</TabsTrigger>
                                {hasFromInkCondition && (
                                    <TabsTrigger 
                                        value="from-ink" 
                                    className={fromInkHasMismatch ? "text-red-600 data-[state=active]:text-red-700 data-[state=active]:bg-red-100" : ""}
                                    >
                                        From Ink
                                    </TabsTrigger>
                                )}
                                <TabsTrigger value="similar">Similar Colors</TabsTrigger>
                                <TabsTrigger value="matches">Color Matches</TabsTrigger>
                                <TabsTrigger value="history">History</TabsTrigger>
                                {dynamicTabs.map(tab => (
                                    <TabsTrigger 
                                        key={tab.id} 
                                        value={tab.id}
                                        className={tab.isAlert ? 'bg-red-100 text-red-700 border-red-300 hover:bg-red-200 data-[state=active]:bg-red-200' : ''}
                                    >
                                        {tab.label}
                                    </TabsTrigger>
                                ))}
                            </TabsList>
                            <ColorSettingsBox 
                                controls={controls}
                                setControls={setControls}
                                standards={standards}
                                organizationDefaults={organization}
                                qualitySetDefaults={qualitySetDefaults}
                                availableModes={availableModes}
                                labConditions={color?.lab_l ? {
                                    illuminant: color.lab_illuminant || 'D50',
                                    observer: color.lab_observer || '2',
                                    table: color.lab_table || '5'
                                } : null}
                            />
                        </div>
<TabsContent value="info" className="mt-2 flex-1 min-h-0">
                          <div className="flex flex-col h-full space-y-4">
                              <div className="flex-1 min-h-0">
                                  <ColorInfoTab 
                                      ref={colorInfoRef}
                                      color={color} 
                                      onUpdate={handleColorUpdate}
                                      controls={controls}
                                      setControls={setControls}
                                      standards={standards}
                                      allowNameEdit={isNew || (isNew ? isEditing : isEditingColorInfo)}
                                      autoFocusName={isNew}
                                      isEditing={isNew ? isEditing : isEditingColorInfo}
                                      isNew={isNew}
                                      onEdit={isNew ? null : handleEditColorInfo}
                                      onSave={isNew ? null : handleSaveColorInfo}
                                      onCancel={isNew ? null : handleCancelColorInfo}
                                      fromInkConditionId={fromInkConditionId}
                                      activeDataMode={resolvedActiveDataMode}
                                      spectralDataSource={spectralDataSource}
                                      onRequiredFieldsChange={setCanSaveNew}
                                  />
                             </div>
                         </div>
                    </TabsContent>
{hasFromInkCondition && (
                        <TabsContent value="from-ink" className="mt-2 flex-1 min-h-0">
                            {fromInkCondition ? (
                                <InkBasedColorInfoTab
                                    color={color}
                                    fromInkCondition={fromInkCondition}
                                    measurementControls={controls}
                                    standards={standards}
                                    importedTints={color?.imported_tints ?? fromInkCondition?.imported_tints}
                                    onColorUpdate={handleColorUpdate}
                                    canEdit={!isNewFromInk}
                                    isEditing={isEditing}
                                    onEdit={handleEditToggle}
                                    onTabSwitch={handleTabSwitch}
                                    persistentState={{...fromInkTabState, activeDataMode: resolvedActiveDataMode}}
                                    onPersistentStateChange={setFromInkTabState}
                                    onMismatchStateChange={setFromInkHasMismatch}
                                    isPrintConditionComplete={isPrintConditionComplete}
                                    forcedPrintConditionId={forcedPrintConditionId}
                                />
                            ) : (
                                <div className="p-4 text-muted-foreground">Loading ink condition…</div>
                            )}
                        </TabsContent>
                    )}
{activeTab === 'similar' && (
                    <TabsContent value="similar" className="mt-2 flex-1 min-h-0">
                        <SimilarColorsTab 
                            color={color}
                            controls={controls}
                            setControls={setControls}
                            standards={standards}
                            activeTab={activeTab}
                            activeDataMode={fromInkTabState?.activeDataMode}
                        />
                    </TabsContent>
                    )}
{activeTab === 'matches' && (
                    <TabsContent value="matches" className="mt-2 flex-1 min-h-0">
                        <ColorMatchesTab 
                            color={color}
                            controls={controls}
                            setControls={setControls}
                            standards={standards}
                            activeDataMode={resolvedActiveDataMode}
                        />
                    </TabsContent>
                    )}
{activeTab === 'history' && (
                    <TabsContent value="history" className="mt-2 flex-1 min-h-0">
                        <HistoryTab assetType="Color" assetId={colorId} />
                    </TabsContent>
                    )}
{dynamicTabs.map(tab => (
                         activeTab === tab.id ? (
                          <TabsContent key={tab.id} value={tab.id} className="mt-2 flex-1 min-h-0">
                                  <div className="space-y-6">
                                       {/* Mismatch card disabled in this context; split wedge UI handles adaptation */}

                                        <PrintConditionInfo
                                            condition={tab.condition || {
                                                name: tab.prePopulatedData?.name || '',
                                                version: tab.prePopulatedData?.version || '',
                                                print_process: tab.prePopulatedData?.print_process || '',
                                                substrate_type_id: tab.prePopulatedData?.substrate_type_id || '',
                                                substrate_material_id: tab.prePopulatedData?.substrate_material_id || '',
                                                printing_side: tab.prePopulatedData?.printing_side ?? tab.prePopulatedData?.print_side ?? '',
                                                pack_type: tab.prePopulatedData?.pack_type || '',
                                                lab: tab.prePopulatedData?.lab,
                                                color_hex: tab.prePopulatedData?.color_hex,
                                                spectral_data: tab.prePopulatedData?.spectral_data,
                                                ch: tab.prePopulatedData?.ch,
                                                ...tab.prePopulatedData
                                            }}
                                            onNameChange={(e) => {
                                                setDynamicTabs(prevTabs => 
                                                    prevTabs.map(t => 
                                                        t.id === tab.id 
                                                            ? { 
                                                                ...t, 
                                                                condition: { 
                                                                    ...t.prePopulatedData,
                                                                    ...(t.condition || {}), 
                                                                    name: e.target.value 
                                                                } 
                                                            } 
                                                            : t
                                                    )
                                                );
                                                // Validate the tab after name change
                                                validatePrintConditionTab(tab.id, e.target.value);
                                            }}
                                            onConditionChange={(updatedCondition) => {
                                                setDynamicTabs(prevTabs => 
                                                    prevTabs.map(t => 
                                                        t.id === tab.id 
                                                            ? { 
                                                                ...t, 
                                                                condition: typeof updatedCondition === 'function' 
                                                                    ? updatedCondition({ ...t.prePopulatedData, ...t.condition })
                                                                    : { ...t.prePopulatedData, ...t.condition, ...updatedCondition }
                                                            }
                                                            : t
                                                    )
                                                );
                                            }}
                                            canEdit={true}
                                            isNew={true}
                                            setHasUnsavedChanges={() => {}}
                                            showEditHeader={true}
                                            isEditing={true} // Always in edit mode for new print conditions
                                            onSave={() => handlePrintConditionSave(tab.id)}
                                            onCancel={() => {
                                                // Remove the tab and go back to From-Ink
                                                setDynamicTabs(prevTabs => prevTabs.filter(t => t.id !== tab.id));
                                                startTransition(() => {
                                                    if (color?.from_ink_condition_id) {
                                                        setActiveTab('from-ink');
                                                    } else {
                                                        setActiveTab('info');
                                                    }
                                                });
                                            }}
                                            isSaving={saving}
                                        />


                                       {/* Dynamic visuals based on adaptation mode */}
                                       {(() => {
                                         const currentData = tab.showMismatch && tab.adaptationMode === 'adapt' 
                                           ? tab.adaptedData 
                                           : (tab.condition || tab.prePopulatedData);
                                         
                                         return (
                                           <div className="flex flex-col lg:flex-row gap-6 items-stretch">
                                             <div className="w-1/5 flex-shrink-0">
                                               <Card className="h-full flex flex-col">
                                                 <CardHeader><CardTitle className="text-lg">Appearance</CardTitle></CardHeader>
                                                 <CardContent className="flex-grow flex items-center justify-center p-4">
                                                   <div className="w-full aspect-square bg-black rounded-md p-2.5 flex justify-center items-center">
                                                     <div 
                                                       className="w-full h-full rounded-sm border border-gray-300"
                                                       style={{ backgroundColor: (() => {
                                                         try {
                                                           const illuminantName = controls?.illuminant || 'D50';
                                                           const observerName = controls?.observer || '2';
                                                           const tableNumber = String(controls?.table || '5');
                                                           const wt = (standards?.astmTables || []).filter(t => String(t.table_number)===tableNumber && t.observer===observerName && (t.illuminant_name===illuminantName || String(t.illuminant_name).toLowerCase()===String(illuminantName).toLowerCase()));
                                                           if (currentData?.spectral_data && wt.length) {
                                                             const lab = spectralToLabASTME308(currentData.spectral_data, wt);
                                                             return labToHexD65(lab.L, lab.a, lab.b, illuminantName);
                                                           }
                                                         } catch (e) {
                                                           console.warn('Appearance hex (spectral) failed', e);
                                                         }
                                                         return 'transparent';
                                                       })() }}
                                                     />
                                                   </div>
                                                 </CardContent>
                                               </Card>
                                             </div>

                                             <div className="flex-1">
                                               <Card className="h-full">
                                                 <CardHeader><CardTitle className="text-lg">Spectral Plot</CardTitle></CardHeader>
                                                  <CardContent className="p-4">
                                                     <SpectralPlot 
                                                       data={spectralDataSource?.data?.spectral_data || null}
                                                       measurementControls={controls}
                                                     />
                                                  </CardContent>
                                               </Card>
                                             </div>

                                              <div className="w-1/6 flex-shrink-0 max-w-[260px]">
                                                 <ColorInfoPanel 
                                                   lab={spectralDataSource?.data?.lab}
                                                   ch={spectralDataSource?.data?.ch || (spectralDataSource?.data?.lab ? labToChromaHue(spectralDataSource.data.lab.L, spectralDataSource.data.lab.a, spectralDataSource.data.lab.b) : null)}
                                                 />
                                              </div>
                                           </div>
                                         );
                                       })()}

                                      <PrintConditionConstructionPanel
                                        constructionDetails={tab.constructionDetails || {}}
                                        onConstructionDetailsChange={(details) => {
                                            setDynamicTabs(prevTabs => 
                                                prevTabs.map(t => 
                                                    t.id === tab.id 
                                                        ? { ...t, constructionDetails: details }
                                                        : t
                                                )
                                            );
                                        }}
                                         onConditionChange={(updatedCondition) => {
                                             setDynamicTabs(prevTabs => 
                                                 prevTabs.map(t => 
                                                     t.id === tab.id 
                                                         ? { 
                                                             ...t, 
                                                             condition: typeof updatedCondition === 'function' 
                                                                 ? updatedCondition({ ...t.prePopulatedData, ...t.condition })
                                                                 : { ...t.prePopulatedData, ...t.condition, ...updatedCondition }
                                                         }
                                                         : t
                                                 )
                                             );
                                         }}
                                        canEdit={true}
                                        setHasUnsavedChanges={() => {}}
                                        isNew={true}
                                        condition={tab.condition || tab.prePopulatedData}
                                         liveColorHex={(() => {
                                           try {
                                             const d = (tab.condition || tab.prePopulatedData) || {};
                                             const illuminantName = controls?.illuminant || 'D50';
                                             const observerName = controls?.observer || '2';
                                             const tableNumber = String(controls?.table || '5');
                                             const wt = (standards?.astmTables || []).filter(t => String(t.table_number)===tableNumber && t.observer===observerName && (t.illuminant_name===illuminantName || String(t.illuminant_name).toLowerCase()===String(illuminantName).toLowerCase()));
                                             if (d.spectral_data && wt.length) {
                                               const lab = spectralToLabASTME308(d.spectral_data, wt);
                                               return labToHexD65(lab.L, lab.a, lab.b, illuminantName);
                                             }
                                           } catch (e) {
                                             console.warn('liveColorHex spectral calc failed', e);
                                           }
                                           return null;
                                         })()}
                                      />
                                 </div>
                             ) : (
                                 <Card>
                                     <CardContent className="p-6">
                                         <div className="text-center text-muted-foreground">
                                             Configure {tab.label} (placeholder content)
                                         </div>
                                     </CardContent>
                                 </Card>
                             )}
                          </TabsContent>
                        ) : null))}
                      </Tabs>
                </div>
                
                {/* Weighting Function Tools - Only show for Superadmin when enabled */}
                {canAccessWeightingTools && weightingToolsEnabled && (
                    <WeightingFunctionImport />
                )}

                {/* Print Color Card Panel */}
                <PrintColorCardPanel
                    isOpen={isPrintPanelOpen}
                    onClose={() => {
                        setIsPrintPanelOpen(false);
                        setPrintColorData(null);
                    }}
                    colorData={printColorData}
                />
            </motion.div>
        </>
    );
};

export default ColorDetail;