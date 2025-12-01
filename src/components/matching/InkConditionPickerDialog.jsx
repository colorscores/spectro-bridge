import React, { useMemo, useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Filter, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useProfile } from '@/context/ProfileContext';
import { calculateDeltaE } from '@/lib/deltaE';
import { DEFAULT_DELTA_E_METHOD } from '@/lib/constants/deltaEMethods';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { spectralToLabASTME308, labToHex } from '@/lib/colorUtils/colorConversion';
import { useAstmTablesCache } from '@/hooks/useAstmTablesCache';
import { getSolidSpectralData } from '@/lib/colorUtils/spectralDataHelpers';
import { resolveActiveDataMode } from '@/lib/colorUtils/resolveActiveDataMode';
import { validateColorQualitySetCompatibility, getColorMeasurementModes, COMPATIBILITY_STATUS } from '@/lib/colorQualitySetCompatibility';
import CompatibilityIcon from '@/components/match-request-wizard/CompatibilityIcon';
import { sortMeasurementModes } from '@/lib/utils/measurementUtils';
import { toast as hotToast } from 'react-hot-toast';
import { getMeasurementByMode, getModeFromMeasurement } from '@/lib/utils/colorMeasurementSelection';

const InkConditionPickerDialog = ({ isOpen, setIsOpen, onSelect, referenceColor, matchPrintCondition, qualitySet, measurementControls }) => {
  const { profile } = useProfile();
  const { astmTables, loading: astmLoading } = useAstmTablesCache();
  
  // Fetch picker-specific ink data with spectral/Lab
  const [pickerInks, setPickerInks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedConditionId, setSelectedConditionId] = useState(null);
  const [filterValues, setFilterValues] = useState({
    printProcess: 'all',
    substrateType: 'all',
    materialType: 'all',
    printSide: 'all',
    packType: 'all',
  });

  const deltaEMethod = profile?.organization?.default_delta_e || DEFAULT_DELTA_E_METHOD;

  // Fetch ink data when dialog opens
  useEffect(() => {
    if (!isOpen || !profile?.organization_id) return;
    
    const fetchPickerData = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .rpc('get_inks_for_picker', { p_org_id: profile.organization_id });
        
        if (error) throw error;
        
        const inksArray = data?.inks || [];
        const substrateConditions = data?.substrate_conditions || [];
        
        // Create substrate lookup map (using sc.id as the key since that's what's stored in ink_conditions.substrate_id)
        const substrateConditionMap = new Map(
          substrateConditions.map(sc => [
            sc.id,
            {
              name: sc.name,
              substrateName: sc.substrate_name,
              substrateTypeName: sc.substrate_type_name,
              substrateMaterialName: sc.substrate_material_name,
              substratePrintingSide: sc.substrate_printing_side
            }
          ])
        );
        
        // Format with substrate details
        const formattedInks = inksArray.map(ink => ({
          ...ink,
          conditions: (ink.conditions || []).map(condition => {
            const substrateDetails = condition.substrate_id
              ? substrateConditionMap.get(condition.substrate_id)
              : null;
            
            return {
              ...condition,
              substrateTypeName: substrateDetails?.substrateTypeName || null,
              substrateMaterialName: substrateDetails?.substrateMaterialName || null,
              substratePrintingSide: substrateDetails?.substratePrintingSide || null
            };
          })
        }));
        
        setPickerInks(formattedInks);
        console.log('[InkConditionPicker] Loaded picker data:', {
          inksCount: formattedInks.length,
          conditionsCount: formattedInks.reduce((sum, ink) => sum + (ink.conditions?.length || 0), 0)
        });
      } catch (error) {
        console.error('[InkConditionPicker] Error fetching picker data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchPickerData();
  }, [isOpen, profile?.organization_id]);

  // Extract unique filter options from pickerInks data
  const filterOptions = useMemo(() => {
    if (!pickerInks) return { printProcesses: [], substrateTypes: [], materialTypes: [], printSides: [], packTypes: [] };
    
    const processes = new Set();
    const substrates = new Set();
    const materials = new Set();
    const printSides = new Set();
    const packs = new Set();
    
    pickerInks.forEach(ink => {
      if (ink.print_process) processes.add(ink.print_process);
      
      ink.conditions?.forEach(condition => {
        if (condition.substrateTypeName) substrates.add(condition.substrateTypeName);
        if (condition.substrateMaterialName) materials.add(condition.substrateMaterialName);
        if (condition.substratePrintingSide) printSides.add(condition.substratePrintingSide);
        if (condition.pack_type) packs.add(condition.pack_type);
      });
    });
    
    return {
      printProcesses: Array.from(processes).sort(),
      substrateTypes: Array.from(substrates).sort(),
      materialTypes: Array.from(materials).sort(),
      printSides: Array.from(printSides).sort(),
      packTypes: Array.from(packs).sort()
    };
  }, [pickerInks]);

  const items = useMemo(() => {
    // Extract reference Lab value and measurement settings from spectral data
    let refLab = null;
    let refMeasurementMode = null;
    let refIlluminant = 'D50';
    let refObserver = '2';
    let refTable = 5;
    
    // Only try spectral calculation if ASTM tables are fully loaded
    if (referenceColor?.measurements && !astmLoading && astmTables?.length > 0) {
      // Get required mode from measurementControls (user's ColorSettingsBox choice)
      const requiredMode = measurementControls?.mode || null;
      
      // Find measurement with mode-aware selection
      const measurement = getMeasurementByMode(referenceColor.measurements, requiredMode) || 
                          referenceColor.measurements.find(m => m.spectral_data) || 
                          referenceColor.measurements[0];
      
      if (measurement) {
        // Extract measurement settings
        refMeasurementMode = getModeFromMeasurement(measurement) || measurement.mode || measurement.measurement_mode;
        
        if (import.meta.env.DEV) {
          console.log('[InkConditionPicker] Reference mode selection:', {
            requiredMode,
            selectedMode: refMeasurementMode
          });
        }
        refIlluminant = measurement.illuminant || 'D50';
        refObserver = measurement.observer || '2';
        refTable = parseInt(measurement.table || profile?.organization?.default_astm_table || '5');
        
        if (measurement?.spectral_data) {
          // Get ALL matching rows for the weighting table (not just one object)
          const weightingRows = astmTables
            .filter(t => 
              t.illuminant_name === refIlluminant && 
              String(t.observer) === String(refObserver) && 
              Number(t.table_number) === Number(refTable)
            )
            .sort((a, b) => a.wavelength - b.wavelength);
          
          console.log('[InkConditionPicker] Reference ASTM table:', {
            illuminant: refIlluminant,
            observer: refObserver,
            table: refTable,
            rowCount: weightingRows.length,
            wavelengthRange: weightingRows.length > 0 ? `${weightingRows[0].wavelength}-${weightingRows[weightingRows.length - 1].wavelength}` : 'N/A',
            hasWhitePoint: weightingRows.length > 0 && weightingRows[0].white_point_xn !== undefined
          });
          
          if (weightingRows.length > 0) {
            try {
              const calculated = spectralToLabASTME308(measurement.spectral_data, weightingRows);
              if (calculated && calculated.L !== undefined && calculated.L !== 0) {
                refLab = calculated;
                console.log('[InkConditionPicker] ✓ Calculated refLab from spectral:', refLab, { mode: refMeasurementMode });
              } else {
                console.warn('[InkConditionPicker] ✗ spectralToLabASTME308 returned invalid Lab:', calculated);
              }
            } catch (error) {
              console.error('[InkConditionPicker] ✗ Failed to calculate Lab from spectral:', error);
            }
          } else {
            console.error('[InkConditionPicker] ✗ No ASTM weighting rows found for reference');
          }
        }
        
        // Fallback to pre-calculated Lab from measurement
        if (!refLab && measurement?.lab) {
          refLab = measurement.lab;
          console.log('[InkConditionPicker] Using pre-calculated Lab from measurement:', refLab);
        }
      }
    }
    
    // Additional fallbacks
    if (!refLab && referenceColor?.reference_lab) {
      refLab = referenceColor.reference_lab;
    } else if (!refLab && referenceColor?.lab) {
      refLab = referenceColor.lab;
    } else if (!refLab && referenceColor?.lab_l !== undefined) {
      refLab = { L: referenceColor.lab_l, a: referenceColor.lab_a, b: referenceColor.lab_b };
    }

    // Get ALL matching rows for the weighting table (not just one object)
    const weightingRows = !astmLoading && astmTables?.length > 0 
      ? astmTables
          .filter(t => 
            t.illuminant_name === refIlluminant && 
            String(t.observer) === String(refObserver) && 
            Number(t.table_number) === Number(refTable)
          )
          .sort((a, b) => a.wavelength - b.wavelength)
      : [];

    const list = [];
    (pickerInks || []).forEach(ink => {
      (ink.conditions || []).forEach(ic => {
        // Strictly resolve active data mode using consistent precedence
        const activeDataMode = resolveActiveDataMode(ic);

        // 🎯 Phase 2: Use correct tints based on active_data_mode
        const tintsToUse = activeDataMode === 'adapted' 
          ? (ic.adapted_tints || [])
          : (ic.imported_tints || []);

        console.log('🎯 Phase 2 - InkConditionPicker using tints:', {
          conditionName: ic.name,
          activeDataMode,
          tintsSource: activeDataMode === 'adapted' ? 'adapted_tints' : 'imported_tints',
          tintsCount: Array.isArray(tintsToUse) ? tintsToUse.length : (tintsToUse ? Object.keys(tintsToUse).length : 0)
        });

        // Get mode-appropriate spectral data with strict mode enforcement
        const solidDataResult = getSolidSpectralData(
          ic,
          activeDataMode,
          tintsToUse,
          null, // inkSolidTint - not used for ink conditions
          { mode: refMeasurementMode, strictAdapted: true }
        );

        const resolvedSpectralData = solidDataResult?.spectralData;
        const resolvedLab = solidDataResult?.lab;

        console.log(`[InkConditionPicker] Prepared item for ${ic.name}:`, {
          conditionId: ic.id?.slice(0, 8),
          activeDataMode,
          spectralSource: solidDataResult?.source || 'none',
          spectralPoints: resolvedSpectralData ? Object.keys(resolvedSpectralData).length : 0,
          hasImportedTints: ic.imported_tints?.length > 0,
          hasAdaptedTints: ic.adapted_tints?.length > 0
        });

        // Warn if adapted mode requested but no spectral data found
        if (activeDataMode === 'adapted' && !resolvedSpectralData) {
          console.warn(`[InkConditionPicker] ⚠️ Condition ${ic.name} (${ic.id?.slice(0, 8)}) has activeDataMode='adapted' but no adapted spectral data`);
        }

        const item = {
          inkId: ink.id,
          inkName: ink.name,
          conditionId: ic.id,
          conditionName: ic.name,
          hex: ic.color_hex,
          
          // Store mode-appropriate spectral data at root for backward compatibility
          spectral_data: resolvedSpectralData,
          
          // 🎯 Phase 4: Extract all available measurement modes from tints
          available_modes: (() => {
            const modes = [];
            const tintsToCheck = activeDataMode === 'adapted' && ic.adapted_tints 
              ? (Array.isArray(ic.adapted_tints) ? ic.adapted_tints : Object.values(ic.adapted_tints))
              : (Array.isArray(ic.imported_tints) ? ic.imported_tints : Object.values(ic.imported_tints));
            
            tintsToCheck.forEach(tint => {
              if (Array.isArray(tint.measurements)) {
                tint.measurements.forEach(m => {
                  const mmode = m.mode || m.measurement_mode || tint.mode || ic.measurement_settings?.mode;
                  if (mmode) modes.push(String(mmode).toUpperCase());
                });
              }
            });
            
            return sortMeasurementModes([...new Set(modes)]);
          })(),
          
          // 🎯 Phase 4: Store measurements with correct mode from solidDataResult (NOT activeDataMode!)
          measurements: (() => {
            // Helper to extract spectral data from various key formats
            const extractMeasurementSpectral = (m) => {
              if (!m || typeof m !== 'object') return null;
              const candidate = m.spectral_data || m.spectralData || m.spectral || m.spectrum;
              if (candidate && typeof candidate === 'object' && Object.keys(candidate).length > 0) return candidate;
              if (m.spectral_string && typeof m.spectral_string === 'string') {
                try {
                  const parsed = JSON.parse(m.spectral_string);
                  if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) return parsed;
                } catch (_) { /* ignore */ }
              }
              return null;
            };
            
            const measurements = [];
            const tintsToCheck = activeDataMode === 'adapted' && ic.adapted_tints 
              ? (Array.isArray(ic.adapted_tints) ? ic.adapted_tints : Object.values(ic.adapted_tints))
              : (Array.isArray(ic.imported_tints) ? ic.imported_tints : Object.values(ic.imported_tints));
            
            // Extract all measurements from 100% solid tint
            const solidTint = tintsToCheck.find(t => {
              const pct = Number(t.tintPercentage ?? t.tint_percentage ?? t.percentage ?? t.tint);
              return pct === 100;
            });
            
            if (solidTint?.measurements && Array.isArray(solidTint.measurements)) {
              solidTint.measurements.forEach(m => {
                const derivedMode = m.mode || m.measurement_mode || solidTint.mode || ic.measurement_settings?.mode;
                if (derivedMode) {
                  const spectral = extractMeasurementSpectral(m);
                  if (spectral) {
                    const modeSource = m.mode ? 'measurement.mode' : m.measurement_mode ? 'measurement.measurement_mode' : solidTint.mode ? 'tint.mode' : 'ink.settings';
                    console.log('[InkConditionPicker] Derived mode for measurement', { 
                      condition: ic.name, 
                      source: modeSource, 
                      mode: derivedMode 
                    });
                    measurements.push({
                      mode: String(derivedMode).toUpperCase(),
                      spectral_data: spectral,
                      lab: m.lab
                    });
                  }
                }
              });
            }
            
            // Fallback to the resolved spectral data if no measurements extracted
            if (measurements.length === 0 && resolvedSpectralData) {
              const fallbackMode = solidTint?.mode || ic.measurement_settings?.mode || solidDataResult?.mode || refMeasurementMode;
              measurements.push({
                mode: String(fallbackMode).toUpperCase(),
                spectral_data: resolvedSpectralData,
                lab: resolvedLab
              });
            }
            
            console.log('[InkConditionPicker] Built measurements', {
              condition: ic.name,
              modes: measurements.map(m => m.mode),
              spectralKeyCounts: measurements.map(m => Object.keys(m.spectral_data || {}).length)
            });
            
            return measurements;
          })(),
          
          // Store mode and tints for dynamic switching in ProgressiveMatchingView
          active_data_mode: activeDataMode, // Use resolved active data mode
          imported_tints: ic.imported_tints || [],
          adapted_tints: ic.adapted_tints || [],
          
          printProcess: ink.print_process,
          substrateType: ic.substrateTypeName,
          materialType: ic.substrateMaterialName,
          printSide: ic.substratePrintingSide,
          packType: ic.pack_type,
        };

        // Validate compatibility with quality set
        if (qualitySet) {
          try {
            // Create a mock color object for validation
            const mockColor = {
              id: ic.id,
              name: ic.name,
              measurements: item.measurements,
              spectral_data: resolvedSpectralData,
              lab: resolvedLab
            };
            
            const validationResult = validateColorQualitySetCompatibility(
              mockColor,
              item.measurements,
              qualitySet,
              null // No ink condition data needed for this check
            );
            
            item.compatibilityStatus = validationResult.status;
            item.compatibilityMessage = validationResult.message;
            
            console.log(`[InkConditionPicker] Compatibility check for ${ic.name}:`, {
              status: validationResult.status,
              message: validationResult.message,
              availableModes: item.available_modes,
              requiredSettings: qualitySet.measurement_settings
            });
          } catch (error) {
            console.error(`[InkConditionPicker] Compatibility validation failed for ${ic.name}:`, error);
            item.compatibilityStatus = COMPATIBILITY_STATUS.WARNING;
            item.compatibilityMessage = 'Could not validate compatibility';
          }
        }

          // Calculate Delta E using spectral data if available
        if (refLab && weightingRows.length > 0) {
          let conditionLab = null;
          let labSource = null;
          
          // 🎯 Phase 2: Extract solid spectral data using correct tints based on mode
          const solidSpectralResult = getSolidSpectralData(
            ic,
            activeDataMode,
            tintsToUse, // Use the same tints determined above
            null,
            { mode: refMeasurementMode, strictAdapted: true }
          );
          
          if (solidSpectralResult?.spectralData) {
            try {
              conditionLab = spectralToLabASTME308(solidSpectralResult.spectralData, weightingRows);
              labSource = `spectral-${solidSpectralResult.source}`;
              
              // ✨ Compute hex from the Lab we just calculated (instead of using stale db color_hex)
              const computedHex = labToHex(conditionLab.L, conditionLab.a, conditionLab.b, refIlluminant || 'D50');
              if (computedHex && /^#[0-9A-F]{6}$/i.test(computedHex)) {
                item.hex = computedHex; // Override the stale database hex
                item.computedFromSpectral = true; // Flag for debugging
              }
              
              console.log(`[InkConditionPicker] ✓ Condition ${ic.id.slice(0,8)} Lab from spectral:`, {
                source: solidSpectralResult.source,
                mode: solidSpectralResult.mode,
                lab: conditionLab,
                computedHex // Log the dynamically computed hex
              });
            } catch (error) {
              console.error(`[InkConditionPicker] ✗ Condition ${ic.id.slice(0,8)} spectral calc failed:`, error);
            }
          } else {
            console.warn(`[InkConditionPicker] ⚠ Condition ${ic.id.slice(0,8)} has no spectral data`, {
              hasSpectralDataField: !!(ic.spectral_data && Object.keys(ic.spectral_data).length > 0),
              hasAdaptedTints: !!ic.adapted_tints?.length,
              hasImportedTints: !!ic.imported_tints?.length,
              activeDataMode
            });
          }
          
          // STRICT FALLBACK: Only use stored Lab if truly Lab-only (no spectral expected)
          if (!conditionLab) {
            if (ic.lab && ic.lab.L !== undefined) {
              conditionLab = ic.lab;
              labSource = 'stored-lab';
              console.log(`[InkConditionPicker] ↪ Condition ${ic.id.slice(0,8)} using stored Lab (Lab-only):`, conditionLab);
            } else {
              console.error(`[InkConditionPicker] ✗ Condition ${ic.id.slice(0,8)} has NO valid Lab data`);
              item.deltaE = null;
            }
          }
          
          // Calculate Delta E
          if (conditionLab) {
            try {
              item.deltaE = calculateDeltaE(refLab, conditionLab, deltaEMethod);
              console.log(`[InkConditionPicker] dE = ${item.deltaE?.toFixed(2)}`, {
                conditionId: ic.id.slice(0,8),
                labSource,
                method: deltaEMethod,
                refLab: { L: refLab.L.toFixed(1), a: refLab.a.toFixed(1), b: refLab.b.toFixed(1) },
                conditionLab: { L: conditionLab.L.toFixed(1), a: conditionLab.a.toFixed(1), b: conditionLab.b.toFixed(1) }
              });
            } catch (error) {
              console.error(`[InkConditionPicker] ✗ dE calculation failed for ${ic.id.slice(0,8)}:`, error);
              item.deltaE = null;
            }
          }
        } else {
          item.deltaE = null;
        }

        list.push(item);
      });
    });

    let filteredList = list;

    // Apply search filter
    if (q) {
      const qq = q.toLowerCase();
      filteredList = filteredList.filter(i => 
        (i.inkName || '').toLowerCase().includes(qq) || 
        (i.conditionName || '').toLowerCase().includes(qq)
      );
    }

    // Apply dropdown filters
    if (filterValues.printProcess !== 'all') {
      filteredList = filteredList.filter(item => item.printProcess === filterValues.printProcess);
    }
    if (filterValues.substrateType !== 'all') {
      filteredList = filteredList.filter(item => item.substrateType === filterValues.substrateType);
    }
    if (filterValues.materialType !== 'all') {
      filteredList = filteredList.filter(item => item.materialType === filterValues.materialType);
    }
    if (filterValues.packType !== 'all') {
      filteredList = filteredList.filter(item => item.packType === filterValues.packType);
    }
    if (filterValues.printSide !== 'all') {
      filteredList = filteredList.filter(item => item.printSide === filterValues.printSide);
    }

    // Sort by Delta E (lowest first) if available, otherwise alphabetically
    filteredList.sort((a, b) => {
      if (a.deltaE !== null && b.deltaE !== null) {
        return a.deltaE - b.deltaE;
      }
      if (a.deltaE !== null && b.deltaE === null) {
        return -1;
      }
      if (a.deltaE === null && b.deltaE !== null) {
        return 1;
      }
      return (a.inkName || '').localeCompare(b.inkName || '');
    });

    return filteredList;
  }, [pickerInks, q, filterValues, referenceColor, deltaEMethod, astmTables, astmLoading]);

  const handleImport = () => {
    const selectedItem = items.find(item => item.conditionId === selectedConditionId);
    if (!selectedItem) return;

    // Validate compatibility before import
    if (qualitySet && selectedItem.compatibilityStatus === COMPATIBILITY_STATUS.INCOMPATIBLE) {
      hotToast.error('Cannot import: This ink condition is incompatible with the quality set requirements');
      console.error('[InkConditionPicker] Blocked import of incompatible ink condition:', {
        name: selectedItem.conditionName,
        message: selectedItem.compatibilityMessage
      });
      return;
    }

    // Show warning for WARNING status
    if (qualitySet && selectedItem.compatibilityStatus === COMPATIBILITY_STATUS.WARNING) {
      hotToast('Warning: Importing ink condition with compatibility issues', {
        icon: '⚠️',
        duration: 4000
      });
      console.warn('[InkConditionPicker] Warning: Importing ink condition with compatibility warning:', {
        name: selectedItem.conditionName,
        message: selectedItem.compatibilityMessage
      });
    }

    onSelect?.({
      source: 'ink_condition',
      ink_id: selectedItem.inkId,
      ink_condition_id: selectedItem.conditionId,
      name: `${selectedItem.inkName} · ${selectedItem.conditionName}`,
      hex: selectedItem.hex,
      
      // Pass measurements array so ColorPanel can extract spectral
      measurements: selectedItem.measurements,
      
      // Pass available modes for reference
      available_modes: selectedItem.available_modes,
      
      // Also pass at root level for backward compatibility
      spectral_data: selectedItem.spectral_data,
      
      // Pass mode and tints for dynamic updates
      active_data_mode: selectedItem.active_data_mode,
      imported_tints: selectedItem.imported_tints,
      adapted_tints: selectedItem.adapted_tints,
    });
    
    console.log('[InkConditionPicker] Imported ink condition:', {
      name: selectedItem.conditionName,
      activeDataMode: selectedItem.active_data_mode,
      hasMeasurements: selectedItem.measurements?.length > 0,
      spectralPoints: Object.keys(selectedItem.spectral_data || {}).length,
      measurementMode: selectedItem.measurements?.[0]?.mode,
      availableModes: selectedItem.available_modes,
      compatibilityStatus: selectedItem.compatibilityStatus
    });
    
    setIsOpen(false);
    setSelectedConditionId(null);
  };

  const handleFilterChange = (filterKey, value) => {
    setFilterValues(prev => ({
      ...prev,
      [filterKey]: value
    }));
  };

  const hasActiveFilters = Object.values(filterValues).some(v => v !== 'all');

  const clearFilters = () => {
    setFilterValues({
      printProcess: 'all',
      substrateType: 'all',
      materialType: 'all',
      printSide: 'all',
      packType: 'all',
    });
  };

  const formatDeltaE = (deltaE) => {
    if (deltaE === null || deltaE === undefined) return 'N/A';
    return deltaE.toFixed(2);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] flex flex-col">
        <div className="flex-1 overflow-y-auto space-y-3 pr-2">
          {/* Search and Filter Controls */}
          <div className="flex items-center gap-2">
            <Input 
              placeholder="Search inks or conditions…" 
              value={q} 
              onChange={(e) => setQ(e.target.value)} 
              className="placeholder:text-muted-foreground/40 flex-1" 
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2"
            >
              <Filter className="h-4 w-4" />
              Filter
              {hasActiveFilters && (
                <span className="ml-1 h-2 w-2 rounded-full bg-primary" />
              )}
              {showFilters ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>

          {/* Filter Panel */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="border rounded-md p-3 bg-muted/20">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium">Filter by Print Condition</h4>
                    {hasActiveFilters && (
                      <Button variant="ghost" size="sm" onClick={clearFilters}>
                        Clear
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="printProcess" className="text-sm">Print Process</Label>
                        <Select value={filterValues.printProcess} onValueChange={(v) => handleFilterChange('printProcess', v)}>
                          <SelectTrigger id="printProcess">
                            <SelectValue placeholder="All" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All</SelectItem>
                            {filterOptions.printProcesses.map(pp => (
                              <SelectItem key={pp} value={pp}>{pp}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="substrateType" className="text-sm">Substrate Type</Label>
                        <Select value={filterValues.substrateType} onValueChange={(v) => handleFilterChange('substrateType', v)}>
                          <SelectTrigger id="substrateType">
                            <SelectValue placeholder="All" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All</SelectItem>
                            {filterOptions.substrateTypes.map(st => (
                              <SelectItem key={st} value={st}>{st}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="materialType" className="text-sm">Material Type</Label>
                        <Select value={filterValues.materialType} onValueChange={(v) => handleFilterChange('materialType', v)}>
                          <SelectTrigger id="materialType">
                            <SelectValue placeholder="All" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All</SelectItem>
                            {filterOptions.materialTypes.map(sm => (
                              <SelectItem key={sm} value={sm}>{sm}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="printSide" className="text-sm">Print Side</Label>
                        <Select value={filterValues.printSide} onValueChange={(v) => handleFilterChange('printSide', v)}>
                          <SelectTrigger id="printSide">
                            <SelectValue placeholder="All" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All</SelectItem>
                            {filterOptions.printSides.map(ps => (
                              <SelectItem key={ps} value={ps}>{ps}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="packType" className="text-sm">Pack Type</Label>
                        <Select value={filterValues.packType} onValueChange={(v) => handleFilterChange('packType', v)}>
                          <SelectTrigger id="packType">
                            <SelectValue placeholder="All" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All</SelectItem>
                            {filterOptions.packTypes.map(pt => (
                              <SelectItem key={pt} value={pt}>{pt}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Results Table */}
          <div className="border rounded-md">
            <RadioGroup value={selectedConditionId} onValueChange={setSelectedConditionId}>
              <ScrollArea className="h-[300px]">
                <Table className="table-fixed">
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow className="border-b">
                      <TableHead className="w-[50px]">Select</TableHead>
                      <TableHead className="w-[60px]"></TableHead>
                      {qualitySet && <TableHead className="w-[60px] text-center">Status</TableHead>}
                      <TableHead className="text-left">Ink Condition Name</TableHead>
                      <TableHead className="text-right w-[100px]">{deltaEMethod}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading && (
                      <TableRow>
                        <TableCell colSpan={qualitySet ? 5 : 4} className="text-center text-sm text-muted-foreground">
                          Loading…
                        </TableCell>
                      </TableRow>
                    )}
                    {!loading && items.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={qualitySet ? 5 : 4} className="text-center text-sm text-muted-foreground">
                          No ink conditions found
                        </TableCell>
                      </TableRow>
                    )}
                    {!loading && items.length > 0 &&
                      items.map(item => (
                        <TableRow key={item.conditionId} className="cursor-pointer">
                          <TableCell className="w-[50px]">
                            <RadioGroupItem value={item.conditionId} id={item.conditionId} />
                          </TableCell>
                          <TableCell className="w-[60px]">
                            <Label htmlFor={item.conditionId} className="cursor-pointer block">
                              <div 
                                className="h-8 w-8 rounded-sm border" 
                                style={{ backgroundColor: item.hex || '#eee' }} 
                              />
                            </Label>
                          </TableCell>
                          {qualitySet && (
                            <TableCell className="w-[60px]">
                              <CompatibilityIcon 
                                status={item.compatibilityStatus} 
                                message={item.compatibilityMessage} 
                              />
                            </TableCell>
                          )}
                          <TableCell>
                            <Label htmlFor={item.conditionId} className="cursor-pointer block">
                              <div className="leading-tight space-y-1">
                                <div className="font-medium text-sm">{item.inkName}</div>
                                <div className="text-xs text-muted-foreground">{item.conditionName}</div>
                                {item.available_modes && item.available_modes.length > 0 && (
                                  <div className="flex gap-1 flex-wrap">
                                    {item.available_modes.map(mode => (
                                      <Badge 
                                        key={mode} 
                                        variant="secondary" 
                                        className="text-xs px-1.5 py-0 h-4 font-mono"
                                      >
                                        {mode}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </Label>
                          </TableCell>
                          <TableCell className="text-right w-[100px]">
                            <Label htmlFor={item.conditionId} className="cursor-pointer block text-right">
                              <div className="text-sm font-semibold font-mono tabular-nums">{formatDeltaE(item.deltaE)}</div>
                            </Label>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </RadioGroup>
          </div>
        </div>

        <DialogFooter className="flex justify-between sm:justify-between border-t pt-4 flex-shrink-0">
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={!selectedConditionId}>
            Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default InkConditionPickerDialog;
