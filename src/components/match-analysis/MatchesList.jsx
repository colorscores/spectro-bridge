
import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { getColorMatchStatusForOrg, getColorMatchButtonsForOrg } from '@/lib/matchStatusUtils.jsx';
import { calculateDeltaE } from '@/lib/deltaE';
import { useMatchStatusUpdater } from '@/hooks/useMatchStatusUpdater';
import { useProfile } from '@/context/ProfileContext';
import { DELTA_E_METHODS } from '@/lib/constants/deltaEMethods';
import MatchesFilterPopup from './MatchesFilterPopup';
import { supabase } from '@/lib/customSupabaseClient';
import { normalizeMode as normalizeModeFn, getModeFromMeasurement } from '@/lib/utils/colorMeasurementSelection';
import { isValidDisplayColor } from '@/lib/colorUtils';
import { calculateQualityAssessment, getPrimaryQualityResult } from '@/lib/qualityAssessment';
import { computeDynamicDisplayColor } from '@/lib/objectSpecificColorCalculation';
import { resolveActiveDataMode } from '@/lib/colorUtils/resolveActiveDataMode';
import { Badge } from '@/components/ui/badge';

// Helper function to get Delta E method label
const getDeltaEMethodLabel = (method) => {
  const deltaEMethod = DELTA_E_METHODS.find(m => m.value === method);
  return deltaEMethod ? deltaEMethod.label : method || 'dE76';
};

// Helper function to extract spectral data based on active data mode
const getSpectralForMatchMode = (match, dataMode) => {
  const mcd = match.matched_color_data;
  if (!mcd) return null;
  
  if (dataMode === 'adapted' && mcd.substrateTints?.length) {
    // Find the 100% tint for adapted data
    const fullTint = mcd.substrateTints.find(t => t.tintPercentage === 100);
    if (fullTint?.spectralData) return fullTint.spectralData;
    
    // Fallback to measurements array for adapted data
    const adaptedMeasurement = mcd.measurements?.find(m => 
      m.data_mode === 'adapted' || m.source?.includes('adapted')
    );
    if (adaptedMeasurement?.spectral_data) return adaptedMeasurement.spectral_data;
  }
  
  // For imported mode or fallback
  if (mcd.spectralData) return mcd.spectralData;
  if (mcd.measurements?.[0]?.spectral_data) return mcd.measurements[0].spectral_data;
  
  return match.spectral_data || null;
};

// Memoized MatchCard component for better performance
const MatchCard = React.memo(({ match, index, isSelected, onSelect, onShare, onApprove, onSendForApproval, onRematchBySharedWith, onSetState, isRequestor = false, controls, matchRequest, referenceLab, astmTables, activeDataMode }) => {

  const { profile } = useProfile();
  const organizationName = profile?.organization?.name || null;
  const navigate = useNavigate();
  const { approveMatch, rejectMatch, sendForApproval, updating } = useMatchStatusUpdater();
  
  // Build org defaults from current controls (for computeDynamicDisplayColor)
  const orgFromControls = React.useMemo(() => ({
    default_illuminant: controls?.illuminant || 'D50',
    default_observer: controls?.observer || '2',
    default_astm_table: controls?.table || '5',
  }), [controls?.illuminant, controls?.observer, controls?.table]);

  // Extract measurements array and filter by current mode
  const matchMeasurements = match.measurements || [];
  const desiredMode = normalizeModeFn(controls?.mode || 'M0');

  // Debug: Log mode selection and available modes
  React.useEffect(() => {
    const rawModes = matchMeasurements.map(m => m?.mode || m?.assignedMode || m?.measurement_mode || m?.measurementMode);
    const normalizedModes = rawModes.map(normalizeModeFn).filter(Boolean);
    
    console.info('[MatchCard Mode Debug]', {
      matchId: match.id,
      rawModes,
      normalizedModes,
      desiredMode,
      controlsMode: controls?.mode
    });
  }, [match.id, matchMeasurements, controls?.mode, desiredMode]);

  const candidates = React.useMemo(() => {
    return (matchMeasurements || []).filter((m) => {
      const mMode = getModeFromMeasurement(m);
      return mMode === desiredMode;
    });
  }, [matchMeasurements, desiredMode]);

  const effectiveDataMode = React.useMemo(() => {
    const resolved = (activeDataMode && typeof activeDataMode === 'string' ? activeDataMode : resolveActiveDataMode(match)) || 'imported';
    return resolved === 'adapted' ? 'adapted' : 'imported';
  }, [activeDataMode, match]);

  const currentModeData = React.useMemo(() => {
    if (!candidates.length) return null;
    const byDataMode = candidates.find((m) => (m.data_mode || m.dataMode) === effectiveDataMode);
    if (byDataMode) return byDataMode;
    const byAdaptedFlag = candidates.find((m) => typeof m.is_adapted === 'boolean' && m.is_adapted === (effectiveDataMode === 'adapted'));
    if (byAdaptedFlag) return byAdaptedFlag;
    const bySource = candidates.find((m) => String(m.source || '').toLowerCase().includes(effectiveDataMode));
    return bySource || candidates[0] || null;
  }, [candidates, effectiveDataMode]);

  // Extract spectral data - ONLY use mode-specific data to ensure reactivity
  const spectralForMode = React.useMemo(() => {
    // Check both snake_case and camelCase spectral data
    const sd = currentModeData?.spectral_data || currentModeData?.spectralData;
    if (sd && typeof sd === 'object' && Object.keys(sd).length > 0) {
      return sd;
    }
    
    return null;
  }, [currentModeData]);

  // PHASE 2: Calculate reference color using computeDynamicDisplayColor
  const referenceColorResult = React.useMemo(() => {
    const refSpectral = match.reference_spectral_data;
    if (!refSpectral || !astmTables?.length) {
      return { hex: null, lab: null };
    }
    
    const result = computeDynamicDisplayColor(
      { id: `ref-${match.id}` },
      orgFromControls,
      astmTables,
      {
        mode: controls?.mode,
        illuminant: controls?.illuminant,
        observer: controls?.observer,
        table: controls?.table
      },
      'imported',
      refSpectral
    );
    
    return result || { hex: null, lab: null };
  }, [
    match.id,
    match.reference_spectral_data,
    orgFromControls,
    astmTables,
    controls?.mode,
    controls?.illuminant,
    controls?.observer,
    controls?.table
  ]);

  // PHASE 3: Calculate matched color using computeDynamicDisplayColor
  const matchColorResult = React.useMemo(() => {
    // Prefer explicit mode spectral override, but DO NOT early return; let
    // computeDynamicDisplayColor resolve from match.measurements when absent.
    const hasOverride = !!spectralForMode;
    const colorArg = hasOverride ? { id: match.id } : match; // pass full match when no override
    const spectralOverride = hasOverride ? spectralForMode : null;

    const result = computeDynamicDisplayColor(
      colorArg,
      orgFromControls,   // organization defaults from controls
      astmTables,        // ASTM tables from parent
      {
        mode: controls?.mode,
        illuminant: controls?.illuminant,
        observer: controls?.observer,
        table: controls?.table
      },
      'imported',        // activeDataMode
      spectralOverride   // spectral data override when available
    );

    return result || { hex: '#E5E7EB', lab: null };
  }, [
    spectralForMode,
    match,
    match.id,
    orgFromControls,
    astmTables,
    controls?.mode,
    controls?.illuminant,
    controls?.observer,
    controls?.table
  ]);

  // Add controls version for debugging
  const controlsVersion = `${controls?.mode || 'M0'}-${controls?.illuminant || 'D50'}-${controls?.observer || '2'}-${controls?.table || '5'}`;

  // Debug logging for spectral data source and mode selection
  React.useEffect(() => {
    const availableModes = matchMeasurements.map(m => getModeFromMeasurement(m));
    console.info('[MatchCard] Color calculation:', {
      matchId: match.id,
      controlsVersion,
      selectedMode: desiredMode,
      availableModes,
      hasModeSpecific: !!(currentModeData?.spectral_data || currentModeData?.spectralData),
      finalHasSpectral: !!spectralForMode,
      spectralSource: currentModeData?.spectral_data ? 'currentModeData.snake' : (currentModeData?.spectralData ? 'currentModeData.camel' : 'none'),
      matchCalculationMethod: 'computeDynamicDisplayColor',
      referenceCalculationMethod: 'computeDynamicDisplayColor',
      matchLabReady: !!matchColorResult.lab,
      matchHexReady: !!matchColorResult.hex,
      referenceLabReady: !!referenceColorResult.lab,
      referenceHexReady: !!referenceColorResult.hex
    });
  }, [match.id, controlsVersion, desiredMode, matchMeasurements, 
      currentModeData, spectralForMode, 
      matchColorResult.lab, matchColorResult.hex, referenceColorResult.lab, referenceColorResult.hex]);

  // PHASE 3: Single source for matched Lab (from computeDynamicDisplayColor)
  const resolvedLab = React.useMemo(() => matchColorResult.lab || null, [matchColorResult.lab]);

  // Swatch hex from computeDynamicDisplayColor
  const swatchHex = React.useMemo(() => {
    // Priority 1: Use hex from computeDynamicDisplayColor
    if (matchColorResult.hex && isValidDisplayColor(matchColorResult.hex)) {
      return matchColorResult.hex;
    }
    
    // Priority 2: Fallback to precomputed hex from parent
    if (match?.sample_color_hex && isValidDisplayColor(match.sample_color_hex)) {
      return match.sample_color_hex;
    }
    
    // Priority 3: Neutral gray
    return '#E5E7EB';
  }, [matchColorResult.hex, match?.sample_color_hex]);

  const primaryQualityResult = match.primary_quality_result || null;
  
  // Prioritize referenceLab from computeDynamicDisplayColor (ColorSettingsBox-driven)
  const effectiveReferenceLab = React.useMemo(() => {
    // Priority 1: Computed from reference spectral data (mode-specific, reactive)
    if (referenceColorResult.lab) {
      return referenceColorResult.lab;
    }
    
    // Priority 2: Fallback from parent (for backward compatibility)
    if (referenceLab) {
      return referenceLab;
    }
    
    // Priority 3: Static reference_lab from match
    if (match.reference_lab) {
      return match.reference_lab;
    }
    
    return null;
  }, [referenceColorResult.lab, referenceLab, match.reference_lab]);

  const hasRefLab = !!(effectiveReferenceLab && Number.isFinite(effectiveReferenceLab.L) && Number.isFinite(effectiveReferenceLab.a) && Number.isFinite(effectiveReferenceLab.b));
  const hasMatchedLab = !!(resolvedLab && Number.isFinite(resolvedLab.L) && Number.isFinite(resolvedLab.a) && Number.isFinite(resolvedLab.b));

  React.useEffect(() => {
    console.info('MatchCard Enhanced Data:', { 
      matchId: match.id, 
      hasRefLab, 
      hasMatchedLab, 
      hasQualityResult: !!primaryQualityResult,
      labSource: 'spectral-mode-specific'
    });
  }, [match.id, hasRefLab, hasMatchedLab, primaryQualityResult]);

  // Calculate Delta E using resolved Lab
  const deltaE = React.useMemo(() => {
    if (!effectiveReferenceLab || !resolvedLab) {
      console.debug('[MatchCard] Missing Lab for Delta E:', {
        matchId: match.id,
        controlsVersion,
        hasReferenceLab: !!effectiveReferenceLab,
        hasMatchedLab: !!resolvedLab
      });
      return null;
    }
    if (!Number.isFinite(effectiveReferenceLab.L) || !Number.isFinite(resolvedLab.L)) {
      console.warn('[MatchCard] Invalid Lab values for Delta E:', {
        matchId: match.id,
        controlsVersion,
        referenceLab: effectiveReferenceLab,
        matchedLab: resolvedLab
      });
      return null;
    }
    const method = controls?.deltaE || 'dE2000';
    const dE = calculateDeltaE(effectiveReferenceLab, resolvedLab, method);
    
    console.debug('[MatchCard] Delta E calculation:', {
      matchId: match.id,
      controlsVersion,
      method,
      dE,
      referenceLab: effectiveReferenceLab,
      matchedLab: resolvedLab
    });
    
    return dE;
  }, [
    effectiveReferenceLab,
    resolvedLab,
    controls?.deltaE,
    match.id,
    controlsVersion
  ]);

  const handleRowClick = () => {
    const hasLab = resolvedLab && Number.isFinite(resolvedLab.L) && Number.isFinite(resolvedLab.a) && Number.isFinite(resolvedLab.b);
    if (!hasLab) {
      toast("This match has no valid LAB values yet.");
      return;
    }
    // Toggle: if already selected, pass null to deselect; otherwise select
    onSelect?.(isSelected ? null : match.id);
  };

  const handleReview = (e) => {
    e.stopPropagation();
    navigate(`/color-matches/${match.match_request_id}/matching/${match.color_id}`);
  };

  const handleView = (e) => {
    e.stopPropagation();
    navigate(`/color-matches/${match.match_request_id}/matching/${match.color_id}`);
  };

  const handleApprove = async (e) => {
    e.stopPropagation();
    if (!match.measurement_id) {
      toast.error('Unable to approve: measurement ID missing');
      return;
    }
    try {
      await approveMatch(match.measurement_id, () => {
        onApprove?.(match);
        toast.success('Match approved successfully');
      });
    } catch (error) {
      toast.error('Failed to approve match');
    }
  };

  const handleReject = async (e) => {
    e.stopPropagation();
    if (!match.measurement_id) {
      toast.error('Unable to reject: measurement ID missing');
      return;
    }
    try {
      await rejectMatch(match.measurement_id, () => {
        toast.success('Match rejected');
      });
    } catch (error) {
      toast.error('Failed to reject match');
    }
  };

  const handleSendForApproval = async (e) => {
    e.stopPropagation();
    if (!match.measurement_id) {
      toast.error('Unable to send for approval: measurement ID missing');
      return;
    }
    try {
      await sendForApproval(match.measurement_id, () => {
        onSendForApproval?.(match);
        toast.success('Match sent for approval');
      });
    } catch (error) {
      toast.error('Failed to send match for approval');
    }
  };

  const handleButtonClick = (e, button) => {
    e.stopPropagation();
    
    if (button.type === 'start-matching' || button.type === 'review') {
      navigate(`/color-matches/${match.match_request_id}/matching/${match.color_id}`);
      return;
    }
    
    if (button.type === 'rematch-by-shared-with') {
      if (onRematchBySharedWith) {
        onRematchBySharedWith(match).then(() => {
          navigate(`/color-matches/${match.match_request_id}/matching/${match.color_id}`);
        });
      }
      return;
    }

    // For direct state transitions, use actual measurement ID, not composite ID
    if (onSetState && button.type !== 'review' && button.type !== 'start-matching') {
      if (!match.measurement_id) {
        toast.error('Unable to process: measurement ID missing');
        return;
      }
      onSetState(match.measurement_id, button.type);
    }
  };

  const statusInfo = getColorMatchStatusForOrg(match.match_measurement_state, matchRequest, profile?.organization_id, match, organizationName);
  const availableButtons = getColorMatchButtonsForOrg(match.match_measurement_state, matchRequest, profile?.organization_id, match, organizationName);

  return (
    <motion.div
      className={`bg-white border-b border-gray-200 relative overflow-hidden min-h-[100px] cursor-pointer`}
      onClick={handleRowClick}
      layout
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      transition={{ 
        duration: 0.3, 
        delay: index * 0.05,
        ease: "easeOut"
      }}
    >
      <div 
        className="absolute left-0 top-0 w-32 h-full" 
        style={{ backgroundColor: swatchHex }}
      ></div>
      <div className={`ml-32 relative h-full min-w-0 ${isSelected ? 'bg-blue-50' : ''} p-3`}>
        <div className="flex justify-between items-start gap-3 h-full">
          <div className="flex-1 min-w-0 space-y-2">
            <div className="space-y-1">
              <p className="font-semibold text-foreground text-sm leading-tight line-clamp-1">{match.matched_by_name}</p>
              <p className="text-xs text-muted-foreground line-clamp-1">{match.match_location || 'N/A'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-foreground"><span className="font-medium">Print Condition:</span> {match.match_print_condition || matchRequest?.print_condition_name || 'N/A'}</p>
              <p className="text-xs text-foreground"><span className="font-medium">Process:</span> {match.print_condition_print_process || matchRequest?.print_condition_print_process || 'N/A'}</p>
            </div>
          </div>
          <div className="flex-shrink-0 text-right">
            {match.match_name && (
              <div className="text-xs font-medium text-foreground mb-1">
                {match.match_name}
              </div>
            )}
            {resolvedLab && Number.isFinite(resolvedLab.L) && Number.isFinite(resolvedLab.a) && Number.isFinite(resolvedLab.b) ? (
              <div className="text-xs text-foreground whitespace-nowrap">
                L {resolvedLab.L.toFixed(1)} a {resolvedLab.a.toFixed(1)} b {resolvedLab.b.toFixed(1)}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Lab: N/A</p>
            )}
          </div>
        </div>
        {/* Bottom row spanning full width */}
        <div className="flex justify-between items-center mt-2">
          <p className="text-xs text-foreground"><span className="font-medium">Quality Set:</span> {match.quality_set_name || matchRequest?.quality_set_name || 'N/A'}</p>
          <div className="text-xs text-foreground whitespace-nowrap flex items-center gap-2">
            {primaryQualityResult ? (
              (() => {
                const displayColor = primaryQualityResult.display_color || '#6B7280';
                const statusIcon = primaryQualityResult.status === 'pass' ? '✓' : primaryQualityResult.status === 'fail' ? '✗' : '⚠';
                return (
                  <span 
                    className="px-2 py-1 rounded text-xs font-medium"
                    style={{ 
                      backgroundColor: displayColor + '20', 
                      color: displayColor,
                      border: `1px solid ${displayColor}40`
                    }}
                  >
                    {primaryQualityResult.level_name}: {statusIcon} {primaryQualityResult.value?.toFixed(2) || 'N/A'}
                  </span>
                );
              })()
            ) : Number.isFinite(deltaE) ? (
              <span>{getDeltaEMethodLabel(controls?.deltaE)}: {deltaE.toFixed(2)}</span>
            ) : (
              <span>{getDeltaEMethodLabel(controls?.deltaE)}: —</span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
});


const MatchesList = ({ 
  matches, 
  selectedMatchId, 
  onSelectMatch, 
  onShare, 
  onApprove, 
  onSendForApproval, 
  onRematchBySharedWith, 
  onSetState, 
  isRequestor = false, 
  controls, 
  matchRequest, 
  selectedStatsRow, 
  onStatsRowProcessed, 
  referenceLab,
  astmTables,
  activeDataMode,
  // Filter props
  filters,
  onPrintSupplierChange,
  onPrintConditionChange,
  onClearFilters,
  filterOptions,
  isFilterActive
}) => {
  const matchText = matches.length === 1 ? 'Match' : 'Matches';
  const listRef = React.useRef(null);

  // Handle stats row selection - find closest match and scroll to it
  React.useEffect(() => {
    if (!selectedStatsRow || !matches.length || !listRef.current) return;

    // Find match with closest Lab values to the stats row
    const targetLab = selectedStatsRow.lab;
    if (!targetLab) return;

    let closestIndex = 0;
    let minDistance = Number.POSITIVE_INFINITY;

    matches.forEach((match, index) => {
      if (!match.target_color_lab_l || !match.target_color_lab_a || !match.target_color_lab_b) return;
      
      // Calculate Euclidean distance in Lab space
      const dL = targetLab.L - match.target_color_lab_l;
      const da = targetLab.a - match.target_color_lab_a;
      const db = targetLab.b - match.target_color_lab_b;
      const distance = Math.sqrt(dL * dL + da * da + db * db);
      
      if (distance < minDistance) {
        minDistance = distance;
        closestIndex = index;
      }
    });

    // Scroll to the closest match and select it
    const matchElements = listRef.current.querySelectorAll('[data-match-index]');
    const targetElement = matchElements[closestIndex];
    if (targetElement) {
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const closestMatch = matches[closestIndex];
      if (closestMatch) {
        onSelectMatch?.(closestMatch.id);
      }
    }
    
    // Mark stats row as processed
    onStatsRowProcessed?.();
  }, [selectedStatsRow, matches, onSelectMatch, onStatsRowProcessed]);
  
  return (
    <div className="h-full flex flex-col">
      <div className="bg-white border-b p-4 flex items-center justify-between h-16">
        <h3 className="text-lg font-semibold text-gray-800">{matches.length} {matchText}</h3>
        <MatchesFilterPopup
          filters={filters}
          onPrintSupplierChange={onPrintSupplierChange}
          onPrintConditionChange={onPrintConditionChange}
          onClearFilters={onClearFilters}
          filterOptions={filterOptions}
          isFilterActive={isFilterActive}
        />
      </div>
      <div className="flex-grow">
        <ScrollArea className="h-full" ref={listRef}>
          <div className="animate-fade-in">
            {matches.length === 0 ? (
              <motion.div 
                className="flex items-center justify-center h-32 text-muted-foreground"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                No matches available
              </motion.div>
            ) : (
              <AnimatePresence>
                {matches.map((match, index) => (
                  <div 
                    key={`${match.id}-${controls?.mode || 'M0'}-${controls?.illuminant || 'D50'}-${controls?.observer || '2'}-${controls?.table || '5'}`} 
                    data-match-index={index}
                  >
                    <MatchCard 
                      match={match} 
                      index={index} 
                      isSelected={selectedMatchId === match.id} 
                      onSelect={onSelectMatch}
                      onShare={onShare}
                      onApprove={onApprove}
                      onSendForApproval={onSendForApproval}
                      onRematchBySharedWith={onRematchBySharedWith}
                      onSetState={onSetState}
                      isRequestor={isRequestor}
                      controls={controls}
                      matchRequest={matchRequest}
                      referenceLab={referenceLab}
                      astmTables={astmTables}
                      activeDataMode={activeDataMode}
                    />
                  </div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};

export default MatchesList;
