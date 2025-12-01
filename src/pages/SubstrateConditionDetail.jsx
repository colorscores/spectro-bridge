import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2, Upload, ChevronDown, Plus, Edit3, X, Save } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Breadcrumb from '@/components/Breadcrumb';
import CxfImportDialogWrapper from '@/components/cxf/CxfImportDialogWrapper';
import SubstrateConditionInfo from '@/components/conditions/SubstrateConditionInfo';
import SubstrateConditionInfoTab from '@/components/substrates/SubstrateConditionInfoTab';
import HistoryTab from '@/components/common/HistoryTab';
import ColorSettingsBox from '@/components/ColorSettingsBox';
import SpectralPlot from '@/components/conditions/SpectralPlot';
import ColorInfoPanel from '@/components/conditions/ColorInfoPanel';
import ConstructionPanel from '@/components/conditions/ConstructionPanel';

import { generateRandomSpectralData, labToHexD65 } from '@/lib/colorUtils';
import { useProfile } from '@/context/ProfileContext';
import { parseCgats } from '@/lib/cgatsParser';
import { useSubstratesData } from '@/context/SubstrateContext';
import CxfParserClient from '@/components/substrate/CxfParserClient';
import { useSpectralCalculations } from '@/hooks/useSpectralCalculations';

import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { generateSubstrateConditionName } from '@/lib/substrateConditionNaming';
import { retrieveImportedSubstrateData, clearImportedSubstrateData } from '@/utils/substrateDataTransfer';
import { fixSubstrateCondition } from '@/lib/substrateConditionFixer';
import SubstrateConditionDebugPanel from '@/components/debug/SubstrateConditionDebugPanel';
import '@/lib/fixSubstrateConditionModes'; // Auto-fix modes once



const SubstrateConditionDetail = () => {
    const { substrateId, conditionId } = useParams();
    const navigate = useNavigate();
    
    const { profile, loading: profileLoading } = useProfile();
    const { refetch: refetchSubstrates, optimisticUpdateSubstrateCondition, optimisticAddSubstrateCondition } = useSubstratesData();
    const isNew = conditionId === 'new';

    // Helper functions for display name generation (matching SubstrateContext logic)
    const shouldUseAutoName = (condition, substrate) => {
        if (!condition.construction_details) return true;
        if (!condition.name.includes(substrate.name)) return true;
        if (condition.version && !condition.name.includes(condition.version)) return true;
        return false;
    };

    const generateDisplayName = (condition, substrate) => {
        const details = condition.construction_details || {};
        if (!substrate?.printing_side) {
            return condition.name || 'Condition';
        }
        try {
            return generateSubstrateConditionName({
                substrateColor: null,
                printSide: substrate.printing_side,
                useWhiteInk: details.useWhiteInk,
                primerEnabled: details.primerEnabled,
                basecoatEnabled: details.basecoatEnabled,
                coatingEnabled: details.coatingEnabled,
                laminateEnabled: details.laminateEnabled,
                laminateSurfaceQuality: details.laminateSurfaceQuality,
                varnishEnabled: details.varnishEnabled,
                varnishSurfaceQuality: details.varnishSurfaceQuality,
                version: condition.version
            });
        } catch (error) {
            return condition.name || 'Condition';
        }
    };


    const [condition, setCondition] = useState(null);
    const [parentSubstrate, setParentSubstrate] = useState(null);
    const [allSubstrates, setAllSubstrates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    
    const [measurementControls, setMeasurementControls] = useState({
        mode: 'M0',
        illuminant: 'D50',
        observer: '2',
        table: '5',
    });

    // Standards state (defined early to use below)
    const [standards, setStandards] = useState({
        illuminants: [],
        observers: [],
        astmTables: [],
        loading: true
    });

    // Use locally-fetched ASTM tables from standards to avoid dispatcher issues
    const astmTables = standards.astmTables || [];
    const astmLoading = standards.loading;
    const spectralCalculations = useSpectralCalculations(
        condition?.spectral_data,
        measurementControls.illuminant,
        measurementControls.observer,
        measurementControls.table
    );
    
    const [constructionDetails, setConstructionDetails] = useState(null);
    const [isEditMode, setIsEditMode] = useState(isNew); // New conditions start in edit mode
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [originalCondition, setOriginalCondition] = useState(null);
    
    // Individual card edit modes
    const [infoCardEditMode, setInfoCardEditMode] = useState(isNew);
    const [constructionCardEditMode, setConstructionCardEditMode] = useState(isNew);
    const [infoCardUnsavedChanges, setInfoCardUnsavedChanges] = useState(false);
    const [constructionCardUnsavedChanges, setConstructionCardUnsavedChanges] = useState(false);

    // CxF parser state - will be populated by CxfParserClient
    const [cxfDialogOpen, setCxfDialogOpen] = useState(false);
    const [cxfColors, setCxfColors] = useState([]);
    const [showCxfParser, setShowCxfParser] = useState(false);
    const cxfParserRef = useRef(null);

    // CGATS parser state
    const cgatsInputRef = useRef(null);
    const [cgatsDialogOpen, setCgatsDialogOpen] = useState(false);
    const [cgatsColors, setCgatsColors] = useState([]);

    const [organization, setOrganization] = useState(null);

    // Safe JSON parser: accepts objects or JSON strings; returns null on parse failure
    const safeJson = (val) => {
        if (val == null) return null;
        if (typeof val === 'string') {
            try { return JSON.parse(val); } catch (e) { console.warn('safeJson parse failed', e, val); return null; }
        }
        return val;
    };

    useEffect(() => {
        const fetchOrganization = async () => {
            try {
                // Skip organization fetch for new conditions to speed up initial load
                if (isNew) {
                    setOrganization(null);
                    return;
                }

                const { data: organizationRes, error } = await supabase
                    .from('organizations')
                    .select('*')
                    .eq('id', profile.organization_id)
                    .maybeSingle();

                if (error) throw error;
                if (organizationRes) {
                    setOrganization(organizationRes);
                }
            } catch (error) {
                toast({ title: 'Error fetching organization', description: error.message, variant: 'destructive' });
            }
        };
        if (profile?.organization_id) {
            fetchOrganization();
        }
    }, [profile?.organization_id, toast, isNew]);

    useEffect(() => {
        const fetchStandards = async () => {
            try {
                // For new conditions, we can lazy load these standards
                if (isNew) {
                    setStandards({
                        illuminants: [],
                        observers: [],
                        astmTables: [],
                        loading: false
                    });
                    return;
                }

                const [illuminantsRes, observersRes, astmTablesRes] = await Promise.all([
                    supabase.from('illuminants').select('*').order('name'),
                    supabase.from('observers').select('*').order('name'),
                    supabase.from('astm_e308_tables').select('*').order('table_number')
                ]);

                setStandards({
                    illuminants: illuminantsRes.data || [],
                    observers: observersRes.data || [],
                    astmTables: astmTablesRes.data || [],
                    loading: false
                });
            } catch (error) {
                console.error('Error fetching standards:', error);
                setStandards(prev => ({ ...prev, loading: false }));
            }
        };

        fetchStandards();
    }, [isNew]);

    // Update condition with calculated color values when spectral calculations change
    useEffect(() => {
        if (spectralCalculations.lab && spectralCalculations.ch && condition?.spectral_data) {
            const colorHex = labToHexD65(spectralCalculations.lab.L, spectralCalculations.lab.a, spectralCalculations.lab.b);
            setCondition(prev => ({
                ...prev,
                lab: spectralCalculations.lab,
                ch: spectralCalculations.ch,
                color_hex: colorHex
            }));
        }
    }, [spectralCalculations, condition?.spectral_data]);

    const updateConditionWithParsedData = (parsedData) => {
        console.log('📥 updateConditionWithParsedData called with:', parsedData);
        
        setCondition(prev => {
            const updated = {
                ...prev,
                name: parsedData.name || prev.name,
                spectral_data: parsedData.spectral,
                lab: parsedData.lab || prev.lab,
                color_hex: parsedData.color_hex || prev.color_hex,
                ch: parsedData.ch || prev.ch,
            };
            console.log('📤 Updated condition state:', updated);
            return updated;
        });
        
        // Mark as having unsaved changes for both new and existing conditions
        setHasUnsavedChanges(true);
        setInfoCardUnsavedChanges(true);
        
        // For new conditions, ensure we're in edit mode to show save controls
        if (isNew) {
            setInfoCardEditMode(true);
        }
        
        toast({
            title: 'Success!',
            description: 'Measurement data imported successfully. Click Save to persist the changes.'
        });
    };

    // Handle CxF import click - show parser when needed
    const handleCxfImportClick = () => {
        setShowCxfParser(true);
        // Wait for next tick to ensure parser is rendered
        setTimeout(() => {
            if (cxfParserRef.current?._cxfParser) {
                cxfParserRef.current._cxfParser.handleCxfImportClick();
            }
        }, 0);
    };

    // Handle import from CxF selection dialog
    const handleImportFromCxfSelection = (selectedObjects) => {
        console.log('🎯 handleImportFromCxfSelection called with:', selectedObjects);
        
        if (selectedObjects.length === 0) return;
        
        // For substrate conditions, we only expect one object
        const selectedObject = selectedObjects[0];
        if (!selectedObject.spectralData || Object.keys(selectedObject.spectralData).length === 0) {
            toast({
                title: 'Error',
                description: 'No spectral data found in selected object.',
                variant: 'destructive',
            });
            return;
        }
        
        updateConditionWithParsedData({ 
            name: selectedObject.name, 
            spectral: selectedObject.spectralData 
        });
        
        setCxfDialogOpen(false);
        setCxfColors([]);
        setShowCxfParser(false);
    };

    const handleFileChange = (event, type) => {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const content = e.target.result;
                if (type === 'cgats') {
                    const parsedColors = parseCgats(content);
                    if (parsedColors.length > 0) {
                        // Always show selection dialog for CGATS, even for single color
                        setCgatsColors(parsedColors);
                        setCgatsDialogOpen(true);
                    } else {
                        throw new Error("No valid color data found in the file.");
                    }
                }
            } catch (error) {
                toast({
                    title: `Error Parsing ${type.toUpperCase()} File`,
                    description: error.message,
                    variant: 'destructive',
                });
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    };

    // Normalize CGATS data to match CxF structure for dialog display
    const normalizeCgatsForDialog = (cgatsColors) => {
        return cgatsColors.map((color, index) => ({
            name: color.name,
            objectType: 'ColorValues',
            spectralData: color.spectral || null,
            lab: color.lab || null,
            hex: color.hex || '#000000',
            // Don't set measurementMode - let dialog detect missing mode and show assignment card
            measurements: color.lab ? [{
                lab: color.lab,
                spectral_data: color.spectral
            }] : [],
            index: index
        }));
    };

    // Handle import from CGATS selection dialog
    const handleImportFromCgatsSelection = (selectedObjects) => {
        console.log('🎯 handleImportFromCgatsSelection called with:', selectedObjects);
        
        if (selectedObjects.length === 0) return;
        
        const selectedColor = selectedObjects[0];
        const spectral = selectedColor.spectralData || selectedColor.measurements?.[0]?.spectral_data;
        
        if (!spectral || Object.keys(spectral).length === 0) {
            toast({
                title: 'Error',
                description: 'No spectral data found in selected object.',
                variant: 'destructive',
            });
            return;
        }
        
        console.log('Assigned measurement mode:', selectedColor.measurementMode);
        
        updateConditionWithParsedData({ 
            name: selectedColor.name, 
            spectral: spectral,
            lab: selectedColor.lab,
            color_hex: selectedColor.hex
        });
        
        // Store measurement mode if assigned
        if (selectedColor.measurementMode) {
            setMeasurementControls(prev => ({
                ...prev,
                mode: selectedColor.measurementMode
            }));
        }
        
        setCgatsDialogOpen(false);
        setCgatsColors([]);
        
        toast({
            title: 'Import Successful',
            description: `Imported data from ${selectedColor.name}${selectedColor.measurementMode ? ` with ${selectedColor.measurementMode} mode` : ''}`,
        });
    };

    const fetchData = useCallback(async (currentSubstrateId, currentConditionId) => {
        setLoading(true);
        try {
            // For new conditions, we only need the parent substrate data
            const parentPromise = supabase
                .from('substrates')
                .select(`
                    *,
                    type:substrate_types!left(name),
                    material:substrate_materials!left(name),
                    surface_quality:substrate_surface_qualities!left(name)
                `)
                .eq('id', currentSubstrateId)
                .maybeSingle();

            // Only fetch condition data if it's not a new condition
            const conditionPromise = currentConditionId !== 'new' 
                ? supabase.from('substrate_conditions').select('*').eq('id', currentConditionId).maybeSingle()
                : Promise.resolve({ data: null, error: null });

            // For new conditions, we can skip all substrates data initially - only load on demand
            const allSubstratesPromise = currentConditionId !== 'new'
                ? supabase.from('substrates').select('id, name, surface_quality:substrate_surface_qualities!left(id, name)')
                : Promise.resolve({ data: [], error: null });

            const [{ data: parentData, error: parentError }, { data: conditionData, error: conditionError }, { data: allSubstratesData, error: allSubstratesError }] = await Promise.all([parentPromise, conditionPromise, allSubstratesPromise]);

            if (parentError) {
                throw parentError;
            }
            if (!parentData) {
                throw new Error('Substrate not found');
            }
            setParentSubstrate(parentData);
            if (allSubstratesError) throw allSubstratesError;
            setAllSubstrates(allSubstratesData || []);

            if (currentConditionId !== 'new') {
                
                if (conditionError) {
                    throw conditionError;
                }
                
                if (!conditionData) {
                    throw new Error('Substrate condition not found');
                }
                
                // Normalize possible JSON strings into objects
                const parsedMeasurementSettings = safeJson(conditionData.measurement_settings);
                const parsedConstructionDetails = safeJson(conditionData.construction_details);
                let spectralData = conditionData.spectral_data;
                if (typeof spectralData === 'string' || spectralData == null) {
                    spectralData = spectralData ? safeJson(spectralData) : safeJson(conditionData.spectral_string);
                }
                const parsedLab = safeJson(conditionData.lab) || conditionData.lab;
                const parsedCh = safeJson(conditionData.ch) || conditionData.ch;

                if (parsedMeasurementSettings) {
                    setMeasurementControls(parsedMeasurementSettings);
                }
                setConstructionDetails(parsedConstructionDetails || null);

                const inferredUsePackType = (
                    conditionData.use_pack_type !== undefined && conditionData.use_pack_type !== null
                ) ? conditionData.use_pack_type : Boolean(conditionData.pack_type);

                const conditionWithWhiteInk = {
                    ...conditionData,
                    spectral_data: spectralData || conditionData.spectral_data,
                    lab: parsedLab,
                    ch: parsedCh,
                    measurement_settings: parsedMeasurementSettings || conditionData.measurement_settings,
                    construction_details: parsedConstructionDetails || conditionData.construction_details,
                    use_white_ink: parentData.use_white_ink,
                    use_pack_type: inferredUsePackType,
                };
                setCondition(conditionWithWhiteInk);
                setOriginalCondition(conditionWithWhiteInk);
                setIsEditMode(false);
                setHasUnsavedChanges(false);

                // Check if this substrate condition needs data processing (missing spectral/lab but has imported_tints)
                if (!conditionWithWhiteInk.spectral_data && !conditionWithWhiteInk.lab && conditionWithWhiteInk.imported_tints) {
                    console.log('🔧 Detected substrate condition with missing processed data, attempting to fix...');
                    try {
                        await fixSubstrateCondition(currentConditionId);
                        // Refetch the data after fixing
                        await fetchData(substrateId, currentConditionId);
                        toast({
                            title: 'Data Processed',
                            description: 'Successfully processed imported data for substrate condition.',
                        });
                    } catch (error) {
                        console.error('Failed to fix substrate condition:', error);
                        toast({
                            title: 'Processing Failed',
                            description: 'Could not process imported data. Please check the measurement data.',
                            variant: 'destructive'
                        });
                    }
                }
            } else {
                const initialControls = { mode: 'M0', illuminant: 'D50', observer: '2', table: '5' };
                setMeasurementControls(initialControls);
                
                // Check for imported substrate data from session storage
                const importedData = retrieveImportedSubstrateData();
                let initialCondition = {
                    name: '', 
                    spectral_data: null,
                    use_white_ink: parentData.use_white_ink,
                };
                
                if (importedData) {
                    initialCondition = {
                        ...initialCondition,
                        name: importedData.name || '',
                        spectral_data: importedData.spectral_data || null,
                        lab: importedData.lab,
                        color_hex: importedData.color_hex,
                        ch: importedData.ch,
                    };
                    
                    // Clear the imported data after use
                    clearImportedSubstrateData();
                    
                    toast({
                        title: 'Imported Data Applied',
                        description: 'Pre-populated substrate condition with imported measurement data.'
                    });
                }
                
                setCondition(initialCondition);
                setConstructionDetails(null);
                setIsEditMode(true); // New conditions start in edit mode
                setInfoCardEditMode(true); // Enable card edit modes for new conditions
                setConstructionCardEditMode(true);
                setHasUnsavedChanges(false);
                setOriginalCondition(null);
            }
        } catch (error) {
            console.error('❌ SubstrateConditionDetail - Error in fetchData:', error);
            toast({ title: 'Error fetching data', description: error.message, variant: 'destructive' });
            navigate('/assets/substrates');
        } finally {
            setLoading(false);
        }
    }, [toast, navigate]);

    useEffect(() => {
        if (substrateId && !astmLoading && profile) {
            fetchData(substrateId, conditionId);
        }
    }, [substrateId, conditionId, fetchData, astmLoading, profile, profileLoading]);

    const handleNameChange = (e) => {
        setCondition(prev => ({ ...prev, name: e.target.value }));
        if (!isNew) setHasUnsavedChanges(true);
    };

    const handleMeasurementControlsChange = (newControls) => {
        setMeasurementControls(newControls);
        if (!isNew) setHasUnsavedChanges(true);
    };

    const handlePackTypeChange = (packType) => {
        setCondition(prev => ({ ...prev, pack_type: packType }));
        if (!isNew) setHasUnsavedChanges(true);
    };

    const handleConditionChange = (field, value) => {
        const updatedCondition = { ...condition, [field]: value };
        
        // Compute color_hex if spectral data or lab values changed
        if ((field === 'spectral_data' || field === 'lab') && astmTables?.length > 0) {
            try {
                let computedColorHex = updatedCondition.color_hex;
                
                if (field === 'spectral_data' && value) {
                    const spectralResult = spectralToLabASTME308(value, astmTables[0]);
                    if (spectralResult) {
                        computedColorHex = labToHexD65(spectralResult.L, spectralResult.a, spectralResult.b);
                        updatedCondition.lab = spectralResult;
                        updatedCondition.ch = labToChromaHue(spectralResult.L, spectralResult.a, spectralResult.b);
                    }
                } else if (field === 'lab' && value?.L !== undefined && value?.a !== undefined && value?.b !== undefined) {
                    computedColorHex = labToHexD65(value.L, value.a, value.b);
                    updatedCondition.ch = labToChromaHue(value.L, value.a, value.b);
                }
                
                if (computedColorHex) {
                    updatedCondition.color_hex = computedColorHex;
                    
                    // Optimistic update for color changes
                    if (!isNew && parentSubstrate?.id && condition.id) {
                        optimisticUpdateSubstrateCondition(parentSubstrate.id, condition.id, { color_hex: computedColorHex });
                    }
                }
            } catch (e) {
                console.warn('Failed to compute color:', e);
            }
        }
        
        setCondition(updatedCondition);
        if (!isNew) setHasUnsavedChanges(true);
    };

    const handleConstructionDetailsChange = (newConstructionDetails) => {
        console.log('🔧 Construction details changed:', newConstructionDetails);
        setConstructionDetails(newConstructionDetails);
        if (!isNew) setHasUnsavedChanges(true);
    };

    const handleSaveUpdate = async () => {
        
        if (profileLoading || !profile) {
            toast({ title: 'Error', description: 'You must be logged in to perform this action.', variant: 'destructive' });
            return;
        }
        if (!condition.name) {
            toast({ title: 'Name is required', description: 'Please enter a name for the substrate condition.', variant: 'destructive' });
            return;
        }

        setSaving(true);
        try {
            // Fetch organization data if not available
            let organization = profile.organization;
            if (!organization?.default_illuminant) {
                const { data: orgData } = await supabase
                    .from('organizations')
                    .select('default_illuminant, default_observer, default_astm_table')
                    .eq('id', profile.organization_id)
                    .single();
                organization = orgData || {
                    default_illuminant: 'D50',
                    default_observer: '2',
                    default_astm_table: '5'
                };
            }

            // Ensure ASTM tables are available
            let tablesForCalculation = astmTables;
            if (!tablesForCalculation || tablesForCalculation.length === 0) {
                console.log('🔄 Fetching ASTM tables for color calculation...');
                const { data: fetchedTables } = await supabase
                    .from('astm_e308_tables')
                    .select('*');
                tablesForCalculation = fetchedTables || [];
            }

            // Calculate color directly from spectral data using org defaults
            const { computeDefaultDisplayColor } = await import('@/lib/colorUtils/colorConversion');
            const orgDefaults = {
                default_illuminant: organization.default_illuminant || 'D50',
                default_observer: organization.default_observer || '2',
                default_astm_table: organization.default_astm_table || '5'
            };
            
            console.log('🎨 Computing color_hex from spectral_data:', {
                hasSpectralData: !!condition.spectral_data,
                spectralDataKeys: condition.spectral_data ? Object.keys(condition.spectral_data).slice(0, 5) : [],
                tablesAvailable: tablesForCalculation?.length || 0,
                orgDefaults
            });
            
            const computedColorHex = condition.spectral_data && tablesForCalculation?.length > 0
                ? computeDefaultDisplayColor(condition, orgDefaults, tablesForCalculation, 'imported', condition.spectral_data)
                : (condition.color_hex || '#E5E7EB');
            
            console.log('💾 Computed color_hex for save:', computedColorHex);

            const spectralString = JSON.stringify(condition.spectral_data);
            const dataToSave = {
                substrate_id: substrateId,
                name: condition.name,
                pack_type: condition.pack_type,
                color_hex: computedColorHex,
                lab: condition.lab,
                ch: condition.ch,
                spectral_data: condition.spectral_data,
                spectral_string: spectralString,
                organization_id: profile.organization_id,
                measurement_settings: measurementControls,
                construction_details: constructionDetails,
                use_white_ink: parentSubstrate.use_white_ink,
            };

            if (isNew) {
                const { data, error } = await supabase.from('substrate_conditions').insert(dataToSave).select().single();
                if (error) throw error;
                toast({ title: 'Success!', description: 'Substrate condition created successfully.' });
                if (parentSubstrate?.id && data) {
                    const optimisticNewCondition = {
                        ...data,
                        color_hex: computedColorHex, // Ensure optimistic update has correct color
                        displayName: shouldUseAutoName(data, parentSubstrate) 
                            ? generateDisplayName(data, parentSubstrate) 
                            : data.name,
                    };
                    console.log('✅ Optimistic add new condition with color_hex:', computedColorHex);
                    optimisticAddSubstrateCondition(parentSubstrate.id, optimisticNewCondition);
                }
                navigate('/assets/substrates');
            } else {
                // Optimistic update BEFORE database save for immediate UI feedback
                if (parentSubstrate?.id) {
                    const optimisticData = {
                        id: conditionId,
                        ...dataToSave,
                        color_hex: computedColorHex, // Ensure optimistic update has correct color
                        displayName: shouldUseAutoName(dataToSave, parentSubstrate) 
                            ? generateDisplayName(dataToSave, parentSubstrate) 
                            : dataToSave.name,
                        updated_at: new Date().toISOString()
                    };
                    console.log('🔄 Optimistic update with color_hex:', computedColorHex);
                    optimisticUpdateSubstrateCondition(parentSubstrate.id, conditionId, optimisticData);
                }
                
                const { data, error } = await supabase.from('substrate_conditions').update(dataToSave).eq('id', conditionId).select().maybeSingle();
                if (error) throw error;
                if (!data) {
                    throw new Error('Substrate condition not found - it may have been deleted');
                }
                toast({ title: 'Success!', description: 'Substrate condition updated successfully.' });
                
                // Update with actual database response to ensure sync
                if (parentSubstrate?.id && data) {
                    const finalData = {
                        ...data,
                        color_hex: computedColorHex, // Ensure final update has correct color
                        displayName: shouldUseAutoName(data, parentSubstrate) 
                            ? generateDisplayName(data, parentSubstrate) 
                            : data.name,
                    };
                    console.log('✅ Final update with color_hex:', computedColorHex);
                    optimisticUpdateSubstrateCondition(parentSubstrate.id, conditionId, finalData);
                }
                navigate('/assets/substrates');
            }

        } catch (error) {
            toast({ title: 'Error saving condition', description: error.message, variant: 'destructive' });
        } finally {
            setSaving(false);
        }
    };

    const handleSaveNew = async () => {
        if (profileLoading || !profile) {
            toast({ title: 'Error', description: 'You must be logged in to perform this action.', variant: 'destructive' });
            return;
        }
        if (!condition.name) {
            toast({ title: 'Name is required', description: 'Please enter a name for the substrate condition.', variant: 'destructive' });
            return;
        }

        // Check if the name is the same as the original condition
        if (originalCondition && condition.name === originalCondition.name) {
            toast({ 
                title: 'Different name required', 
                description: 'If you wish to create a new substrate condition, please use a different name than the existing condition.', 
                variant: 'destructive' 
            });
            return;
        }

        setSaving(true);
        try {
            const hasCalc = spectralCalculations?.lab && spectralCalculations?.ch;
            // Calculate color using org defaults to ensure consistency
            const { calculateSubstrateConditionHex } = await import('@/utils/substrateColorMigration');
            const computedHex = calculateSubstrateConditionHex(condition, profile.organization, astmTables) || condition.color_hex;
            const spectralString = JSON.stringify(condition.spectral_data);
            const dataToSave = {
                substrate_id: substrateId,
                name: condition.name,
                pack_type: condition.pack_type,
                color_hex: computedHex,
                lab: hasCalc ? spectralCalculations.lab : condition.lab,
                ch: hasCalc ? spectralCalculations.ch : condition.ch,
                spectral_data: condition.spectral_data,
                spectral_string: spectralString,
                organization_id: profile.organization_id,
                measurement_settings: measurementControls,
                construction_details: constructionDetails,
                use_white_ink: parentSubstrate.use_white_ink,
            };

            const { data, error } = await supabase.from('substrate_conditions').insert(dataToSave).select().single();
            if (error) throw error;
            toast({ title: 'Success!', description: 'New substrate condition created successfully.' });
            await refetchSubstrates();
            navigate('/assets/substrates');

        } catch (error) {
            toast({ title: 'Error creating new condition', description: error.message, variant: 'destructive' });
        } finally {
            setSaving(false);
        }
    };

    // Auto-naming function
    const generateAutoName = useCallback(() => {
        if (!parentSubstrate) return '';
        
        const useWhiteInk = condition?.use_white_ink || false;
        const laminateEnabled = constructionDetails?.printedSubstrate?.enabled || constructionDetails?.Laminate?.enabled || false;
        const varnishEnabled = constructionDetails?.varnish?.enabled || false;
        
        // Get surface quality names from IDs if they exist
        let laminateSurfaceQuality = null;
        let varnishSurfaceQuality = null;
        
        if (laminateEnabled) {
            // Check both possible laminate keys
            const laminateData = constructionDetails?.printedSubstrate || constructionDetails?.Laminate;
            if (laminateData?.surfaceQuality) {
                // If it's already a string name, use it directly
                if (typeof laminateData.surfaceQuality === 'string' && 
                    !laminateData.surfaceQuality.includes('-')) {
                    laminateSurfaceQuality = laminateData.surfaceQuality;
                } else {
                    // For now, use a default since UUID lookup would require async call
                    // TODO: Add proper surface quality lookup
                    laminateSurfaceQuality = 'High Gloss'; // Temporary fix
                }
            }
        }
        
        if (varnishEnabled && constructionDetails?.varnish?.surfaceQuality) {
            // If it's already a string name, use it directly  
            if (typeof constructionDetails.varnish.surfaceQuality === 'string' && 
                !constructionDetails.varnish.surfaceQuality.includes('-')) {
                varnishSurfaceQuality = constructionDetails.varnish.surfaceQuality;
            }
        }
        
        console.log('🔍 Auto-naming params:', {
            substrateName: parentSubstrate.name,
            printSide: parentSubstrate.printing_side,
            useWhiteInk,
            laminateEnabled,
            laminateSurfaceQuality,
            varnishEnabled,
            varnishSurfaceQuality,
            version: condition?.version
        });
        
        return generateSubstrateConditionName({
            substrateName: parentSubstrate.name,
            printSide: parentSubstrate.printing_side,
            useWhiteInk,
            laminateEnabled,
            laminateSurfaceQuality,
            varnishEnabled,
            varnishSurfaceQuality,
            version: condition?.version
        });
    }, [parentSubstrate, constructionDetails]);

    const isAdmin = profile?.role === 'Admin' || profile?.role === 'Superadmin';
    const canEdit = isNew || isAdmin;
    const showEditControls = isAdmin;

    // Handle cancel - restore original condition if editing
    const handleCancel = () => {
        if (originalCondition) {
            setCondition(originalCondition);
            setMeasurementControls(originalCondition.measurement_settings || {
                mode: 'M0',
                illuminant: 'D50',
                observer: '2',
                table: '5',
            });
            setConstructionDetails(originalCondition.construction_details || null);
        }
        setIsEditMode(false);
        setInfoCardEditMode(false);
        setConstructionCardEditMode(false);
        setHasUnsavedChanges(false);
    };

    // Update auto-naming when construction details or condition change
    useEffect(() => {
        if (!parentSubstrate || !condition || !constructionDetails) return;
        const autoName = generateAutoName();
        console.log('🔄 Auto-naming (enforced):', { 
            autoName, 
            currentName: condition.name, 
            useWhiteInk: condition?.use_white_ink,
            willUpdate: autoName && autoName !== condition.name 
        });
        if (autoName && autoName !== condition.name) {
            // Update local state
            setCondition(prev => ({ ...prev, name: autoName }));
            // Persist immediately for existing records
            if (!isNew && condition?.id) {
              (async () => {
                try {
                  const { error } = await supabase
                    .from('substrate_conditions')
                    .update({ name: autoName })
                    .eq('id', condition.id);
                  if (error) {
                    console.warn('Failed to persist auto-generated name:', error);
                  } else {
                    console.log('✅ Persisted auto-generated name to DB');
                  }
                } catch (e) {
                  console.warn('Failed to persist auto-generated name (exception):', e);
                }
              })();
            }
        }
    }, [constructionDetails, parentSubstrate, generateAutoName, condition?.use_white_ink, condition?.version, isNew, condition?.id]);

    // Individual card edit handlers
    const handleInfoEdit = () => {
        setInfoCardEditMode(true);
        setInfoCardUnsavedChanges(false); // Reset unsaved changes when entering edit mode
    };

    const handleInfoSave = async () => {
        try {
            if (isNew) {
                // For new conditions, call the create handler
                await handleSaveNew();
            } else {
                // For existing conditions, call the update handler
                await handleSaveUpdate();
            }
            setInfoCardEditMode(false);
            setInfoCardUnsavedChanges(false);
        } catch (error) {
            console.error('Error saving substrate condition:', error);
            toast({
                title: 'Error',
                description: 'Failed to save substrate condition. Please try again.',
                variant: 'destructive'
            });
        }
    };

    const handleInfoCancel = () => {
        // Discard changes to this card by restoring original condition
        handleCancel();
        setInfoCardEditMode(false);
        setInfoCardUnsavedChanges(false);
    };

    const handleConstructionEdit = () => {
        setConstructionCardEditMode(true);
        setConstructionCardUnsavedChanges(false); // Reset unsaved changes when entering edit mode
    };

    const handleConstructionSave = async () => {
        try {
            if (isNew) {
                // For new conditions, call the create handler
                await handleSaveNew();
            } else {
                // For existing conditions, save construction changes
                await handleSaveUpdate();
            }
            setConstructionCardEditMode(false);
            setConstructionCardUnsavedChanges(false);
        } catch (error) {
            console.error('Error saving construction details:', error);
            toast({
                title: 'Error',
                description: 'Failed to save construction details. Please try again.',
                variant: 'destructive'
            });
        }
    };

    const handleConstructionCancel = () => {
        setConstructionCardEditMode(false);
        setConstructionCardUnsavedChanges(false);
        // Reset to original values if needed
    };

    if (loading || astmLoading || profileLoading) {
        return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /></div>;
    }

    if (!profile) {
        return (
            <div className="text-center p-10">
                <h1 className="text-xl font-bold mb-4">Authentication Required</h1>
                <p className="text-gray-600 mb-6">You must be logged in to access this page.</p>
                <Button asChild><Link to="/login">Login</Link></Button>
            </div>
        );
    }
    
    if (!parentSubstrate) {
        return (
            <div className="text-center p-10">
                <h1 className="text-xl font-bold mb-4">Parent substrate not found</h1>
                <p className="text-gray-600 mb-6">We couldn't find the substrate this condition belongs to.</p>
                <Button asChild><Link to="/assets/substrates">Back to Substrates</Link></Button>
            </div>
        );
    }

    if (!condition) {
        return (
            <div className="text-center p-10">
                <h1 className="text-xl">Condition not found.</h1>
                <Link to={`/assets/substrates/${substrateId}`} className="text-blue-500 hover:underline">Back to substrate</Link>
            </div>
        );
    }
    
    return (
        <>
            <Helmet><title>{`${isNew ? 'New' : 'Edit'} Condition - Color KONTROL`}</title></Helmet>
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col h-full p-4 sm:p-6 lg:p-8"
            >
                {/* Breadcrumb */}
                <Breadcrumb 
                    items={[
                        { label: 'Substrates', href: '/assets/substrates' },
                        { label: parentSubstrate?.name || '', href: `/assets/substrates/${substrateId}` },
                        { label: isNew ? 'New Condition' : condition?.name || '' },
                    ]} 
                >
                    {/* Page-level edit controls for new conditions */}
                    {isNew && (
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => navigate('/assets/substrates')}
                            >
                                Cancel
                            </Button>
                            <Button
                                size="sm"
                                onClick={handleSaveNew}
                                disabled={saving || !condition?.name?.trim()}
                            >
                                {saving ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <Save className="mr-2 h-4 w-4" />
                                        Save
                                    </>
                                )}
                            </Button>
                        </div>
                    )}
                </Breadcrumb>
                
                {/* Header */}
                <div className="mt-2 mb-6">
                    <h1 className="text-2xl font-bold text-gray-900">
                        {isNew ? 'New Substrate Condition' : (condition?.name || 'Substrate Condition')}
                    </h1>
                    <p className="text-sm text-gray-600 mt-1">
                        For substrate: <span className="font-medium text-gray-800">{parentSubstrate?.name || 'Loading...'}</span>
                    </p>
                </div>
                        
                        <Tabs defaultValue="info" className="w-full">
                           <div className="flex items-center justify-between mb-2 relative mt-6">
                             <TabsList className="flex w-auto h-auto p-1 gap-1">
                               <TabsTrigger value="info" className="px-3 py-1.5 text-sm">Info</TabsTrigger>
                               <TabsTrigger value="history" className="px-3 py-1.5 text-sm">History</TabsTrigger>
                             </TabsList>
                             <div className="flex items-center gap-4">
                               {infoCardEditMode && (
                                 <DropdownMenu>
                                   <DropdownMenuTrigger asChild>
                                     <Button variant="outline" size="sm">
                                       <Upload className="mr-2 h-4 w-4" />
                                       Import Measurement
                                       <ChevronDown className="ml-2 h-4 w-4" />
                                     </Button>
                                   </DropdownMenuTrigger>
                                   <DropdownMenuContent>
                                      <DropdownMenuItem onClick={handleCxfImportClick} disabled={!canEdit}>
                                        <Plus className="mr-2 h-4 w-4" />
                                        CxF File
                                      </DropdownMenuItem>
                                     <DropdownMenuItem onClick={() => {
                                       cgatsInputRef.current?.click();
                                     }}>
                                       <Plus className="mr-2 h-4 w-4" />
                                       CGATS File
                                     </DropdownMenuItem>
                                   </DropdownMenuContent>
                                 </DropdownMenu>
                               )}
                                 <ColorSettingsBox 
                                   controls={measurementControls}
                                   setControls={handleMeasurementControlsChange}
                                   organizationDefaults={organization}
                                   standards={standards}
                                   availableModes={condition?.measurement_settings?.available_modes || []}
                                 />
                             </div>
                           </div>
                            
                             <TabsContent value="info" className="mt-0 space-y-6">
                                   <SubstrateConditionDebugPanel 
                                     conditionId={conditionId}
                                     onDataRefresh={() => fetchData(substrateId, conditionId)}
                                   />
                                   <Card className="bg-card border shadow-sm">
                                      <CardContent className="p-6">
                                         <SubstrateConditionInfoTab
                                        key={`info-tab-${condition?.id || 'new'}-${condition?.spectral_data ? 'with-data' : 'no-data'}`}
                                        condition={condition}
                                        onConditionChange={handleConditionChange}
                                        canEdit={canEdit && isEditMode}
                                        isNew={isNew}
                                        onNameChange={handleNameChange}
                                        onPackTypeChange={handlePackTypeChange}
                                        onMeasurementControlsChange={handleMeasurementControlsChange}
                                        measurementControls={measurementControls}
                                        standards={standards}
                                        allSubstrates={allSubstrates}
                                        parentSubstrate={parentSubstrate}
                                          constructionDetails={constructionDetails}
                                          setConstructionDetails={handleConstructionDetailsChange}
                                          setHasUnsavedChanges={setHasUnsavedChanges}
                                          hasUnsavedChanges={hasUnsavedChanges}
                                          infoCardEditMode={isNew ? true : infoCardEditMode}
                                          onInfoEdit={handleInfoEdit}
                                          onInfoSave={handleInfoSave}
                                          onInfoCancel={handleInfoCancel}
                                          constructionCardEditMode={isNew ? true : constructionCardEditMode}
                                          onConstructionEdit={handleConstructionEdit}
                                          onConstructionSave={handleConstructionSave}
                                          onConstructionCancel={handleConstructionCancel}
                                          />
                                    </CardContent>
                                  </Card>
                           </TabsContent>
                           <TabsContent value="history" className="mt-0">
                                 <Card className="bg-card border shadow-sm">
                                   <CardContent className="p-6">
                                     <HistoryTab assetType="Substrate Condition" assetId={conditionId} />
                                   </CardContent>
                                 </Card>
                           </TabsContent>
                        </Tabs>
                
                <input
                    ref={cgatsInputRef}
                    type="file"
                    accept=".txt,.cgats"
                    onChange={(e) => handleFileChange(e, 'cgats')}
                    className="hidden"
                />

                {/* CxF Parser Client - only render when needed */}
                {showCxfParser && (
                    <div ref={cxfParserRef}>
                        <CxfParserClient
                            onDataUpdate={updateConditionWithParsedData}
                            onDialogOpen={setCxfDialogOpen}
                            onColorsUpdate={setCxfColors}
                        />
                    </div>
                )}

                {/* CxF Import Dialog */}
                {cxfColors && cxfColors.length > 0 && (
                    <CxfImportDialogWrapper
                        isOpen={cxfDialogOpen}
                        onClose={() => {
                            setCxfDialogOpen(false);
                        setCxfColors([]);
                        setShowCxfParser(false);
                        }}
                        colors={cxfColors}
                        context="substrate-condition"
                        onImport={handleImportFromCxfSelection}
                        title="Select CxF Object for Substrate Condition"
                    />
                )}

                {/* CGATS Import Dialog */}
                {cgatsColors && cgatsColors.length > 0 && (
                    <CxfImportDialogWrapper
                        isOpen={cgatsDialogOpen}
                        onClose={() => {
                            setCgatsDialogOpen(false);
                            setCgatsColors([]);
                        }}
                        colors={normalizeCgatsForDialog(cgatsColors)}
                        context="substrate-condition"
                        onImport={handleImportFromCgatsSelection}
                        title="Select CGATS Object for Substrate Condition"
                    />
                )}
            </motion.div>
        </>
    );
};

export default SubstrateConditionDetail;