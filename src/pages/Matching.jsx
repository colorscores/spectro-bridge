import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { debug } from '@/lib/debugUtils';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { UploadCloud } from 'lucide-react';
import { deltaE2000 } from '@/lib/deltaE';
import { extractMeasurementSettingsFromRules } from '@/lib/qualitySetUtils';
import MatchingHeader from '@/components/matching/MatchingHeader';
import ActionToolbar from '@/components/matching/ActionToolbar';
import DetailsSidebar from '@/components/matching/DetailsSidebar';
import LoadingSkeleton from '@/components/matching/LoadingSkeleton';
import ProgressiveMatchingView from '@/components/matching/ProgressiveMatchingView';
import MatchingErrorBoundary from '@/components/matching/MatchingErrorBoundary';
import { useOptimizedMatchData } from '@/hooks/useOptimizedMatchData';
import ImportMatchDialog from '@/components/ImportMatchDialog';
import ShareMatchDialog from '@/components/ShareMatchDialog';
import CxfImportDialogWrapper from '@/components/cxf/CxfImportDialogWrapper';
import CxfAddColorDialog from '@/components/colors/CxfAddColorDialog';
import LargeFileWarningDialog from '@/components/colors/LargeFileWarningDialog';
import { Suspense } from 'react';
import { useCxfParser } from '@/hooks/useCxfParser';
import { useCgatsImport } from '@/hooks/useCgatsImport';
import { useQueryClient } from '@tanstack/react-query';
import { useProfile } from '@/context/ProfileContext';
import InkConditionPickerDialog from '@/components/matching/InkConditionPickerDialog';
import RouteMatchDialog from '@/components/matching/RouteMatchDialog';
import PrintColorCardPanel from '@/components/matching/PrintColorCardPanel';
// Removed hexToLab import - only authentic colorimetric data should be used
import ColorSettingsBox from '@/components/ColorSettingsBox';
import { useMatchStatusUpdater } from '@/hooks/useMatchStatusUpdater';
import { useEffect as useStandardsEffect, useState as useStandardsState } from 'react';
import { shouldShowMeasureImportForOrg } from '@/lib/matchStatusUtils.jsx';
import { getTintPercentage } from '@/lib/tintsUtils';

// Helper function to extract spectral data from match object
const extractSpectralDataFromMatch = (match) => {
  // Try direct spectral_data
  if (match?.spectral_data || match?.spectralData) {
    return match.spectral_data || match.spectralData;
  }
  
  // Try tints arrays - prioritize adapted, then imported, then generic tints
  const tintsArrays = [
    match?.adapted_tints,
    match?.imported_tints, 
    match?.tints
  ].filter(Boolean);
  
  for (const tints of tintsArrays) {
    if (Array.isArray(tints) && tints.length > 0) {
      // Look for 100% tint first - USE getTintPercentage for robust detection
      const solidTint = tints.find(t => getTintPercentage(t) === 100);
      
      if (solidTint?.spectral_data || solidTint?.spectralData) {
        return solidTint.spectral_data || solidTint.spectralData;
      }
      
      // Fallback to highest percentage tint
      const sortedTints = [...tints].sort((a, b) => {
        return getTintPercentage(b) - getTintPercentage(a);
      });
      
      const highestTint = sortedTints[0];
      if (highestTint?.spectral_data || highestTint?.spectralData) {
        return highestTint.spectral_data || highestTint.spectralData;
      }
    }
  }
  
  return null;
};

const ColorPanel = ({ title, color, isMaster = false }) => (
  <Card className={`h-full flex flex-col overflow-hidden ${isMaster ? 'rounded-r-none' : 'rounded-l-none'}`}>
    <CardHeader>
      <CardTitle>{title}</CardTitle>
    </CardHeader>
    <CardContent className="flex-grow flex flex-col justify-between p-0">
      <div className="flex-grow p-6 flex flex-col justify-between" style={{ backgroundColor: color?.colorHex || color?.hex || '#f0f0f0' }}>
        <div>
          <p className="font-bold text-lg text-white text-shadow-sm">{color?.name || 'No color selected'}</p>
        </div>
        <p className="text-white text-shadow-sm self-end">
          {(() => {
            const labSource = isMaster ? (color?.reference_lab ?? color?.lab) : color?.lab;
            let L, a, b;
            
            // Try to get Lab from labSource first
            if (labSource) {
              const lab = labSource;
              if (typeof lab === 'string') {
                const nums = lab.match(/-?\d+(?:\.\d+)?/g);
                if (nums && nums.length >= 3) {
                  [L, a, b] = nums.slice(0, 3).map(Number);
                }
              } else if (Array.isArray(lab)) {
                [L, a, b] = [lab[0], lab[1], lab[2]];
              } else if (typeof lab === 'object') {
                L = lab.L ?? lab.l;
                a = lab.a ?? lab.A;
                b = lab.b ?? lab.B;
              }
            }
            
            // Fallback to individual lab_l, lab_a, lab_b properties
            if ((L == null || a == null || b == null || 
                Number.isNaN(Number(L)) || Number.isNaN(Number(a)) || Number.isNaN(Number(b))) &&
                color?.lab_l != null && color?.lab_a != null && color?.lab_b != null) {
              L = color.lab_l;
              a = color.lab_a;
              b = color.lab_b;
            }
            
            if (
              L == null || a == null || b == null ||
              Number.isNaN(Number(L)) || Number.isNaN(Number(a)) || Number.isNaN(Number(b))
            ) return '';
            return `Lab: ${Number(L).toFixed(1)}, ${Number(a).toFixed(1)}, ${Number(b).toFixed(1)}`;
          })()}
        </p>
      </div>
    </CardContent>
  </Card>
);

const Matching = () => {
  const { matchId, colorId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const { profile } = useProfile();
  const {
    updating,
    updateMatchStatus,
    approveMatch,
    rejectMatch,
    sendForApproval,
    saveMatch,
    sendToRequestor,
    rematchBySharedWith,
    rematchByRoutedTo,
    setMatchState
  } = useMatchStatusUpdater();
  
  // Safety guard: redirect if colorId is missing or 'undefined'
  useEffect(() => {
    if (!colorId || colorId === 'undefined') {
      console.warn('[Matching] Invalid colorId detected, redirecting to match list');
      navigate(`/color-matches/${matchId}`);
      return;
    }
    
    // Validate that colorId is a valid UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(colorId)) {
      console.warn('[Matching] Invalid colorId format detected, redirecting to match list');
      navigate(`/color-matches/${matchId}`);
      return;
    }
  }, [colorId, matchId, navigate]);
  
  // All hooks must be called at the top level, before any early returns
  const [isReactReady, setIsReactReady] = useState(false);
  
  // Check for auto-rematch mode from URL parameters
  const autoRematchMode = searchParams.get('mode') === 'rematch';
  
  const { 
    matchRequest, 
    color, 
    selectedColor, // Use selectedColor with measurements attached
    matchData,
    basicInfo,
    loading, 
    loadedMatch, 
    qualitySet,
    colorMeasurements,
    printConditionDetails,
    handleSaveMatch: optimizedSaveMatch,
    refreshData
  } = useOptimizedMatchData();

  // State for UI interactions
  const [loadedMatchData, setLoadedMatchData] = useState(null);
  const [isSharing, setIsSharing] = useState(false);
  const [pendingAction, setPendingAction] = useState(null); // Store the pending action type
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importedColors, setImportedColors] = useState([]);
  const [activeTab, setActiveTab] = useState('info');

  // One-time guards to prevent tab auto-switch interference
  const didAutoSelectQualityOnMount = React.useRef(false);
  const didAutoSelectQualityOnData = React.useRef(false);

  // Reset flags when navigating to a different match/color
  useEffect(() => {
    didAutoSelectQualityOnMount.current = false;
    didAutoSelectQualityOnData.current = false;
  }, [matchId, colorId]);

  // Initialize import hooks first (these must be called before any early returns)
  const { fileInputRef: cxfFileInputRef, triggerFileInput: handleCxfImportClick, handleFileChange: handleCxfFileChange } = useCxfParser();

  const handleImportSuccess = useCallback((parsedColors) => {
    console.log('🔍 DEBUG - handleImportSuccess called with:', parsedColors?.length, 'colors');
    
    // If called without arguments, it means colors were successfully added - just refresh data
    if (!parsedColors) {
      console.log('🔍 DEBUG - Colors added successfully, refreshing data');
      refreshData();
      return;
    }
    
    if (parsedColors.length === 0) {
      toast({ title: "No colors found", description: "The imported file does not contain any valid color data.", variant: "destructive" });
      return;
    }
    setImportedColors(parsedColors);
    setIsImportDialogOpen(true);
    console.log('🔍 DEBUG - ImportMatchDialog opened with colors:', parsedColors);
  }, [refreshData]);

  const handleFileDrop = useCallback((file) => {
    console.log('🔍 DEBUG - File dropped:', file.name);
    // Create a fake file input event for the CXF parser
    const fakeEvent = {
      target: { files: [file] }
    };
    handleCxfFileChange(fakeEvent, handleImportSuccess);
  }, [handleCxfFileChange, handleImportSuccess]);
  
  // Add debugging wrapper for CxF import click
  const debugHandleCxfImportClick = useCallback(() => {
    console.log('🔍 DEBUG - CxF import clicked');
    handleCxfImportClick();
  }, [handleCxfImportClick]);

  const handlePrintReference = useCallback(() => {
    if (!selectedColor) {
      toast({
        title: "No reference color",
        description: "Reference color not available for printing",
        variant: "destructive"
      });
      return;
    }

    const measurement = selectedColor.measurements?.find(m => m.spectral_data);
    
    if (!measurement?.spectral_data) {
      toast({
        title: "No spectral data",
        description: "Reference color does not have spectral data for printing",
        variant: "destructive"
      });
      return;
    }

    setPrintColorData({
      name: `${selectedColor.name} (Reference)`,
      spectral_data: measurement.spectral_data,
      illuminant: measurement.illuminant || 'D50',
      observer: measurement.observer || '2',
      lab: measurement.lab || selectedColor.reference_lab || selectedColor.lab
    });
    setIsPrintPanelOpen(true);
  }, [selectedColor]);

  const handlePrintMatch = useCallback(() => {
    const match = loadedMatchData || loadedMatch;
    
    if (!match) {
      toast({
        title: "No match data",
        description: "Match data not available for printing",
        variant: "destructive"
      });
      return;
    }

    // Extract spectral data from various possible locations
    const spectralData = extractSpectralDataFromMatch(match);
    
    if (!spectralData) {
      toast({
        title: "No spectral data",
        description: "Match does not have spectral data for printing",
        variant: "destructive"
      });
      return;
    }

    setPrintColorData({
      name: `${match.name || selectedColor?.name || 'Match'} (Match)`,
      spectral_data: spectralData,
      illuminant: match.illuminant || 'D50',
      observer: match.observer || '2',
      lab: match.lab
    });
    setIsPrintPanelOpen(true);
  }, [loadedMatchData, loadedMatch, selectedColor]);
  
  const { 
    fileInputRef: cgatsFileInputRef, 
    handleAddCgatsClick: handleCgatsImportClick, 
    handleFileChange: handleCgatsFileChange,
    isLoading: isCgatsLoading,
    isTransforming: isCgatsTransforming,
    fileMetadata: cgatsFileMetadata,
    showLargeFileWarning: cgatsShowLargeFileWarning,
    processingStage: cgatsProcessingStage
  } = useCgatsImport(handleImportSuccess);
  
  const [isInkPickerOpen, setIsInkPickerOpen] = useState(false);
  const [isRouteDialogOpen, setIsRouteDialogOpen] = useState(false);
  const [isPrintPanelOpen, setIsPrintPanelOpen] = useState(false);
  const [printColorData, setPrintColorData] = useState(null);
  
  // Add state for ColorSettingsBox
  const [measurementControls, setMeasurementControls] = useState({
    mode: 'M1',
    illuminant: 'D50',
    observer: '2',
    table: '5', // Start with table 5 (valid default)
    deltaE: 'dE76'
  });
  
  // Track if user has manually changed measurement controls
  const [userChangedControls, setUserChangedControls] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Calculate available modes from reference color measurements
  const availableModes = useMemo(() => {
    if (!selectedColor?.measurements || selectedColor.measurements.length === 0) {
      return []; // Return empty array to use default modes in ColorSettingsBox
    }
    
    const modes = [...new Set(
      selectedColor.measurements
        .map(m => m.mode || m.measurement_condition || m.condition)
        .filter(mode => mode && ['M0', 'M1', 'M2', 'M3'].includes(mode.toUpperCase()))
        .map(mode => mode.toUpperCase())
    )].sort();
    
    console.log('🔧 Available modes from reference measurements:', modes);
    return modes;
  }, [selectedColor?.measurements]);

  // Update measurement mode if current selection is not available
  useEffect(() => {
    if (availableModes.length > 0 && !availableModes.includes(measurementControls.mode)) {
      const newMode = availableModes.includes('M1') ? 'M1' : availableModes[0];
      setMeasurementControls(prev => ({
        ...prev,
        mode: newMode
      }));
      console.log('🔧 Updated measurement mode to:', newMode);
    }
  }, [availableModes, measurementControls.mode]);
  
  const [standards, setStandards] = useState({
    illuminants: [],
    observers: [],
    astmTables: [],
    loading: true
  });
  
  const [orgDefaults, setOrgDefaults] = useState(null);
  const [astmTablesForCalculation, setAstmTablesForCalculation] = useState([]);
  
  // Fetch organization defaults
  useEffect(() => {
    const fetchOrgDefaults = async () => {
      if (!profile?.organization_id) return;
      
      const { data, error } = await supabase
        .from('organizations')
        .select('default_illuminant, default_observer, default_astm_table')
        .eq('id', profile.organization_id)
        .single();
      
      if (!error && data) {
        setOrgDefaults({
          default_illuminant: data.default_illuminant || 'D50',
          default_observer: data.default_observer || '2',
          default_astm_table: data.default_astm_table || '5'
        });
      }
    };
    
    fetchOrgDefaults();
  }, [profile?.organization_id]);
  
  // Fetch ASTM tables for color calculations
  useEffect(() => {
    const fetchAstmTables = async () => {
      const { data, error } = await supabase
        .from('astm_e308_tables')
        .select('*');
      
      if (!error && data) {
        setAstmTablesForCalculation(data);
      }
    };
    
    fetchAstmTables();
  }, []);
  
  // Fetch standards data for ColorSettingsBox
  useStandardsEffect(() => {
    const fetchStandards = async () => {
      try {
        const [illuminantsResult, observersResult, astmResult] = await Promise.all([
          supabase.from('illuminants').select('id, name, description'),
          supabase.from('observers').select('id, name, description'),
          supabase.from('astm_e308_tables').select('id, table_number, illuminant_name').order('table_number')
        ]);

        setStandards({
          illuminants: illuminantsResult.data || [],
          observers: observersResult.data || [],
          astmTables: astmResult.data || [],
          loading: false
        });

        // Validate table selection after fetching standards
        const availableTables = astmResult.data || [];
        if (availableTables.length > 0) {
          const currentTable = measurementControls.table;
          const isValidTable = availableTables.some(table => 
            table.table_number.toString() === currentTable
          );
          
          if (!isValidTable) {
            // Default to the first available table (usually table 5)
            const defaultTable = availableTables[0]?.table_number?.toString() || '5';
            setMeasurementControls(prev => ({
              ...prev,
              table: defaultTable
            }));
            console.log(`🔧 Invalid table "${currentTable}" corrected to "${defaultTable}"`);
          }
        }
      } catch (error) {
        console.error('Error fetching standards:', error);
        setStandards(prev => ({ ...prev, loading: false }));
      }
    };

    fetchStandards();
  }, []);

  // Determine user role for conditional rendering
  const isSharedWith = profile?.organization_id === matchRequest?.shared_with_org_id;
  const isRoutedTo = profile?.organization_id === matchRequest?.routed_to_org_id;

  // Extract quality set measurement defaults for ColorSettingsBox
  const qualitySetDefaults = useMemo(() => {
    if (!qualitySet) return null;

    console.log('🔍 DEBUG qualitySet full object:', qualitySet);
    
    // First, try to use existing measurement_settings if available
    if (qualitySet.measurement_settings) {
      console.log('🔍 DEBUG qualitySet measurement_settings found:', qualitySet.measurement_settings);
      
      // Map quality set settings to ColorSettingsBox format, handling type coercion
      const defaults = {
        mode: qualitySet.measurement_settings.mode,
        illuminant: qualitySet.measurement_settings.illuminant,
        observer: String(qualitySet.measurement_settings.observer || 2), // Ensure string
        table: String(qualitySet.measurement_settings.table || 5), // Ensure string
        deltaE: (() => {
          // Standardize deltaE tokens - map quality set formats to consistent tokens
          const qsMethod = qualitySet.measurement_settings.deltaE || qualitySet.measurement_settings.delta_e_method;
          const mappings = {
            'dE00': 'dE00',        // Keep dE00 as-is (matches deltaEMethods.js)
            'CIEDE2000': 'dE00',   // Map standard name to dE00
            'CIE2000': 'dE00',     // Alternative name
            'dE76': 'dE76',
            'CIE76': 'dE76',       // Alternative name
            'dE94': 'dE94',
            'CIE94': 'dE94',       // Alternative name
            'dECMC2:1': 'dECMC2:1',
            'dECMC1:1': 'dECMC1:1'
          };
          return mappings[qsMethod] || qsMethod || 'dE76';
        })()
      };
      
      console.log('🔍 DEBUG qualitySetDefaults from measurement_settings:', defaults);
      return defaults;
    }
    
    // Fallback: Extract measurement settings from quality rules
    console.log('🔍 DEBUG measurement_settings is null, extracting from quality rules');
    const extractedSettings = extractMeasurementSettingsFromRules(qualitySet);
    
    if (extractedSettings) {
      console.log('🔍 DEBUG qualitySetDefaults from quality rules:', extractedSettings);
      return extractedSettings;
    }
    
    console.log('🔍 DEBUG No quality set defaults available');
    return null;
  }, [qualitySet?.measurement_settings, qualitySet?.rules]);

  // Initialize measurement controls from quality set defaults when available
  useEffect(() => {
    // Only auto-configure if user hasn't manually changed controls and not already initialized
    if (qualitySetDefaults && Object.keys(qualitySetDefaults).length > 0 && !userChangedControls && !isInitialized) {
      console.log('🔧 Auto-configuring measurement controls from quality set:', qualitySetDefaults);
      console.log('🔧 Previous controls:', measurementControls);
      
      // Only update if availableModes is empty OR the quality set mode is available
      const shouldUpdateMode = availableModes.length === 0 || availableModes.includes(qualitySetDefaults.mode);
      
      setMeasurementControls({
        mode: shouldUpdateMode ? qualitySetDefaults.mode : (availableModes.length > 0 ? (availableModes.includes('M1') ? 'M1' : availableModes[0]) : 'M1'),
        illuminant: qualitySetDefaults.illuminant,
        observer: qualitySetDefaults.observer,
        table: qualitySetDefaults.table,
        deltaE: qualitySetDefaults.deltaE
      });
      
      setIsInitialized(true);
      
      if (!shouldUpdateMode) {
        console.warn('🔧 Quality set mode not available, using fallback mode');
      }
    }
  }, [qualitySetDefaults, availableModes, userChangedControls, isInitialized, measurementControls]);

  useEffect(() => {
    setIsReactReady(true);
  }, []);

  // Set default tab to "quality" when match data already exists,
  // but only once on mount and once when data first appears.
  useEffect(() => {
    // One-time on initial mount per match/color
    if (!didAutoSelectQualityOnMount.current) {
      didAutoSelectQualityOnMount.current = true;
      if (activeTab === 'info') {
        const hasAnyMatchData = !!(
          matchData?.hasMatchData ||
          loadedMatch?.hasActualData ||
          (loadedMatch?.lab && (loadedMatch.lab.L != null || loadedMatch.lab.l != null)) ||
          loadedMatch?.hex ||
          loadedMatch?.spectral_data
        );
        if (hasAnyMatchData) {
          setActiveTab('quality');
          // Consider the data event satisfied if we had data at mount
          didAutoSelectQualityOnData.current = true;
        }
      }
    }

    // One-time when match data first becomes available from empty
    if (!didAutoSelectQualityOnData.current && matchData?.hasMatchData) {
      if (activeTab === 'info') {
        setActiveTab('quality');
      }
      didAutoSelectQualityOnData.current = true;
    }
  }, [matchData?.hasMatchData]);

  // Debug: derive isRequestor and log key values (must be before any early returns)
  const isRequestor = profile?.organization_id && matchRequest?.organization_id
    ? profile.organization_id === matchRequest.organization_id
    : undefined;

  // Stabilized loading condition - only show skeleton for true loading states
  const isInitialLoading = !isReactReady || (loading && !basicInfo && !matchData);
  const hasMinimumData = matchRequest && (selectedColor || colorMeasurements?.length > 0);

  // Auto-trigger rematch state when entering in rematch mode
  useEffect(() => {
    if (autoRematchMode && hasMinimumData && (isSharedWith || isRoutedTo)) {
      // Auto-trigger rematch for the appropriate role
      const triggerRematch = async () => {
        try {
          // Wait for matchData to be available to get the measurement ID
          if (!matchData?.matchMeasurement?.id) {
            console.warn('🔄 Waiting for match measurement ID...');
            return;
          }

          const measurementId = matchData.matchMeasurement.id;
          
          if (isRoutedTo) {
            await rematchByRoutedTo(measurementId, () => {
              // Optimistically update cache to reflect rematch state
              queryClient.setQueryData(['match-request-details', matchId], (prev) => {
                if (!prev) return prev;
                const updated = {
                  ...prev,
                  colors: (prev.colors || []).map((c) => {
                    const cid = c?.id ?? c?.color_id;
                    if (cid === colorId) {
                      const nextState = 'rematch-by-routed-to';
                      return {
                        ...c,
                        match_measurement_state: nextState,
                        match_measurement: {
                          ...(c.match_measurement || {}),
                          match_measurement_state: nextState,
                        },
                      };
                    }
                    return c;
                  }),
                };
                console.info('[Matching] Auto-rematch cache updated for rematch-by-routed-to', { colorId });
                return updated;
              });
              refreshData();
            });
            console.log('🔄 Auto-triggered rematch by routed-to');
          } else if (isSharedWith) {
            await rematchBySharedWith(measurementId, () => {
              // Optimistically update cache to reflect rematch state
              queryClient.setQueryData(['match-request-details', matchId], (prev) => {
                if (!prev) return prev;
                const updated = {
                  ...prev,
                  colors: (prev.colors || []).map((c) => {
                    const cid = c?.id ?? c?.color_id;
                    if (cid === colorId) {
                      const nextState = 'rematch-by-shared-with';
                      return {
                        ...c,
                        match_measurement_state: nextState,
                        match_measurement: {
                          ...(c.match_measurement || {}),
                          match_measurement_state: nextState,
                        },
                      };
                    }
                    return c;
                  }),
                };
                console.info('[Matching] Auto-rematch cache updated for rematch-by-shared-with', { colorId });
                return updated;
              });
              refreshData();
            });
            console.log('🔄 Auto-triggered rematch by shared-with');
          }
          // Clear the mode parameter from URL after triggering rematch
          navigate(`/color-matches/${matchId}/matching/${colorId}`, { replace: true });
        } catch (error) {
          console.error('❌ Auto-rematch failed:', error);
        }
      };
      
      triggerRematch();
    }
  }, [autoRematchMode, hasMinimumData, isSharedWith, isRoutedTo, matchId, colorId, rematchByRoutedTo, rematchBySharedWith, navigate]);

  const isValidLab = (lab) => {
    if (!lab) return false;
    if (typeof lab === 'string') {
      const nums = lab.match(/-?\d+(?:\.\d+)?/g);
      return !!(nums && nums.length >= 3);
    }
    if (Array.isArray(lab)) return lab.length >= 3 && lab.every(v => v != null && !Number.isNaN(Number(v)));
    if (typeof lab === 'object') return lab.L != null && lab.a != null && lab.b != null;
    return false;
  };

// Old helper functions - now replaced by optimized hook implementation

  useEffect(() => {
    console.log('Matching - role/status', {
      profileOrg: profile?.organization_id,
      requestOrg: matchRequest?.organization_id,
      isRequestor,
      loadedStatus: loadedMatch?.status,
      jobId: matchRequest?.job_id,
      matchId,
      colorId,
    });
  }, [profile?.organization_id, matchRequest?.organization_id, isRequestor, loadedMatch?.status, matchRequest?.job_id, matchId, colorId]);
  
  if (isInitialLoading) {
    return <LoadingSkeleton />;
  }

  // Show error state if we have match request but no color data at all
  if (matchRequest && !selectedColor && (!colorMeasurements || colorMeasurements.length === 0)) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-4">Color Data Not Available</h2>
          <p className="text-gray-600 mb-4">
            Unable to load the reference color for this match request. This may be due to access restrictions.
          </p>
          <Button onClick={refreshData} variant="outline">
            Retry Loading
          </Button>
        </div>
      </div>
    );
  }

  if (!hasMinimumData) {
    return <LoadingSkeleton />;
  }

  const handleColorSelectFromImport = (selectedImportedColor) => {
    console.log('🔍 DEBUG - handleColorSelectFromImport received:', {
      name: selectedImportedColor.name,
      hex: selectedImportedColor.hex,
      colorHex: selectedImportedColor.colorHex,
      displayHex: selectedImportedColor.displayHex,
      spectralData: selectedImportedColor.spectral_data || selectedImportedColor.spectralData,
      measurements: selectedImportedColor.measurements?.length || 0
    });
    
    // Ensure hex/colorHex are present, preferring displayHex if others are missing
    const colorData = {
      ...selectedImportedColor,
      name: selectedImportedColor.matchName || selectedImportedColor.name,
      hex: selectedImportedColor.hex || selectedImportedColor.colorHex || selectedImportedColor.displayHex,
      colorHex: selectedImportedColor.colorHex || selectedImportedColor.hex || selectedImportedColor.displayHex,
      status: loadedMatch?.status, // Preserve existing status
      match_measurement_state: loadedMatch?.match_measurement_state // Preserve existing state
    };
    
    console.log('🔍 DEBUG - Setting loadedMatchData to:', colorData);
    setLoadedMatchData(colorData);
    setIsImportDialogOpen(false);
    setActiveTab('quality'); // Switch to Match Quality tab after import
    toast({ title: "✅ Color Imported", description: `${selectedImportedColor.matchName || selectedImportedColor.name} has been loaded as a match.` });
  };

  const handleInkConditionPicked = (picked) => {
    // Extract active_data_mode (prefer value from picker, then ui_state/measurement_settings)
    const activeDataMode = picked.active_data_mode ||
                           picked.ui_state?.active_data_mode || 
                           picked.measurement_settings?.preferred_data_mode || 
                           'imported';
    
    console.log('🎯 Phase 1 - Setting active_data_mode:', activeDataMode, 'from ink condition:', picked.name);
    
    setLoadedMatchData({ 
      ...picked, 
      active_data_mode: activeDataMode, // Explicitly set active_data_mode
      status: loadedMatch?.status, // Preserve existing status
      match_measurement_state: loadedMatch?.match_measurement_state // Preserve existing state
    });
    setActiveTab('quality'); // Switch to Match Quality tab after import
    toast({ title: "✅ Ink Condition Loaded", description: `${picked.name} has been loaded as a match.` });
  };

  const handleRouteMatch = () => {
    setIsRouteDialogOpen(true);
  };

  const handleMatchRouted = (routingData) => {
    // Refresh data after successful routing
    queryClient.invalidateQueries({ queryKey: ['match-requests'] });
    refreshData();
  };
  
  const handleSaveMatch = async () => {
    const matchToSave = loadedMatchData || loadedMatch;
    if (!matchToSave) return;
    
    await optimizedSaveMatch(matchToSave);
    setLoadedMatchData(null); // Clear temporary match data after saving
  };

  const handleSendForApproval = async () => {
    const matchToSendForApproval = loadedMatchData || loadedMatch;
    if (!matchToSendForApproval) {
      toast({ 
        title: 'Error', 
        description: 'No match data available to send for approval', 
        variant: 'destructive' 
      });
      return;
    }

    try {
      // First save any pending match data
      if (loadedMatchData) {
        await optimizedSaveMatch(loadedMatchData);
        setLoadedMatchData(null);
      }

      // Use the measurement ID from match data, with fallback lookup
      let measurementId = matchData?.matchMeasurement?.id;

      if (!measurementId) {
        console.warn('[Matching] No measurementId in matchData; attempting lookup');
        const { data: measurements, error } = await supabase
          .from('match_measurements')
          .select('id')
          .eq('match_request_id', matchId)
          .eq('color_id', colorId)
          .order('created_at', { ascending: false })
          .limit(1);
        
        if (error) {
          console.error('[Matching] Lookup measurementId failed', error);
          toast({ title: 'Error', description: 'Failed to locate measurement ID', variant: 'destructive' });
          return;
        }
        
        measurementId = measurements?.[0]?.id || null;
      }
      
      if (!measurementId) {
        console.error('[Matching] No measurement found', { matchId, colorId, matchData });
        toast({ 
          title: 'Error', 
          description: 'No measurement exists for this color match. Please ensure the match has been saved first.', 
          variant: 'destructive' 
        });
        return;
      }

      console.log('[Matching] Sending for approval with measurementId:', measurementId);

      // Update the status using the status updater hook
      const result = await sendForApproval(measurementId, () => {
        // Comprehensive cache invalidation
        queryClient.invalidateQueries({ queryKey: ['match-request-details', matchId] });
        queryClient.invalidateQueries({ queryKey: ['match-requests'] });
        queryClient.invalidateQueries({ queryKey: ['matching'] });
        queryClient.invalidateQueries({ queryKey: ['color-matches'] });
        refreshData(); // Refresh the optimized match data
      });
      
      if (result.success) {
        setIsSharing(true);
      }
    } catch (error) {
      console.error('Failed to send match for approval:', error);
      toast({
        title: 'Error',
        description: 'Failed to send match for approval. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Generic state setter for header buttons using direct state names
  const handleSetState = async (newState) => {
    try {
      // Save any pending match data before changing state if relevant
      if (loadedMatchData && (newState.startsWith('sent-to-') || newState.startsWith('saved-by-'))) {
        await optimizedSaveMatch(loadedMatchData);
        setLoadedMatchData(null);
      }

      // Resolve measurement id
      let measurementId = matchData?.matchMeasurement?.id;
      if (!measurementId) {
        const { data: measurements, error } = await supabase
          .from('match_measurements')
          .select('id')
          .eq('match_request_id', matchId)
          .eq('color_id', colorId)
          .order('created_at', { ascending: false })
          .limit(1);
        if (error) {
          console.error('[Matching] Lookup measurementId failed', error);
          toast({ title: 'Error', description: 'Failed to locate measurement ID', variant: 'destructive' });
          return;
        }
        measurementId = measurements?.[0]?.id || null;
      }

      if (!measurementId) {
        toast({ title: 'Error', description: 'No measurement exists yet. Please save a match first.', variant: 'destructive' });
        return;
      }

      const result = await setMatchState(measurementId, newState, () => {
        // Invalidate and refresh views
        queryClient.invalidateQueries({ queryKey: ['match-request-details', matchId] });
        queryClient.invalidateQueries({ queryKey: ['match-requests'] });
        queryClient.invalidateQueries({ queryKey: ['matching'] });
        queryClient.invalidateQueries({ queryKey: ['color-matches'] });
        refreshData();
      });

      // Remove automatic dialog showing - now handled by confirmation flow
    } catch (error) {
      console.error('Failed to change state:', error);
      toast({ title: 'Error', description: 'Failed to update state. Please try again.', variant: 'destructive' });
    }
  };

  // New handler for showing share confirmation dialog
  const handleShowShareDialog = (actionType) => {
    setPendingAction(actionType);
    setIsSharing(true);
  };

  const handleConfirmShare = async () => {
    if (!pendingAction) return;
    
    try {
      // First save any pending match data before changing state
      if (loadedMatchData) {
        await optimizedSaveMatch(loadedMatchData);
        setLoadedMatchData(null);
      }
      
      // Get measurement ID with fallback lookup
      let measurementId = matchData?.matchMeasurement?.id;
      if (!measurementId) {
        const { data: measurements, error } = await supabase
          .from('match_measurements')
          .select('id')
          .eq('match_request_id', matchId)
          .eq('color_id', colorId)
          .order('created_at', { ascending: false })
          .limit(1);
        
        if (error) {
          console.error('[Matching] Lookup measurementId failed', error);
          toast({ title: 'Error', description: 'Failed to locate measurement ID', variant: 'destructive' });
          return;
        }
        
        measurementId = measurements?.[0]?.id || null;
      }
      
      if (!measurementId) {
        toast({ title: "Error", description: "No measurement found to update.", variant: "destructive" });
        return;
      }

      // Execute the state change
      await setMatchState(measurementId, pendingAction);
      
      setIsSharing(false);
      setPendingAction(null);
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['match-request-details', matchId] });
      queryClient.invalidateQueries({ queryKey: ['match-requests'] });
      refreshData(); // Refresh the optimized match data
      
      // Navigate back to the matching job details page
      toast({ title: "Success", description: "Match sent for approval successfully" });
      navigate(`/color-matches/${matchId}`);
    } catch (error) {
      console.error('Failed to share match:', error);
      toast({ title: "Error", description: "Failed to share match. Please try again.", variant: "destructive" });
    }
  };

  // Handler for canceling share dialog
  const handleCancelShare = () => {
    setIsSharing(false);
    setPendingAction(null);
  };

  const handleMatchNameChange = (newName) => {
    if (loadedMatchData) {
      setLoadedMatchData(prev => prev ? { ...prev, name: newName } : null);
    }
    // Note: Can't directly modify loadedMatch as it comes from the optimized hook
  };

  const handleSendToRequestor = async () => {
    try {
      // First save any pending match data before sending to requestor
      if (loadedMatchData) {
        await optimizedSaveMatch(loadedMatchData);
        setLoadedMatchData(null);
      }

      // Use the measurement ID from match data, with fallback lookup
      let measurementId = matchData?.matchMeasurement?.id;
      if (!measurementId) {
        const { data: measurements, error } = await supabase
          .from('match_measurements')
          .select('id')
          .eq('match_request_id', matchId)
          .eq('color_id', colorId)
          .order('created_at', { ascending: false })
          .limit(1);
        
        if (error) {
          console.error('[Matching] Lookup measurementId failed', error);
          toast({ title: 'Error', description: 'Failed to locate measurement ID', variant: 'destructive' });
          return;
        }
        
        measurementId = measurements?.[0]?.id || null;
      }
      
      if (!measurementId) {
        console.error('[Matching] No measurement found for send to requestor', { matchId, colorId, matchData });
        toast({ 
          title: 'Error', 
          description: 'No measurement exists for this color match. Please ensure the match has been saved first.', 
          variant: 'destructive' 
        });
        return;
      }

      console.log('[Matching] Sending to requestor:', measurementId);

      await sendToRequestor(measurementId, () => {
        // Comprehensive cache invalidation
        queryClient.invalidateQueries({ queryKey: ['match-request-details', matchId] });
        queryClient.invalidateQueries({ queryKey: ['match-requests'] });
        queryClient.invalidateQueries({ queryKey: ['matching'] });
        queryClient.invalidateQueries({ queryKey: ['color-matches'] });
        refreshData(); // Refresh the optimized match data
      });
    } catch (error) {
      console.error('Failed to send to requestor:', error);
    }
  };

  const handleApprove = async () => {
    try {
      // Do not mutate status before approving to satisfy RLS (must be Sent for Approval)
      // Proceed directly to approval using the latest persisted measurement

      // Use the measurement ID from match data, with fallback lookup
      let measurementId = matchData?.matchMeasurement?.id;
      if (!measurementId) {
        const { data: measurements, error } = await supabase
          .from('match_measurements')
          .select('id')
          .eq('match_request_id', matchId)
          .eq('color_id', colorId)
          .order('created_at', { ascending: false })
          .limit(1);
        
        if (error) {
          console.error('[Matching] Lookup measurementId failed', error);
          toast({ title: 'Error', description: 'Failed to locate measurement ID', variant: 'destructive' });
          return;
        }
        
        measurementId = measurements?.[0]?.id || null;
      }
      
      if (!measurementId) {
        console.error('[Matching] No measurement found for approval', { matchId, colorId, matchData });
        toast({ 
          title: 'Error', 
          description: 'No measurement exists for this color match. Please ensure the match has been saved first.', 
          variant: 'destructive' 
        });
        return;
      }

      console.log('[Matching] Approving measurement:', measurementId);

      await approveMatch(measurementId, () => {
        // Comprehensive cache invalidation
        queryClient.invalidateQueries({ queryKey: ['match-request-details', matchId] });
        queryClient.invalidateQueries({ queryKey: ['match-requests'] });
        queryClient.invalidateQueries({ queryKey: ['matching'] });
        queryClient.invalidateQueries({ queryKey: ['color-matches'] });
        refreshData(); // Refresh the optimized match data
        
        // Navigate back to the job details page
        navigate(`/color-matches/${matchId}`);
      });
    } catch (error) {
      console.error('Failed to approve match:', error);
    }
  };

  const handleReject = async () => {
    try {
      // Use the measurement ID from match data, with fallback lookup
      let measurementId = matchData?.matchMeasurement?.id;
      if (!measurementId) {
        const { data: measurements, error } = await supabase
          .from('match_measurements')
          .select('id')
          .eq('match_request_id', matchId)
          .eq('color_id', colorId)
          .order('created_at', { ascending: false })
          .limit(1);
        
        if (error) {
          console.error('[Matching] Lookup measurementId failed', error);
          toast({ title: 'Error', description: 'Failed to locate measurement ID', variant: 'destructive' });
          return;
        }
        
        measurementId = measurements?.[0]?.id || null;
      }
      
      if (!measurementId) {
        console.error('[Matching] No measurement found for rejection', { matchId, colorId, matchData });
        toast({ 
          title: 'Error', 
          description: 'No measurement exists for this color match.', 
          variant: 'destructive' 
        });
        return;
      }

      console.log('[Matching] Rejecting measurement:', measurementId);

      await rejectMatch(measurementId, () => {
        queryClient.invalidateQueries({ queryKey: ['match-request-details', matchId] });
        queryClient.invalidateQueries({ queryKey: ['match-requests'] });
        refreshData(); // Refresh the optimized match data
        
        // Navigate back to the job details page
        navigate(`/color-matches/${matchId}`);
      });
    } catch (error) {
      console.error('Failed to reject match:', error);
    }
  };

  const handleRematchBySharedWith = async () => {
    try {
      console.log('[Matching] Starting rematch process...', { matchId, colorId, matchData });
      
      // Use the measurement ID from match data, with fallback lookup
      let measurementId = matchData?.matchMeasurement?.id;
      console.log('[Matching] Initial measurementId from matchData:', measurementId);
      
      if (!measurementId) {
        console.log('[Matching] No measurementId found in matchData, trying fallback query...');
        const { data: measurements, error } = await supabase
          .from('match_measurements')
          .select('id, match_measurement_state, status')
          .eq('match_request_id', matchId)
          .eq('color_id', colorId)
          .order('created_at', { ascending: false })
          .limit(1);
        
        console.log('[Matching] Fallback query result:', { measurements, error });
        
        if (error) {
          console.error('[Matching] Lookup measurementId failed', error);
          toast({ title: 'Error', description: 'Failed to locate measurement ID', variant: 'destructive' });
          return;
        }
        
        measurementId = measurements?.[0]?.id || null;
        console.log('[Matching] Fallback measurementId:', measurementId);
      }
      
      if (!measurementId) {
        console.error('[Matching] No measurement found for rematch', { matchId, colorId, matchData });
        toast({ 
          title: 'Error', 
          description: 'No measurement exists for this color match.', 
          variant: 'destructive' 
        });
        return;
      }

      console.log('[Matching] Final measurementId before rematch call:', measurementId);

      const result = await rematchBySharedWith(measurementId, () => {
        // Optimistically update cache to reflect rematch state
        queryClient.setQueryData(['match-request-details', matchId], (prev) => {
          if (!prev) return prev;
          const updated = {
            ...prev,
            colors: (prev.colors || []).map((c) => {
              const cid = c?.id ?? c?.color_id;
              if (cid === colorId) {
                const nextState = 'rematch-by-shared-with';
                return {
                  ...c,
                  match_measurement_state: nextState,
                  match_measurement: {
                    ...(c.match_measurement || {}),
                    match_measurement_state: nextState,
                  },
                };
              }
              return c;
            }),
          };
          console.info('[Matching] Cache updated for rematch-by-shared-with', { colorId });
          return updated;
        });

        queryClient.invalidateQueries({ queryKey: ['match-request-details', matchId] });
        queryClient.invalidateQueries({ queryKey: ['match-requests'] });
        refreshData(); // Refresh the optimized match data
      });

      if (result?.success) {
        // Clear local match state to force fresh import
        setLoadedMatchData(null);
        toast({
          title: 'Match Discarded',
          description: 'Previous match data has been discarded. Please import a new match.',
          variant: 'default'
        });
      }
    } catch (error) {
      console.error('Failed to start rematch:', error);
    }
  };

  const handleRematchByRoutedTo = async () => {
    try {
      // Use the measurement ID from match data, with fallback lookup
      let measurementId = matchData?.matchMeasurement?.id;
      if (!measurementId) {
        const { data: measurements, error } = await supabase
          .from('match_measurements')
          .select('id')
          .eq('match_request_id', matchId)
          .eq('color_id', colorId)
          .order('created_at', { ascending: false })
          .limit(1);
        
        if (error) {
          console.error('[Matching] Lookup measurementId failed', error);
          toast({ title: 'Error', description: 'Failed to locate measurement ID', variant: 'destructive' });
          return;
        }
        
        measurementId = measurements?.[0]?.id || null;
      }
      
      if (!measurementId) {
        console.error('[Matching] No measurement found for rematch', { matchId, colorId, matchData });
        toast({ 
          title: 'Error', 
          description: 'No measurement exists for this color match.', 
          variant: 'destructive' 
        });
        return;
      }

      console.log('[Matching] Starting rematch by routed-to:', measurementId);

      const result = await rematchByRoutedTo(measurementId, () => {
        // Optimistically update cache to reflect rematch state
        queryClient.setQueryData(['match-request-details', matchId], (prev) => {
          if (!prev) return prev;
          const updated = {
            ...prev,
            colors: (prev.colors || []).map((c) => {
              const cid = c?.id ?? c?.color_id;
              if (cid === colorId) {
                const nextState = 'rematch-by-routed-to';
                return {
                  ...c,
                  match_measurement_state: nextState,
                  match_measurement: {
                    ...(c.match_measurement || {}),
                    match_measurement_state: nextState,
                  },
                };
              }
              return c;
            }),
          };
          console.info('[Matching] Cache updated for rematch-by-routed-to', { colorId });
          return updated;
        });

        queryClient.invalidateQueries({ queryKey: ['match-request-details', matchId] });
        queryClient.invalidateQueries({ queryKey: ['match-requests'] });
        refreshData(); // Refresh the optimized match data
      });

      if (result?.success) {
        // Clear local match state to force fresh import
        setLoadedMatchData(null);
        toast({
          title: 'Match Discarded',
          description: 'Previous match data has been discarded. Please import a new match.',
          variant: 'default'
        });
      }
    } catch (error) {
      console.error('Failed to start rematch:', error);
    }
  };

  return (
    <MatchingErrorBoundary onRetry={refreshData}>
      <Helmet><title>Matching: {selectedColor.name} - Spectral</title></Helmet>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="flex flex-col h-full min-h-0"
      >
         <MatchingHeader
          breadcrumbItems={[
            { label: 'Matching Jobs', href: '/color-matches' },
            { label: `Job: ${matchRequest.job_id}`, href: `/color-matches/${matchId}` },
            { label: selectedColor?.name || 'Color' }
          ]}
          jobId={matchRequest.job_id}
          onSave={handleSaveMatch}
          onSendForApproval={handleSendForApproval}
          onSendToRequestor={handleSendToRequestor}
          isActionDisabled={(() => {
            const match = loadedMatchData || loadedMatch || matchData?.matchMeasurement;
            
            // If updating, disable all actions
            if (updating) return true;
            
            // If no match object exists at all, disable
            if (!match) {
              console.log('🔴 isActionDisabled: No match object found');
              return true;
            }
            
            // Check if we're in rematch state waiting for new data
            const isInRematchState = match.match_measurement_state === 'rematch-by-shared-with' || 
                                    match.match_measurement_state === 'rematch-by-routed-to';
            
            // If in rematch state and no new data has been loaded, disable buttons
            if (isInRematchState && !loadedMatchData) {
              console.log('🔴 isActionDisabled: In rematch state, waiting for new match data');
              return true;
            }
            
            // Check if match data is actually loaded (has spectral/lab/hex data)
            const hasMatchData = !!(
              match.spectral_data ||
              match.lab ||
              match.hex ||
              (match.lab_l != null && match.lab_a != null && match.lab_b != null) ||
              loadedMatchData // If user has loaded new match data
            );
            
            if (!hasMatchData) {
              console.log('🔴 isActionDisabled: No match data loaded');
              return true;
            }
            
            // Simple logic: if match data is loaded, enable the button
            console.debug('🔍 [isActionDisabled] Match data loaded, enabling buttons for match:', match.id);
            return false; // Enable buttons when match data is loaded
          })()}
          loadedMatch={(() => {
            const match = loadedMatchData || loadedMatch || matchData?.matchMeasurement;
            // Debug logging to verify state is preserved
            if (match && selectedColor?.name && (selectedColor.name.includes('PANTONE 3551') || selectedColor.name.includes('PANTONE 3553'))) {
              console.log(`MatchingHeader state for ${selectedColor.name}:`, {
                match_measurement_state: match.match_measurement_state,
                status: match.status,
                source: loadedMatchData ? 'loadedMatchData' : loadedMatch ? 'loadedMatch' : 'matchMeasurement'
              });
            }
            return match;
          })()}
          onApprove={handleApprove}
          onReject={handleReject}
          onRematchBySharedWith={handleRematchBySharedWith}
          onRematchByRoutedTo={handleRematchByRoutedTo}
          onSetState={handleSetState}
          onShowShareDialog={handleShowShareDialog}
          matchRequest={matchRequest}
          userOrgId={profile?.organization_id}
          matchName={loadedMatchData?.name || loadedMatch?.name || selectedColor?.name || 'Match'}
        />
        <main className="flex-grow p-6 flex flex-col gap-4 bg-gray-100 h-full min-h-0">
          <div className="w-full flex justify-between items-center gap-4">
            {(() => {
              const measurementState = loadedMatch?.match_measurement_state;
              const showMeasureImport = shouldShowMeasureImportForOrg(
                matchRequest,
                loadedMatch,
                profile?.organization_id,
                profile?.organization?.name
              );
              return (
                <ActionToolbar 
                  onCxfImportClick={debugHandleCxfImportClick} 
                  onCgatsImportClick={handleCgatsImportClick} 
                  onPickInkCondition={() => setIsInkPickerOpen(true)}
                  onRouteMatch={handleRouteMatch}
                  onPrintReference={handlePrintReference}
                  onPrintMatch={handlePrintMatch}
                  showRouteMatch={isSharedWith && measurementState !== 'routed-by-shared-with'}
                  showMeasureImport={showMeasureImport}
                />
              );
            })()}
            <ColorSettingsBox 
              controls={measurementControls}
              setControls={(newControls) => {
                setMeasurementControls(newControls);
                setUserChangedControls(true);
              }}
              standards={standards}
              organizationDefaults={profile?.organization_defaults}
              qualitySetDefaults={qualitySetDefaults}
              availableModes={availableModes}
              measurementLoaded={!!selectedColor}
              onReset={() => {
                setUserChangedControls(false);
                setIsInitialized(false);
              }}
              className="flex-shrink-0"
            />
            <input type="file" ref={cxfFileInputRef} onChange={(e) => handleCxfFileChange(e, handleImportSuccess)} className="hidden" accept=".cxf,.xml" />
            <input type="file" ref={cgatsFileInputRef} onChange={handleCgatsFileChange} className="hidden" accept=".cgats,.txt" />
          </div>
          {(() => {
            try {
              const params = new URLSearchParams(window.location.search);
              if (params.get('debug') === '1') {
                const rawState = matchData?.matchMeasurement?.match_measurement_state || '(none)';
                const rawStatus = matchData?.matchMeasurement?.status || '(unknown)';
                return (
                  <div className="text-xs text-gray-500">
                    Debug match state: {rawState} | status: {rawStatus}
                  </div>
                );
              }
            } catch {}
            return null;
          })()}
          <div className="flex gap-8 h-full min-h-0 overflow-hidden">
            <div className="w-2/3 flex flex-col">
              <ProgressiveMatchingView
                matchData={matchData}
                basicInfo={basicInfo}
                loadedMatch={loadedMatch}
                loadedMatchData={loadedMatchData}
                loading={loading}
                onImportClick={debugHandleCxfImportClick}
                onFileDrop={handleFileDrop}
                measurementControls={measurementControls}
                orgDefaults={orgDefaults}
                astmTables={astmTablesForCalculation}
              />
            </div>
            <div className="w-1/3 flex-shrink-0 h-full min-h-0">
        <DetailsSidebar
          selectedColor={selectedColor}
          loadedMatch={loadedMatchData || loadedMatch}
          matchMeasurement={matchData?.matchMeasurement}
          onSave={handleSaveMatch}
          disabled={!hasMinimumData || updating}
          matchId={matchId}
          colorId={colorId}
          matchRequest={matchRequest}
          qualitySet={matchData?.qualitySet}
          onMatchNameChange={handleMatchNameChange}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          colorMeasurements={matchData?.colorMeasurements || []}
          printConditionDetails={printConditionDetails}
          measurementControls={measurementControls}
          astmTables={astmTablesForCalculation}
        />
            </div>
          </div>
        </main>
      </motion.div>
      <ImportMatchDialog
        isOpen={isImportDialogOpen}
        setIsOpen={setIsImportDialogOpen}
        importedColors={importedColors}
        onColorSelect={handleColorSelectFromImport}
        qualitySet={qualitySet}
        qualitySetDefaults={qualitySetDefaults}
      />
      <InkConditionPickerDialog
        isOpen={isInkPickerOpen}
        setIsOpen={setIsInkPickerOpen}
        onSelect={handleInkConditionPicked}
        referenceColor={selectedColor}
        matchPrintCondition={printConditionDetails}
        qualitySet={matchData?.qualitySet}
        measurementControls={measurementControls}
      />
      
      <RouteMatchDialog
        open={isRouteDialogOpen}
        onOpenChange={setIsRouteDialogOpen}
        matchRequest={matchRequest}
        onRouted={handleMatchRouted}
      />

      <PrintColorCardPanel
        isOpen={isPrintPanelOpen}
        onClose={() => {
          setIsPrintPanelOpen(false);
          setPrintColorData(null);
        }}
        colorData={printColorData}
      />
      
      <ShareMatchDialog 
        isOpen={isSharing} 
        setIsOpen={handleCancelShare} 
        onConfirm={handleConfirmShare}
        partnerName={matchRequest?.initial_receiver_organization_name || matchRequest?.shared_with || 'the partner organization'}
        requestorOrgName={matchRequest?.requestor_organization_name || matchRequest?.organization_name || 'the requestor organization'}
        actionType={pendingAction}
        isRequestor={profile?.organization_id === matchRequest?.organization_id}
      />
      
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
      
    </MatchingErrorBoundary>
  );
};

export default Matching;
