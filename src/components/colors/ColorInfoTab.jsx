import React, { useState, useEffect, useMemo, useCallback, useRef, forwardRef, useImperativeHandle } from 'react';
import { Card, CardContent, CardHeader as UICardHeader, CardTitle } from '@/components/ui/card';
import { spectralToLabASTME308, labToHex, hexToLab, labToChromaHue, labChromaticAdaptation, labToHexD65, extractSpectralData } from '@/lib/colorUtils';
import { computeDynamicDisplayColor } from '@/lib/objectSpecificColorCalculation';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { MultiSelect } from '@/components/ui/multi-select';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { useProfile } from '@/context/ProfileContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useColors } from '@/context/ColorContext';
import { debug } from '@/lib/debugUtils';
import { getSolidSpectralData, logSpectralDiagnostics } from '@/lib/colorUtils/spectralDataHelpers';
import CardHeader from '@/components/admin/my-company/CardHeader';
import { Edit2, Check, X } from 'lucide-react';
import { sortMeasurementModes } from '@/lib/utils/measurementUtils';
import { normalizeTints } from '@/lib/tintsUtils';
import { useCanEdit } from '@/hooks/useCanEdit';
import { Badge } from '@/components/ui/badge';
import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { sdebug, isSimilarDebugEnabled } from '@/lib/similarDebug';
import WeightingFunctionImport from '@/components/colors/WeightingFunctionImport';
import { getMeasurementByMode } from '@/lib/utils/colorMeasurementSelection';
import { useWeightingTools } from '@/context/WeightingToolsContext';
import { useAstmTablesCache } from '@/hooks/useAstmTablesCache';
import { findSolidWedgeIndex } from '@/lib/wedgeUtils';
import { useAppContext } from '@/context/AppContext';
// Removed useSpectralCalculations hook to avoid dispatcher errors
// Removed useColorSpectralData - using color's own measurements directly


const InfoRow = ({ label, value, children, renderAsBadges, badgeValues }) => {
    if (renderAsBadges && badgeValues) {
        return (
            <div className="flex justify-between items-center py-3 border-b border-gray-200">
                <span className="text-sm text-gray-500">{label}</span>
                <div className="flex items-center gap-1 flex-wrap">
                    {badgeValues.map((badge, index) => (
                        <Badge key={index} variant={badge.variant || "secondary"} className={badge.className || "font-mono text-xs"}>
                            {badge.label}
                        </Badge>
                    ))}
                </div>
            </div>
        );
    }
    
    return (
        <div className="flex justify-between items-center py-3 border-b border-gray-200">
            <span className="text-sm text-gray-500">{label}</span>
            {children || <span className="text-sm font-medium text-gray-800 text-right">{value}</span>}
        </div>
    );
};

const ColorInfoTab = forwardRef(({ color, onUpdate, controls: externalControls, setControls: setExternalControls, standards: externalStandards, allowNameEdit = false, autoFocusName = false, isEditing = false, isNew = false, onEdit, onSave, onCancel, fromInkConditionId, activeDataMode, spectralDataSource, onRequiredFieldsChange }, ref) => {
    const { profile } = useProfile();
    const { updateColorTagsOptimistically } = useAppContext();
    const canEdit = useCanEdit();
    const isOwnColor = useMemo(() => {
        const orgId = profile?.organization_id;
        const colorOrg = color?.organization_id;
        return Boolean(orgId && colorOrg && orgId === colorOrg);
    }, [profile?.organization_id, color?.organization_id]);
    const canEditThisColor = useMemo(() => Boolean(canEdit && isOwnColor), [canEdit, isOwnColor]);
    const [allTags, setAllTags] = useState([]);
    // Derive selected tag IDs from color.tags prop (single source of truth)
    const selectedTagIds = useMemo(() => {
        return (color.tags || []).map(t => t.id);
    }, [color.tags]);
    
    // Local UI state for instant tag selection feedback
    const [uiSelectedTagIds, setUiSelectedTagIds] = useState([]);
    const { isEnabled: weightingToolsEnabled, canAccess: canAccessWeightingTools } = useWeightingTools();
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [originalValues, setOriginalValues] = useState({});
    const [isSavingTags, setIsSavingTags] = useState(false);
    
    // Removed loading state - tags now come from color.tags prop
    const [standardType, setStandardType] = useState(color.standard_type || 'master');
    const [status, setStatus] = useState(color.status || 'Production');
    
    // State for enriched color data (with measurements)
    const [enrichedColor, setEnrichedColor] = useState(null);
    
    // Track when we're actively saving to prevent state resets
    const savingRef = useRef(false);
    
    // State for user names
    const [userNames, setUserNames] = useState({
        createdByName: null,
        lastEditedByName: null,
    });
    
    // Compute available modes inline to avoid accessing before initialization
    const measurements = (enrichedColor || color)?.measurements;
    
    console.log('🔍 ColorInfoTab - Measurements check:', {
        colorId: color?.id,
        isInkBased: !!color?.from_ink_condition_id,
        hasMeasurements: !!measurements,
        measurementCount: measurements?.length || 0,
        measurementModes: measurements?.map(m => m.mode) || [],
        firstMeasurement: measurements?.[0] ? {
            mode: measurements[0].mode,
            hasSpectral: !!measurements[0].spectral_data,
            spectralKeys: measurements[0].spectral_data ? Object.keys(measurements[0].spectral_data).length : 0
        } : null
    });
    
    const availableModes = useMemo(() => sortMeasurementModes(measurements?.map(m => m.mode) || []), [measurements]);

    // Use external controls if provided, otherwise use local state with validation
    const [localMeasurementControls, setLocalMeasurementControls] = useState(() => {
        // Default to simplest fallback when standalone - compute inline to avoid dependency on availableModes
        const modes = sortMeasurementModes(measurements?.map(m => m.mode) || []);
        const fallbackMode = modes.includes('M0') ? 'M0' : (modes[0] || 'M1');
        return {
            mode: fallbackMode,
            illuminant: 'D50',
            observer: '2',
            table: '5',
        };
    });

    // Color Info tab doesn't use activeDataMode - always reads from color's own measurements

// Moved useColorSpectralData call below measurementControls to avoid TDZ when accessing measurementControls.mode


    // Validate and use external controls if provided, otherwise use local state
    const measurementControls = useMemo(() => {
        const controls = externalControls || localMeasurementControls;
        
        // Safety validation: ensure the mode exists in available modes
        if (availableModes.length > 0 && !availableModes.includes(controls.mode)) {
            const fallbackMode = availableModes.includes('M0') ? 'M0' : availableModes[0];
            console.info(`ColorInfoTab: Mode "${controls.mode}" not available in [${availableModes.join(', ')}], falling back to "${fallbackMode}"`);
            return { ...controls, mode: fallbackMode };
        }
        
        console.info(`ColorInfoTab: Using mode "${controls.mode}" from available [${availableModes.join(', ')}]`);
        
        return controls;
    }, [externalControls, localMeasurementControls, availableModes]);
    
const setMeasurementControls = setExternalControls || setLocalMeasurementControls;

// Direct spectral data from color's measurements - mode-based selection (no tint logic)
const bestMeasurement = useMemo(
    () => getMeasurementByMode(measurements || [], measurementControls.mode),
    [measurements, measurementControls.mode]
);

const isInkBased = !!(enrichedColor || color)?.from_ink_condition_id;

    // Notify parent when mode validation causes a change
    useEffect(() => {
        if (externalControls && setExternalControls && 
            availableModes.length > 0 && 
            !availableModes.includes(externalControls.mode)) {
            const fallbackMode = availableModes.includes('M0') ? 'M0' : availableModes[0];
            setExternalControls(prev => ({ ...prev, mode: fallbackMode }));
        }
    }, [externalControls, setExternalControls, availableModes]);

    const [displayedColor, setDisplayedColor] = useState(() => ({
        hex: null,
        lab: null,
        spectralData: null
    }));
    const [animationProgress, setAnimationProgress] = useState(0);
    const [isAnimating, setIsAnimating] = useState(false);
    const [maxReflectance, setMaxReflectance] = useState(1);
    const animationRef = useRef(null);
    const baseSpectralData = useRef(null);
    const previousSpectralData = useRef(null);
    const lastHexRef = useRef(null);
    useEffect(() => {
        if (displayedColor?.hex) lastHexRef.current = displayedColor.hex;
    }, [displayedColor?.hex]);
    // Clear stale swatch/hex when color changes (not on mode/tab changes)
    useEffect(() => {
        lastHexRef.current = null;
        setDisplayedColor({ hex: null, lab: null, spectralData: null });
    }, [color?.id]);
    // Use cached ASTM tables for instant loading
    const { astmTables: cachedAstmTables, loading: astmLoading } = useAstmTablesCache();
    
    // Use external standards if provided, otherwise use local state
    const [localStandards, setLocalStandards] = useState({
        illuminants: [],
        observers: [],
        astmTables: [],
        loading: true,
    });

    // Merge cached ASTM tables with local standards
    const standards = useMemo(() => {
        if (externalStandards) return externalStandards;
        
        return {
            ...localStandards,
            astmTables: cachedAstmTables || localStandards.astmTables,
            loading: astmLoading || (localStandards.loading && !cachedAstmTables?.length),
        };
    }, [externalStandards, localStandards, cachedAstmTables, astmLoading]);

    useEffect(() => {
        if (externalStandards) return; // Skip if external standards are provided
        
        const fetchStandards = async () => {
            try {
                const [illuminantsRes, observersRes] = await Promise.all([
                    supabase.from('illuminants').select('*'),
                    supabase.from('observers').select('*'),
                ]);

                if (illuminantsRes.error) throw illuminantsRes.error;
                if (observersRes.error) throw observersRes.error;

                setLocalStandards({
                    illuminants: illuminantsRes.data,
                    observers: observersRes.data,
                    astmTables: cachedAstmTables || [],
                    loading: false,
                });
            } catch (error) {
                toast({ title: 'Error fetching measurement standards', description: error.message, variant: 'destructive' });
                setLocalStandards(s => ({ ...s, loading: false }));
            }
        };
        fetchStandards();
    }, [externalStandards, cachedAstmTables, toast]);

    // Use color data from parent (already includes measurements, ink_condition, etc.)
    useEffect(() => {
        if (!color) {
            setEnrichedColor(null);
            return;
        }
        
        // Parent now provides comprehensive data - use directly
        setEnrichedColor(color);
    }, [color]);
    
    // Use spectral data directly from the best measurement
    const spectralData = useMemo(() => {
        console.log('🎨 ColorInfoTab - Spectral data extraction:', {
            colorId: color?.id,
            isInkBased,
            measurementMode: measurementControls.mode,
            bestMeasurementMode: bestMeasurement?.mode,
            hasSpectralData: !!bestMeasurement?.spectral_data,
            spectralDataKeys: bestMeasurement?.spectral_data ? Object.keys(bestMeasurement.spectral_data).length : 0,
            bestMeasurementFull: bestMeasurement ? {
                mode: bestMeasurement.mode,
                hasLab: !!bestMeasurement.lab,
                tintPercentage: bestMeasurement.tint_percentage
            } : null
        });
        
        return bestMeasurement?.spectral_data || null;
    }, [bestMeasurement, color?.id, isInkBased, measurementControls.mode]);

    // Calculate Lab values for display using ASTM E308 with current measurement controls
    const calculations = useMemo(() => {
        if (!spectralData || standards.loading || !standards.astmTables?.length) {
            return { lab: null, ch: null };
        }
        
        const { illuminant = 'D50', observer = '2', table = '5' } = measurementControls || {};
        
        try {
            const weightingTable = standards.astmTables.filter(t =>
                t.illuminant_name === illuminant &&
                t.observer === observer &&
                String(t.table_number) === String(table)
            );
            
            if (weightingTable.length > 0) {
                const lab = spectralToLabASTME308(spectralData, weightingTable);
                if (lab && Number.isFinite(lab.L) && Number.isFinite(lab.a) && Number.isFinite(lab.b)) {
                    const ch = labToChromaHue(lab.L, lab.a, lab.b);
                    return { lab, ch };
                }
            }
        } catch (error) {
            console.warn('Error calculating Lab from spectral:', error);
        }
        
        return { lab: null, ch: null };
    }, [spectralData, standards.astmTables, standards.loading, measurementControls]);

    // Calculate color using dynamic measurement controls for appearance box
    // This uses computeDynamicDisplayColor which respects user-selected controls
    const displayHex = useMemo(() => {
        if (!enrichedColor && !color) return null;
        if (standards.loading || !standards.astmTables?.length) return null;
        
        const workingColor = enrichedColor || color;
        const orgDefaults = profile?.organization || {};
        
        console.log('ColorInfoTab - Computing dynamic display color:', {
            colorId: workingColor?.id,
            isInkBased,
            measurementControls,
            hasSpectralData: !!spectralData
        });
        
        try {
            const hex = computeDynamicDisplayColor(
                workingColor,
                orgDefaults,
                standards.astmTables,
                measurementControls,
                undefined // No activeDataMode - using color's own measurements
            );
            
            console.log('ColorInfoTab - Computed display hex:', hex);
            return hex;
        } catch (error) {
            console.error('Error computing dynamic display color:', error);
            return workingColor.hex || workingColor.color_hex || null;
        }
    }, [enrichedColor, color, profile?.organization, standards.astmTables, standards.loading, measurementControls, isInkBased, spectralData]);

    // Update displayed color when displayHex changes
  useEffect(() => {
    if (displayHex) {
      console.log('ColorInfoTab - Updating displayed color:', displayHex);
      
      // Handle both string and object returns from computeDynamicDisplayColor
      const hexValue = typeof displayHex === 'string' ? displayHex : displayHex.hex;
      const labValue = typeof displayHex === 'object' && displayHex.lab 
        ? displayHex.lab 
        : calculations.lab;
      
      setDisplayedColor({
        hex: hexValue,
        lab: labValue,
        spectralData: spectralData
      });
      lastHexRef.current = hexValue;
    }
  }, [displayHex, calculations.lab, spectralData]);


    // Spectral data comes from measurements array loaded with the color
    // No need to fetch ink condition separately - measurements are already available

    // Initial color computation on standards ready
    const [initialColorComputed, setInitialColorComputed] = useState(false);
    
    useEffect(() => {
        if (initialColorComputed) return;
        
        // For ink-based colors, use spectral calculations from measurements
        if (color.from_ink_condition_id) {
            // Only compute if we have spectral calculations
            if (calculations.lab && 
                Number.isFinite(calculations.lab.L) && Number.isFinite(calculations.lab.a) && Number.isFinite(calculations.lab.b)) {
                const computedHex = labToHexD65(calculations.lab.L, calculations.lab.a, calculations.lab.b, measurementControls?.illuminant || 'D50');
                console.log('ColorInfoTab - Initial ink-based color computation from spectral:', {
                    lab: calculations.lab,
                    hex: computedHex
                });
                setDisplayedColor({
                    hex: computedHex,
                    lab: calculations.lab,
                    spectralData: spectralData
                });
                setInitialColorComputed(true);
            }
            return;
        }
        
        // Regular colors - simplify using displayHex
        if (displayHex) {
            setDisplayedColor({
                hex: displayHex,
                lab: calculations.lab,
                spectralData: null
            });
        }
        setInitialColorComputed(true);
    }, [color.from_ink_condition_id, initialColorComputed, calculations.lab, spectralData, measurementControls?.illuminant, displayHex]);

    // Simplified main effect using centralized spectral data and calculations
    useEffect(() => {
        if (standards.loading || hasUnsavedChanges) return;

        // Removed getColorLabValues - now using displayHex directly
        
        // Log diagnostics for color information display
        console.log('ColorInfoTab - Color Information Display:', {
            colorId: color?.id,
            isInkBased,
            hasSpectralData: !!spectralData,
            hasLabValues: !!labValues,
            labSource: labValues?.source || 'none',
            labValues: labValues ? { L: labValues.L?.toFixed(2), a: labValues.a?.toFixed(2), b: labValues.b?.toFixed(2) } : null
        });
        
        // If we have calculated Lab values, use them
        if (labValues && Number.isFinite(labValues.L) && Number.isFinite(labValues.a) && Number.isFinite(labValues.b)) {
            try {
                const hex = labToHexD65(labValues.L, labValues.a, labValues.b, measurementControls?.illuminant || 'D50');
                
                console.log('ColorInfoTab - Rendering color swatch from Lab:', {
                    hex,
                    lab: labValues,
                    source: labValues?.source || 'computed'
                });
                
                // Handle animation if spectral data changed
                const needsAnimation = previousSpectralData.current && spectralData && 
                    JSON.stringify(previousSpectralData.current) !== JSON.stringify(spectralData);
                
                setDisplayedColor({
                    hex: hex,
                    lab: labValues,
                    spectralData: spectralData
                });
                
                if (spectralData) {
                    const reflectanceValues = Object.values(spectralData).map(v => typeof v === 'number' ? v : parseFloat(v) || 0);
                    const maxR = Math.max(...reflectanceValues);
                    
                    // Convert spectral data object to array format for animation
                    const spectralArray = Object.entries(spectralData)
                        .map(([wavelength, reflectance]) => ({
                            wavelength: parseInt(wavelength),
                            actualReflectance: typeof reflectance === 'number' ? reflectance : parseFloat(reflectance) || 0
                        }))
                        .sort((a, b) => a.wavelength - b.wavelength);
                    
                    if (needsAnimation) {
                        setIsAnimating(true);
                        setAnimationProgress(0);
                    } else {
                        setIsAnimating(false);
                    }
                    setMaxReflectance(maxR);
                    
                    baseSpectralData.current = spectralArray;
                    previousSpectralData.current = spectralArray;
                } else {
                    setMaxReflectance(1);
                    setIsAnimating(false);
                }
            } catch (error) {
                console.error('Error converting Lab to hex:', error);
            }
            return;
        }

        // For non-ink-based colors, fallback to stored Lab values
        const workingColor = enrichedColor || color;
        
        if (!isInkBased && Number.isFinite(workingColor.lab_l) && Number.isFinite(workingColor.lab_a) && Number.isFinite(workingColor.lab_b)) {
            try {
                const hex = labToHexD65(workingColor.lab_l, workingColor.lab_a, workingColor.lab_b, measurementControls?.illuminant || 'D50');
                console.log('ColorInfoTab - Using stored Lab for regular color');
                setDisplayedColor({
                    hex: hex,
                    lab: { L: workingColor.lab_l, a: workingColor.lab_a, b: workingColor.lab_b },
                    spectralData: null
                });
                
                previousSpectralData.current = null;
                baseSpectralData.current = null;
                setMaxReflectance(1);
                setIsAnimating(false);
            } catch (error) {
                console.error('Error converting stored Lab to hex:', error);
            }
            return;
        }
        
        // Log when no data is available to display
        if (isInkBased) {
            console.log('ColorInfoTab - No spectral/Lab data available for ink-based color, preserving last known hex');
        } else {
            console.log('ColorInfoTab - No data available for color display, using fallback');
        }

        // Preserve last known hex or use fallback - don't clear to null
        const fallbackHex = lastHexRef.current || color.hex || color.color_hex || null;
        if (fallbackHex) {
            console.log('ColorInfoTab - Using fallback hex:', fallbackHex);
            setDisplayedColor(prev => ({ ...prev, hex: fallbackHex }));
        }
    }, [calculations.lab, spectralData, measurementControls?.illuminant, measurementControls?.observer, measurementControls?.table, measurementControls?.mode, standards.loading, hasUnsavedChanges, enrichedColor, color, isInkBased]);

    // Diagnostic effect removed - spectral data comes from measurements loaded with color

    // Animation effect for upward curve growth
    useEffect(() => {
        if (!isAnimating) {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
                animationRef.current = null;
            }
            return;
        }
        
        console.log('Starting animation loop');
        const duration = 600; // 0.6 seconds (doubled speed)
        const startTime = Date.now();
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Simple linear progression for testing
            setAnimationProgress(progress);
            
            if (progress < 1) {
                animationRef.current = requestAnimationFrame(animate);
            } else {
                console.log('Animation complete');
                setIsAnimating(false);
                animationRef.current = null;
            }
        };
        
        animationRef.current = requestAnimationFrame(animate);
        
        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
                animationRef.current = null;
            }
        };
    }, [isAnimating]);


    // Fetch all available tags for the dropdown (but use color.tags for selected state)
    const fetchAllTags = useCallback(async () => {
        if (!profile?.organization_id) return;
        
        try {
            const { data: tagsData, error: tagsError } = await supabase
                .from('tags')
                .select('id, name, category_id, categories(name)')
                .eq('organization_id', profile.organization_id);
            
            if (tagsError) throw tagsError;
            setAllTags(tagsData || []);
        } catch (error) {
            console.error('Error fetching tags:', error);
            toast({
                title: 'Error fetching tags',
                description: error.message,
                variant: 'destructive',
            });
        }
    }, [profile?.organization_id, toast]);

    // Initialize standard type and measurement controls
    useEffect(() => {
        setStandardType(color.standard_type);
        if (!externalControls) {
            const fallbackMode = availableModes.includes('M0') ? 'M0' : (availableModes[0] || 'M1');
            setMeasurementControls(prev => ({ ...prev, mode: fallbackMode }));
        }
    }, [color.standard_type, availableModes, externalControls, setMeasurementControls]);

    // Fetch all available tags when component mounts
    useEffect(() => {
        fetchAllTags();
    }, [fetchAllTags]);


    // Fetch user names for created_by and last_edited_by using RLS-safe joins
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                // Use color properties if already available (from join queries)
                if (color?.created_by_name || color?.last_edited_by_name) {
                    console.log('Using existing user names from color object:', {
                        created_by_name: color.created_by_name,
                        last_edited_by_name: color.last_edited_by_name
                    });
                    
                    if (!cancelled) {
                        setUserNames({
                            createdByName: color.created_by_name,
                            lastEditedByName: color.last_edited_by_name,
                        });
                    }
                    return;
                }

                // Fallback to RLS-safe join query on colors table
                
                
                const { data: colorData, error } = await supabase
                    .from('colors')
                    .select(`
                        created_by,
                        last_edited_by,
                        created_by_profile:profiles!colors_created_by_fkey(full_name),
                        last_edited_by_profile:profiles!colors_last_edited_by_fkey(full_name)
                    `)
                    .eq('id', color.id)
                    .maybeSingle();
                
                if (error) {
                    console.error('Error fetching user names via join:', error);
                    throw error;
                }

                let createdByName = null;
                let lastEditedByName = null;

                if (colorData) {
                    createdByName = colorData.created_by_profile?.full_name || null;
                    lastEditedByName = colorData.last_edited_by_profile?.full_name || null;
                    
                    
                }

                if (!cancelled) {
                    setUserNames({
                        createdByName,
                        lastEditedByName,
                    });
                }
            } catch (e) {
                console.error('Error fetching user names:', e);
                if (!cancelled) {
                    setUserNames({
                        createdByName: null,
                        lastEditedByName: null,
                    });
                }
            }
        })();
        return () => { cancelled = true; };
    }, [color?.id, color?.created_by, color?.last_edited_by, color?.created_by_name, color?.last_edited_by_name]);

    const [nameValue, setNameValue] = useState((fromInkConditionId || color?.from_ink_condition_id) ? '' : (color.name || ''));

    // Notify parent when required fields change (for Save button enablement)
    useEffect(() => {
        if (typeof onRequiredFieldsChange !== 'function') return;
        const isInkFlow = !!(fromInkConditionId || color?.from_ink_condition_id);
        const hasValidName = !!(nameValue && nameValue.trim());
        const requiredFieldsFilled = !isInkFlow || hasValidName;
        onRequiredFieldsChange(requiredFieldsFilled);
    }, [onRequiredFieldsChange, nameValue, fromInkConditionId, color?.from_ink_condition_id]);

    useEffect(() => {
        setStatus(color.status || 'Production');
    }, [color?.status]);

    const handleStandardTypeChange = (newType) => {
        setStandardType(newType);
        // Clear print conditions when switching to master
        if (newType === 'master') {
            setSelectedPrintConditionIds([]);
        }
    };

    const handleTagChange = async (newTagIds) => {
        const prev = uiSelectedTagIds;
        setUiSelectedTagIds(newTagIds); // Immediate UI response
        
        // Validate hierarchy conflicts for newly added tags
        const tagsBeingAdded = newTagIds.filter(id => !selectedTagIds.includes(id));
        if (tagsBeingAdded.length > 0) {
            try {
                const { data: conflictCheck, error: conflictError } = await supabase.rpc('check_tag_hierarchy_conflicts', {
                    p_color_id: color.id,
                    p_new_tag_ids: tagsBeingAdded,
                    p_organization_id: color.organization_id,
                });
                if (conflictError) throw conflictError;
                if (conflictCheck.has_conflicts) {
                    const conflict = conflictCheck.conflicts[0];
                    const errorMessage = conflict.existing_tag_name === conflict.new_tag_name
                        ? `Tag "${conflict.new_tag_name}" is already assigned to this color.`
                        : `Cannot add "${conflict.new_tag_name}" because this color already has "${conflict.existing_tag_name}" which conflicts in the tag hierarchy.`;
                    toast({ title: 'Tag Hierarchy Conflict', description: errorMessage, variant: 'destructive' });
                    setUiSelectedTagIds(prev); // Revert UI on conflict
                    return;
                }
            } catch (error) {
                toast({ title: 'Error checking tag conflicts', description: error.message, variant: 'destructive' });
                setUiSelectedTagIds(prev); // Revert UI on error
                return;
            }
        }
        
        // Optimistically update the cache immediately
        const updatedTags = allTags
            .filter(t => newTagIds.includes(t.id))
            .map(t => ({ id: t.id, name: t.name, category_name: t.categories?.name }));
        
        if (updateColorTagsOptimistically) {
            updateColorTagsOptimistically([color.id], updatedTags);
        }
        
        setHasUnsavedChanges(true);
    };
    const tagOptions = useMemo(() => {
        return allTags.map(tag => ({
            value: tag.id,
            label: tag.categories?.name ? `${tag.categories.name} / ${tag.name}` : tag.name,
        }));
    }, [allTags]);

    // Print Conditions (for dependent colors)
    const [printConditionOptions, setPrintConditionOptions] = useState([]);
    const [selectedPrintConditionIds, setSelectedPrintConditionIds] = useState([]);

    const fetchPrintConditions = useCallback(async () => {
        if (!profile?.organization_id || !color?.id) return;
        try {
            const [{ data: pcs, error: pcErr }, { data: assoc, error: assocErr }] = await Promise.all([
                supabase.from('print_conditions').select('id, name').eq('organization_id', profile.organization_id).order('name'),
                supabase.from('color_print_condition_associations').select('print_condition_id').eq('color_id', color.id)
            ]);
            if (pcErr) throw pcErr;
            if (assocErr) throw assocErr;
            setPrintConditionOptions((pcs || []).map(pc => ({ value: pc.id, label: pc.name })));
            setSelectedPrintConditionIds((assoc || []).map(a => a.print_condition_id));
        } catch (e) {
            toast({ title: 'Failed to load print conditions', description: e.message, variant: 'destructive' });
        }
    }, [profile?.organization_id, color?.id, toast]);

    useEffect(() => {
        fetchPrintConditions();
    }, [fetchPrintConditions]);

    // Sync uiSelectedTagIds with selectedTagIds when color.tags changes
    useEffect(() => {
        if (hasUnsavedChanges || isSavingTags) return;
        setUiSelectedTagIds(selectedTagIds);
    }, [selectedTagIds, hasUnsavedChanges, isSavingTags]);
    
    useEffect(() => {
        // Skip reset during/after save operation to prevent name from disappearing
        if (savingRef.current) return;
        
        if (isEditing) return;
        if (hasUnsavedChanges || isSavingTags) return;
        setNameValue(color.name || '');
        setStandardType(color.standard_type);
        setStatus(color.status || 'Production');
        setUiSelectedTagIds(selectedTagIds); // Re-sync UI tags
        // Re-sync print conditions from DB
        fetchPrintConditions();
    }, [isEditing, color.name, color.status, color.standard_type, selectedTagIds, fetchPrintConditions, hasUnsavedChanges, isSavingTags]);

    // Reset savingRef after color prop has been updated and edit mode has exited
    useEffect(() => {
        if (!isEditing && savingRef.current) {
            // Give React time to finish rendering with the updated color prop
            const timer = setTimeout(() => {
                savingRef.current = false;
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [isEditing, color.name]);

    // Expose saveChanges to parent (applies edits in edit mode)
    useImperativeHandle(ref, () => ({
            saveChanges: async (adaptedColorData = null) => {
                savingRef.current = true; // Mark save in progress
                setIsSavingTags(true);
                try {
                    const updates = {};
                    const newName = (nameValue || '').trim();
                    
                    // Validate name is required for colors created from ink conditions
                    if ((fromInkConditionId || color?.from_ink_condition_id) && !newName) {
                        toast({ title: 'Name Required', description: 'Please enter a name for this color.', variant: 'destructive' });
                        return;
                    }
                    
                    if (newName && newName !== color.name) updates.name = newName;
                    if ((standardType || null) !== (color.standard_type || null)) updates.standard_type = standardType;
                    if ((status || null) !== (color.status || null)) updates.status = status;
                    
                    // Add adapted color data if provided (map color_hex -> hex and DO NOT include spectral on colors table)
                    if (adaptedColorData) {
                        if (adaptedColorData.lab_l !== undefined) updates.lab_l = adaptedColorData.lab_l;
                        if (adaptedColorData.lab_a !== undefined) updates.lab_a = adaptedColorData.lab_a;
                        if (adaptedColorData.lab_b !== undefined) updates.lab_b = adaptedColorData.lab_b;
                        if (adaptedColorData.color_hex !== undefined) updates.hex = adaptedColorData.color_hex;
                        console.log('💾 ColorInfoTab: Applying adapted color data to updates:', adaptedColorData);
                    }
    
                    // Clear print conditions if standard type is master
                    const finalPrintConditionIds = (standardType === 'dependent') 
                        ? selectedPrintConditionIds 
                        : [];
    
                    const promises = [];
                    if (Object.keys(updates).length > 0) {
                        promises.push(
                            supabase.from('colors').update({ ...updates, last_edited_by: profile?.id }).eq('id', color.id)
                        );
                    }
    
                    // Upsert a 100% measurement when adapted data provided (or Lab provided)
                    if (adaptedColorData && (adaptedColorData.spectral_data || (updates.lab_l !== undefined && updates.lab_a !== undefined && updates.lab_b !== undefined))) {
                        const validModes = ['M0', 'M1', 'M2', 'M3'];
                        const measurementMode = validModes.includes(measurementControls?.mode) ? measurementControls.mode : 'M1';
                        const measurementData = {
                            color_id: color.id,
                            mode: measurementMode,
                            tint_percentage: 100,
                            illuminant: measurementControls?.illuminant || 'D50',
                            observer: measurementControls?.observer || '2',
                        };
                        if (adaptedColorData.spectral_data) {
                            measurementData.spectral_data = adaptedColorData.spectral_data;
                        }
                        if (updates.lab_l !== undefined && updates.lab_a !== undefined && updates.lab_b !== undefined) {
                            measurementData.lab = { L: updates.lab_l, a: updates.lab_a, b: updates.lab_b };
                        }
                        promises.push(
                            supabase.from('color_measurements').upsert(measurementData, { onConflict: 'color_id,mode,tint_percentage' })
                        );
                    }
    
                    // Tags - Apply optimistic update first using uiSelectedTagIds
                    const updatedTags = allTags
                        .filter(t => uiSelectedTagIds.includes(t.id))
                        .map(t => ({ id: t.id, name: t.name, category_name: t.categories?.name }));
                    
                    // Optimistic update for tags in the color list
                    if (updateColorTagsOptimistically) {
                        updateColorTagsOptimistically([color.id], updatedTags);
                    }
                    
                    promises.push(
                        supabase.rpc('update_color_tags_transaction', {
                            p_color_ids: [color.id],
                            p_tag_ids_to_set: uiSelectedTagIds,
                            p_organization_id: color.organization_id,
                            p_user_id: profile?.id
                        })
                    );
                    // Print Conditions associations
                    promises.push(
                        supabase.rpc('update_color_print_conditions', {
                            p_color_id: color.id,
                            p_print_condition_ids: finalPrintConditionIds,
                            p_organization_id: color.organization_id
                        })
                    );
    
                    const results = await Promise.all(promises);
                    for (const r of results) {
                        if (r && r.error) throw r.error;
                    }
    
                    // No need to refetch - optimistic update already handled UI
                    // Tags will sync on next natural refetch
                    
                    // Update original values to reflect the successful save
                    // This prevents the values from reverting if component re-renders
                    setOriginalValues({
                        name: nameValue,
                        status,
                        standardType,
                        selectedTagIds: [...uiSelectedTagIds],
                        selectedPrintConditionIds: [...selectedPrintConditionIds]
                    });
                    
                    // Clear unsaved changes flag since we just saved
                    setHasUnsavedChanges(false);
    
                    const updated = {
                        ...(updates.name ? { name: updates.name } : {}),
                        ...(updates.standard_type ? { standard_type: updates.standard_type } : {}),
                        ...(updates.status ? { status: updates.status } : {}),
                        ...(updates.hex ? { hex: updates.hex } : {}),
                        ...(updates.lab_l !== undefined ? { lab_l: updates.lab_l } : {}),
                        ...(updates.lab_a !== undefined ? { lab_a: updates.lab_a } : {}),
                        ...(updates.lab_b !== undefined ? { lab_b: updates.lab_b } : {}),
                        tags: updatedTags,
                    };
                    onUpdate?.(updated);
                    return updated;
                } finally {
                    setIsSavingTags(false);
                    savingRef.current = false; // Clear save flag
                }
            }
    }));

    // Spectral data for plot from color's own measurements
    const spectralDataForPlot = useMemo(() => {
        if (!spectralData) return [];
        
        return Object.entries(spectralData)
            .map(([wavelength, reflectance]) => ({
                wavelength: parseInt(wavelength),
                reflectance: reflectance
            }))
            .filter(point => !isNaN(point.wavelength) && !isNaN(point.reflectance))
            .sort((a, b) => a.wavelength - b.wavelength);
    }, [spectralData]);

// Get Lab values from calculations for display, with fallback to stored Lab values
const labValues = calculations.lab || (() => {
    // Fallback: if no spectral-calculated Lab, use stored Lab values from color record
    const storedL = color?.lab_l;
    const storedA = color?.lab_a;
    const storedB = color?.lab_b;
    
    if (storedL !== undefined && storedL !== null && 
        storedA !== undefined && storedA !== null && 
        storedB !== undefined && storedB !== null) {
        const L = Number(storedL);
        const a = Number(storedA);
        const b = Number(storedB);
        
        if ([L, a, b].every(n => Number.isFinite(n))) {
            console.log('ColorInfoTab - Using stored Lab values:', { L, a, b });
            return { L, a, b, source: 'stored' };
        }
    }
    return null;
})();
debug.log('ColorInfoTab labValues raw:', labValues);

const normalizedLab = labValues
    ? (() => {
        const L = Number(labValues.L ?? labValues.l);
        const a = Number(labValues.a);
        const b = Number(labValues.b);
        if ([L, a, b].some(n => Number.isNaN(n))) return null;
        return { L, a, b };
      })()
    : null;

debug.log('ColorInfoTab labValues normalized:', normalizedLab, 'source:', labValues?.source, 'conditions:', labValues?.conditions);

// Debug comparison with stored Lab values if available
if (normalizedLab && color.lab_l !== undefined && color.lab_a !== undefined && color.lab_b !== undefined) {
    const storedLab = { L: color.lab_l, a: color.lab_a, b: color.lab_b };
    const labDiff = {
        L: Math.abs(normalizedLab.L - storedLab.L),
        a: Math.abs(normalizedLab.a - storedLab.a),
        b: Math.abs(normalizedLab.b - storedLab.b)
    };
    sdebug.warn('Lab value comparison:', {
        stored: storedLab,
        calculated: normalizedLab,
        differences: labDiff,
        significantDiff: labDiff.L > 1 || labDiff.a > 1 || labDiff.b > 1
    });
}

const chValues = normalizedLab ? labToChromaHue(normalizedLab.L, normalizedLab.a, normalizedLab.b) : null;
const labString = normalizedLab
    ? `L*: ${normalizedLab.L.toFixed(2)}, a*: ${normalizedLab.a.toFixed(2)}, b*: ${normalizedLab.b.toFixed(2)}`
    : 'N/A';
const chString = chValues
    ? `C*: ${chValues.C.toFixed(2)}, h*: ${chValues.h.toFixed(2)}°`
    : 'N/A';
const labSource = labValues?.source || 'none';
const labConditions = labValues?.conditions;
    
    return (
        <Card>
            <CardContent className="p-6">
                <div className="space-y-6">
                    
            {/* Appearance and Spectral Data Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col">
                    <h3 className="text-xl font-semibold mb-4 text-gray-700">Appearance</h3>
                    <div 
                        className="w-full h-48 rounded-lg border border-gray-300 transition-colors duration-500 ease-in-out" 
                        style={{ 
                            backgroundColor: displayedColor.hex || lastHexRef.current || color.hex || color.color_hex || '#f3f4f6' 
                        }} 
                    />
                </div>
                <div className="flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xl font-semibold text-gray-700">Spectral Data</h3>
                        {isInkBased && spectralData && (
                            <Badge variant="outline">
                                Measurements
                            </Badge>
                        )}
                    </div>
                    {spectralDataForPlot.length === 0 && isInkBased && (
                        <p className="text-sm text-gray-500 mb-2">No spectral data available.</p>
                    )}
                    <div className="w-full h-48 bg-gray-50 p-2 rounded-lg border">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart 
                                data={spectralDataForPlot} 
                                margin={{ top: 5, right: 20, left: -10, bottom: 5 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                                <XAxis 
                                    dataKey="wavelength" 
                                    unit="nm" 
                                    tick={{ fontSize: 12 }} 
                                    type="number" 
                                    domain={['dataMin', 'dataMax']} 
                                />
                                 <YAxis 
                                    tick={{ fontSize: 12 }} 
                                    domain={[0, maxReflectance > 1.2 ? Math.ceil(maxReflectance * 1.05) : 1]}
                                 />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'rgba(255, 255, 255, 0.8)',
                                        border: '1px solid #ccc',
                                        borderRadius: '4px',
                                    }}
                                />
                                <Line 
                                    type="monotone" 
                                    dataKey="reflectance" 
                                    stroke="#8884d8" 
                                    strokeWidth={2} 
                                    dot={false}
                                    isAnimationActive={true}
                                    animationDuration={400}
                                    animationEasing="ease-in-out"
                                />
                             </LineChart>
                         </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Color Settings Card */}
            <Card>
                {/* Card-level header with edit controls for existing colors */}
                {!isNew && (
                    <CardHeader
                        title="Color Settings"
                        onEdit={canEditThisColor ? (e) => {
                            e?.preventDefault();
                            e?.stopPropagation();
                            // Store original values when entering edit mode
                            setOriginalValues({
                                name: nameValue,
                                status,
                                standardType,
                                selectedTagIds: [...selectedTagIds],
                                selectedPrintConditionIds: [...selectedPrintConditionIds]
                            });
                            setHasUnsavedChanges(false);
                            onEdit?.();
                        } : undefined}
                        onSave={async () => {
                            if (!isEditing) return;
                            
                            // Mark save in progress to prevent useEffect from resetting state
                            savingRef.current = true;
                            setIsSavingTags(true);
                            
                            try {
                                // Prepare updated data
                                const updatedData = {
                                    name: nameValue.trim(),
                                    standardType,
                                    status: status || 'Production',
                                    tags: color.tags
                                };
                                
                                console.log('[ColorInfoTab] About to call onSave:', {
                                    onSaveExists: !!onSave,
                                    onSaveType: typeof onSave,
                                    onSaveValue: onSave,
                                    updatedData
                                });
                                
                                // Call parent save handler
                                await onSave?.(updatedData);
                                setHasUnsavedChanges(false);
                            } finally {
                                // Reset UI saving flag (but keep savingRef true until color prop updates)
                                setIsSavingTags(false);
                            }
                        }}
                        onCancel={() => {
                            // Reset to original values
                            setNameValue(originalValues.name);
                            setStatus(originalValues.status);
                            setStandardType(originalValues.standardType);
                            setSelectedPrintConditionIds([...originalValues.selectedPrintConditionIds]);
                            setHasUnsavedChanges(false);
                            onCancel?.();
                        }}
                        showEdit={canEditThisColor && !isEditing}
                        showLearn={false}
                        isEditing={isEditing}
                        canSave={hasUnsavedChanges}
                        saving={isSavingTags}
                    />
                )}
                
                {/* Simple header for new colors (page-level controls used) */}
                {isNew && (
                    <UICardHeader>
                        <CardTitle className="text-lg font-semibold">Color Settings</CardTitle>
                    </UICardHeader>
                )}
                <CardContent className="space-y-3">
                    {/* Row 1: Name, Status, and Standard Type */}
                    <div className="grid gap-6" style={{ gridTemplateColumns: '1.5fr 0.7fr 1fr' }}>
                        <div>
                            <Label className="text-sm font-medium text-gray-700 mb-2 block">
                                Name
                                {(fromInkConditionId || color?.from_ink_condition_id) && !nameValue.trim() && (
                                    <span className="ml-1 text-destructive">(required)</span>
                                )}
                            </Label>
                            {(isEditing || allowNameEdit) && canEditThisColor ? (
                                <Input
                                    value={nameValue}
                                    onChange={(e) => {
                                        setNameValue(e.target.value);
                                        setHasUnsavedChanges(true);
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Escape') {
                                            setNameValue(fromInkConditionId ? '' : (color.name || ''));
                                            e.currentTarget.blur();
                                        }
                                    }}
                                    autoFocus={autoFocusName}
                                    className="w-full focus-visible:ring-0 focus-visible:ring-offset-0"
                                    placeholder="Enter color name"
                                />
                            ) : (
                                <div className="w-full h-10 px-3 py-2 border border-input bg-muted rounded-md flex items-center">
                                    <span className="text-sm text-muted-foreground">{color.name}</span>
                                </div>
                            )}
                        </div>
                        <div>
                            <label className="text-sm font-medium text-gray-700 mb-2 block">Status</label>
                            <Select value={status} onValueChange={(value) => {
                                setStatus(value);
                                setHasUnsavedChanges(true);
                            }} disabled={!isEditing}>
                                <SelectTrigger className="w-full" disabled={!isEditing || !canEditThisColor}>
                                    <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Production">Production</SelectItem>
                                    <SelectItem value="In Development">In Development</SelectItem>
                                    <SelectItem value="Inactive">Inactive</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex flex-col h-full">
                            <label className="text-sm font-medium text-gray-700 mb-2 block">Standard Type</label>
                            <RadioGroup 
                                value={standardType || 'master'} 
                                onValueChange={(value) => {
                                    handleStandardTypeChange(value);
                                    setHasUnsavedChanges(true);
                                }}
                            disabled={!isEditing || !canEditThisColor}
                                className="flex gap-6 items-center h-10"
                            >
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="master" id="master" disabled={!isEditing || !canEditThisColor} />
                                    <label htmlFor="master" className="text-sm font-medium cursor-pointer">
                                        Master
                                    </label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="dependent" id="dependent" disabled={!isEditing || !canEditThisColor} />
                                    <label htmlFor="dependent" className="text-sm font-medium cursor-pointer">
                                        Dependent
                                    </label>
                                </div>
                            </RadioGroup>
                        </div>
                    </div>

                    {/* Row 2: Print Conditions (conditional) */}
                    <div className={`transition-all duration-300 ease-in-out overflow-hidden ${
                        standardType === 'dependent' ? 'max-h-32 opacity-100' : 'max-h-0 opacity-0'
                    }`}>
                        <div className="pt-2">
                            <label className="text-sm font-medium text-gray-700 mb-2 block">Print Conditions</label>
                            <MultiSelect
                                options={printConditionOptions}
                                selected={selectedPrintConditionIds}
                                onChange={(value) => {
                                    setSelectedPrintConditionIds(value);
                                    setHasUnsavedChanges(true);
                                }}
                                placeholder="Select print conditions..."
                                className="w-full"
                                disabled={!isEditing || !canEditThisColor}
                            />
                        </div>
                    </div>

                    {/* Row 3: Tags */}
                    <div>
                        <label className="text-sm font-medium text-gray-700 mb-2 block">Tags</label>
                        <MultiSelect
                            options={tagOptions}
                            selected={uiSelectedTagIds}
                            onChange={handleTagChange}
                            placeholder="Select tags..."
                            disabled={!isEditing || !canEditThisColor}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Additional Info Card */}
            <Card>
                <UICardHeader className="pb-2">
                    <CardTitle className="text-xl font-semibold text-gray-700">Additional Info</CardTitle>
                </UICardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 gap-6">
                        {/* Column 1: Lab, Ch, Hex */}
                        <div className="space-y-4">
                            <InfoRow 
                                label="Lab" 
                                renderAsBadges={normalizedLab} 
                                badgeValues={normalizedLab ? [
                                    { label: `L:${normalizedLab.L.toFixed(2)}`, variant: "secondary", className: "font-mono text-xs" },
                                    { label: `a:${normalizedLab.a.toFixed(2)}`, variant: "secondary", className: "font-mono text-xs" },
                                    { label: `b:${normalizedLab.b.toFixed(2)}`, variant: "secondary", className: "font-mono text-xs" }
                                ] : null}
                                value={labString}
                            />
                            <InfoRow 
                                label="Ch" 
                                renderAsBadges={chValues} 
                                badgeValues={chValues ? [
                                    { label: `C: ${chValues.C.toFixed(2)}`, variant: "secondary", className: "font-mono text-xs" },
                                    { label: `h: ${chValues.h.toFixed(2)}°`, variant: "secondary", className: "font-mono text-xs" }
                                ] : null}
                                value={chString} 
                            />
                            <InfoRow label="Hex" value={displayedColor.hex} />
                        </div>
                        
                        {/* Column 2: Source data, Last edited date, Last edited by */}
                        <div className="space-y-4">
                            <InfoRow 
                                label="Source data" 
                                value={(() => {
                                    // Extract wavelength range from spectral data
                                    const getWavelengthRange = () => {
                                        if (spectralData && Object.keys(spectralData).length > 0) {
                                            const wavelengths = Object.keys(spectralData).map(w => parseInt(w)).filter(w => !isNaN(w));
                                            if (wavelengths.length > 0) {
                                                wavelengths.sort((a, b) => a - b);
                                                const min = wavelengths[0];
                                                const max = wavelengths[wavelengths.length - 1];
                                                return `${min}-${max}nm`;
                                            }
                                        }
                                        return '380-730nm'; // fallback
                                    };
                                    
                                    if (spectralData) {
                                        return `Spectral (${getWavelengthRange()})`;
                                    } else {
                                        // For stored Lab values, show simplified format
                                        const illuminant = measurementControls?.illuminant || 'D50';
                                        const observer = measurementControls?.observer || '2';
                                        return `Lab (${illuminant}, ${observer}°)`;
                                    }
                                })()} 
                            />
                            <InfoRow label="Last edited date" value={color.updated_at ? new Date(color.updated_at).toLocaleDateString() : 'N/A'} />
                            <InfoRow label="Last edited by" value={(userNames.lastEditedByName || userNames.createdByName) || 'N/A'} />
                        </div>
                    </div>
                </CardContent>
            </Card>
                </div>

                {/* ASTM Import Tools */}
                {canAccessWeightingTools && weightingToolsEnabled && (
                    <WeightingFunctionImport />
                )}
            </CardContent>
        </Card>
    );
});

// Diagnostic effect to track spectral source changes
ColorInfoTab.displayName = 'ColorInfoTab';

export default ColorInfoTab;