import React, { useMemo } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle } from 'lucide-react';
import MeasurementModeBubble from '@/components/ui/measurement-mode-bubble';
import { labToHexD65, getBestColorHex, spectralToLabASTME308 } from '@/lib/colorUtils';
import { getSpectralDataInfo } from '@/lib/colorUtils/spectralRangeUtils';
import { useAstmTablesCache } from '@/hooks/useAstmTablesCache';
import { getTintPercentage } from '@/lib/tintsUtils';

const UnifiedCxfTable = ({ 
  mode = 'color', // 'color' or 'ink-based-color'
  data,
  selectedIds,
  onSelectItem,
  onSelectAll,
  allSelected,
  isIndeterminate,
  defaultMeasurementMode,
  orgDefaults = {}
}) => {
  // Track selected measurement mode per item
  const [selectedModes, setSelectedModes] = React.useState({});
  // Get ASTM tables for spectral to LAB conversion
  const { astmTables } = useAstmTablesCache();
  
  // Helper to extract weighting table parameters from org defaults
  const getOrgWeightingParams = () => {
    const illuminant = orgDefaults.default_illuminant || 'D50';
    const observer = String(orgDefaults.default_observer || '2');
    const tableNumber = String(orgDefaults.default_astm_table || orgDefaults.default_table || '5');
    return { illuminant, observer, tableNumber };
  };
  
  // Get weighting table based on org defaults
  const weightingTable = useMemo(() => {
    if (!astmTables?.length) return null;
    const { illuminant, observer, tableNumber } = getOrgWeightingParams();
    const rows = astmTables.filter(row => 
      row.illuminant_name === illuminant && 
      row.observer === observer &&
      String(row.table_number) === tableNumber
    );
    return rows.length ? rows : null;
  }, [astmTables, orgDefaults]);
  
  // Compute LAB values from spectral data for items that need it
  const dataWithComputedLab = useMemo(() => {
    if (!weightingTable || !data?.length) return data;
    
    return data.map(item => {
      // Check if item already has valid LAB
      let lab = item.lab || item.originalObject?.lab || (item.measurements && item.measurements[0]?.lab);
      const hasValidLab = lab && typeof lab.L === 'number' && typeof lab.a === 'number' && typeof lab.b === 'number';
      const isPlaceholder = hasValidLab && lab.L === 50 && lab.a === 0 && lab.b === 0;
      const isZeroLab = hasValidLab && lab.L === 0 && lab.a === 0 && lab.b === 0;
      
      // If no valid LAB, try to compute from spectral data
      if (!hasValidLab || isPlaceholder || isZeroLab) {
        const spectralData = item.spectralData || item.spectral_data || 
                            (item.measurements && item.measurements[0]?.spectral_data) ||
                            (mode === 'ink-based-color' && item.originalObject?.substrateTints?.[0]?.spectralData);
        
        if (spectralData && Object.keys(spectralData).length > 0) {
          try {
            const computedLab = spectralToLabASTME308(spectralData, weightingTable);
            if (computedLab && typeof computedLab.L === 'number' && 
                typeof computedLab.a === 'number' && typeof computedLab.b === 'number') {
              return { ...item, computedLab };
            }
          } catch (error) {
            console.warn('Failed to compute LAB from spectral data:', error);
          }
        }
      }
      
      return item;
    });
  }, [data, weightingTable, mode]);
  
  // Helper function to get item ID (moved before renderNameCell to use in state initialization)
  const getItemId = (item) => {
    return item.id;
  };

  // Initialize selected modes for items with multiple measurements
  React.useEffect(() => {
    const initialModes = {};
    dataWithComputedLab?.forEach(item => {
      const itemId = getItemId(item);
      if (!selectedModes[itemId]) {
        // Set initial mode to first available mode
        if (item.measurements?.length > 0) {
          initialModes[itemId] = item.measurements[0]?.mode;
        } else if (mode === 'ink-based-color' && item.originalObject) {
          const allTints = [
            ...(item.originalObject.substrateTints || []),
            ...(item.originalObject.overBlackTints || [])
          ];
          const firstMeasurement = allTints[0]?.measurements?.[0];
          if (firstMeasurement?.mode) {
            initialModes[itemId] = firstMeasurement.mode;
          }
        }
      }
    });
    if (Object.keys(initialModes).length > 0) {
      setSelectedModes(prev => ({ ...prev, ...initialModes }));
    }
  }, [dataWithComputedLab, mode]);
  
  // Helper for safe mode comparison
  const sameMode = (a, b) => (a ?? '').toString().trim().toUpperCase() === (b ?? '').toString().trim().toUpperCase();
  
  // Helper to find 100% tint in an array of tints
  const find100PercentTint = (tints) => {
    if (!tints || tints.length === 0) return null;
    // Look for explicit 100% tint
    const hundredPercent = tints.find(tint => {
      const percentage = getTintPercentage(tint);
      return percentage === 100 || percentage === '100';
    });
    if (hundredPercent) return hundredPercent;
    
    // Look for name containing "100%"
    const namedHundred = tints.find(tint => 
      tint.name && tint.name.toLowerCase().includes('100')
    );
    if (namedHundred) return namedHundred;
    
    // Find highest percentage (excluding 0% substrate)
    let maxPercentage = -1;
    let maxTint = null;
    for (const tint of tints) {
      const percentage = getTintPercentage(tint);
      if (percentage > 0 && percentage > maxPercentage) {
        maxPercentage = percentage;
        maxTint = tint;
      }
    }
    return maxTint;
  };
  
  const renderColorCell = (item) => {
    const itemId = getItemId(item);
    const activeMode = selectedModes[itemId];
    
    // Try to get hex from the selected measurement mode
    let hex = null;
    if (activeMode && item.measurements?.length > 0) {
      const measurement = item.measurements.find(m => sameMode(m.mode, activeMode));
      if (measurement?.lab) {
        try {
          hex = labToHexD65(measurement.lab.L, measurement.lab.a, measurement.lab.b, measurement.lab.illuminant || 'D50');
        } catch {}
      } else if (measurement?.spectral_data && weightingTable) {
        // Compute LAB from spectral data dynamically
        try {
          const computedLab = spectralToLabASTME308(measurement.spectral_data, weightingTable);
          if (computedLab) {
            hex = labToHexD65(computedLab.L, computedLab.a, computedLab.b, 'D50');
          }
        } catch {}
      }
    }

    // Ink-based colors: search underlying tints for the active mode, prioritizing 100% tints
    if (!hex && activeMode && mode === 'ink-based-color' && item.originalObject) {
      const substrateTints = item.originalObject.substrateTints || [];
      const overBlackTints = item.originalObject.overBlackTints || [];
      
      // First, try to find 100% tints
      const substrate100 = find100PercentTint(substrateTints);
      const overBlack100 = find100PercentTint(overBlackTints);
      const priorityTints = [substrate100, overBlack100].filter(Boolean);
      
      // Try priority tints (100% tints) first
      for (const tint of priorityTints) {
        const m = tint.measurements?.find(mm => sameMode(mm.mode, activeMode));
        if (m?.lab) {
          try {
            hex = labToHexD65(m.lab.L, m.lab.a, m.lab.b, m.lab.illuminant || 'D50');
            break;
          } catch {}
        } else if (m?.spectral_data && weightingTable) {
          try {
            const computedLab = spectralToLabASTME308(m.spectral_data, weightingTable);
            if (computedLab) {
              hex = labToHexD65(computedLab.L, computedLab.a, computedLab.b, 'D50');
              break;
            }
          } catch {}
        }
      }
      
      // If no 100% tint has the active mode, fall back to searching all tints
      if (!hex) {
        const allTints = [...substrateTints, ...overBlackTints];
        for (const tint of allTints) {
          const m = tint.measurements?.find(mm => sameMode(mm.mode, activeMode));
          if (m?.lab) {
            try {
              hex = labToHexD65(m.lab.L, m.lab.a, m.lab.b, m.lab.illuminant || 'D50');
              break;
            } catch {}
          } else if (m?.spectral_data && weightingTable) {
            try {
              const computedLab = spectralToLabASTME308(m.spectral_data, weightingTable);
              if (computedLab) {
                hex = labToHexD65(computedLab.L, computedLab.a, computedLab.b, 'D50');
                break;
              }
            } catch {}
          }
        }
      }
    }
    
    // Fall back to best computed hex from item
    if (!hex) {
      hex = getBestColorHex(item) || getBestColorHex(item?.originalObject) || null;
    }

    if (!hex) {
      // Try computed LAB first, then existing LAB
      const lab = item.computedLab || item.lab || item.originalObject?.lab || (item.measurements && item.measurements[0]?.lab);
      if (lab && typeof lab.L === 'number' && typeof lab.a === 'number' && typeof lab.b === 'number') {
        const isZeroLab = lab.L === 0 && lab.a === 0 && lab.b === 0;
        const isPlaceholder = lab.L === 50 && lab.a === 0 && lab.b === 0;
        if (!isZeroLab && !isPlaceholder) {
          try {
            hex = labToHexD65(lab.L, lab.a, lab.b, lab.illuminant || 'D50');
          } catch {}
        }
      }
    }

    return (
      <div 
        className="w-8 h-8 rounded border border-gray-300 flex-shrink-0"
        style={{ 
          backgroundColor: hex || '#f3f4f6',
          backgroundImage: !hex ? 
            'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 4px)' : 'none'
        }}
        title={hex || 'No color data'}
      />
    );
  };

  const renderNameCell = (item) => {
    const itemName = item.name || item.displayName || 'Unnamed';
    const itemId = getItemId(item);
    const activeMode = selectedModes[itemId];
    
    if (mode === 'ink-based-color') {
      // Calculate actual tint count and background info
      let totalTints = 0;
      let uniqueBackgrounds = new Set();
      let modeList = [];
      let hasSpectralData = false;
      
      if (item.originalObject) {
        const allTints = [];
        
        // Collect both substrate and over-black tints for complete background detection
        if (item.originalObject.substrateTints) {
          allTints.push(...item.originalObject.substrateTints);
        }
        if (item.originalObject.overBlackTints) {
          allTints.push(...item.originalObject.overBlackTints);
        }
        
        // Extract background names first
        allTints.forEach(tint => {
          if (tint.backgroundName) {
            uniqueBackgrounds.add(tint.backgroundName);
          }
        });
        
        // If no background names from tints, try from original object
        if (uniqueBackgrounds.size === 0 && item.originalObject.availableBackgrounds) {
          item.originalObject.availableBackgrounds.forEach(bg => uniqueBackgrounds.add(bg));
        }
        
        // Default background if none found
        if (uniqueBackgrounds.size === 0) {
          uniqueBackgrounds.add('Substrate');
        }
        
        // Calculate normalized tint count by dividing by number of backgrounds
        totalTints = uniqueBackgrounds.size > 0 ? Math.round(allTints.length / uniqueBackgrounds.size) : allTints.length;
        
        // Compute measurement modes
        const modeOrder = ['M0','M1','M2','M3'];
        const modeSets = allTints
          .map(t => new Set((t.measurements || []).map(m => m.mode).filter(Boolean)))
          .filter(s => s.size > 0);
          
        if (modeSets.length > 0) {
          const intersection = new Set(modeSets[0]);
          modeSets.slice(1).forEach(set => {
            for (const m of Array.from(intersection)) {
              if (!set.has(m)) intersection.delete(m);
            }
          });
          modeList = Array.from(intersection);
        }
        modeList.sort((a,b) => modeOrder.indexOf(a) - modeOrder.indexOf(b));
        
        // Check if any tints have spectral data
        hasSpectralData = allTints.some(tint => tint.spectralData || tint.measurements?.some(m => m.spectral_data));
      }
      
      const backgroundCount = uniqueBackgrounds.size;
      const backgroundNames = Array.from(uniqueBackgrounds);
      
      return (
        <div className="max-w-full">
          <div className="font-medium break-words">{itemName}</div>
          <div className="text-xs text-muted-foreground space-y-0.5">
            <div>
              {totalTints} tint{totalTints !== 1 ? 's' : ''} on {backgroundCount} background{backgroundCount !== 1 ? 's' : ''}
            </div>
            <div>Backgrounds: {backgroundNames.join(', ')}</div>
            <MeasurementModeBubble 
              modes={modeList}
              hasSpectralData={hasSpectralData}
              defaultMeasurementMode={defaultMeasurementMode}
              interactive={modeList.length > 1}
              activeMode={activeMode || modeList[0]}
              onModeClick={(mode) => {
                setSelectedModes(prev => ({ ...prev, [itemId]: mode }));
              }}
            />
          </div>
        </div>
      );
    } else {
      // Handle regular color mode
      const hasSpectralData = item.measurements?.some(m => m.spectral_data) || item.spectralData;
      const modes = item.measurements && item.measurements.length > 1 
        ? item.measurements.map(m => m.mode || 'Unknown')
        : item.measurementMode ? [item.measurementMode] : [];
      
      return (
        <div className="max-w-full">
          <div className="font-medium break-words">{itemName}</div>
          <div className="text-xs text-muted-foreground mt-1">
            <MeasurementModeBubble 
              modes={modes}
              hasSpectralData={hasSpectralData}
              defaultMeasurementMode={defaultMeasurementMode}
              interactive={modes.length > 1}
              activeMode={activeMode || modes[0]}
              onModeClick={(mode) => {
                setSelectedModes(prev => ({ ...prev, [itemId]: mode }));
              }}
            />
          </div>
        </div>
      );
    }
  };

  const renderObjectTypeCell = (item) => {
    if (mode === 'ink-based-color') {
      return <Badge variant="secondary">SIC</Badge>;
    }
    const label = item.objectType === 'SpotInkCharacterisation' ? 'SIC' : (item.objectType || 'Color');
    return <Badge variant="secondary">{label}</Badge>;
  };

  const renderLabCell = (item) => {
    const itemId = getItemId(item);
    const activeMode = selectedModes[itemId];
    
    // If we have a selected mode, prefer LAB from that mode
    let lab = null;
    if (activeMode) {
      // Regular color measurements on the item
      if (item.measurements?.length > 0) {
        const measurement = item.measurements.find(m => sameMode(m.mode, activeMode));
        if (measurement?.lab) {
          lab = measurement.lab;
        } else if (measurement?.spectral_data && weightingTable) {
          // Compute LAB from spectral data dynamically
          try {
            lab = spectralToLabASTME308(measurement.spectral_data, weightingTable);
          } catch {}
        }
      }
      // Ink-based colors: search underlying tints for the active mode, prioritizing 100% tints
      if (!lab && mode === 'ink-based-color' && item.originalObject) {
        const substrateTints = item.originalObject.substrateTints || [];
        const overBlackTints = item.originalObject.overBlackTints || [];
        
        // First, try to find 100% tints
        const substrate100 = find100PercentTint(substrateTints);
        const overBlack100 = find100PercentTint(overBlackTints);
        const priorityTints = [substrate100, overBlack100].filter(Boolean);
        
        // Try priority tints (100% tints) first
        for (const tint of priorityTints) {
          const m = tint.measurements?.find(mm => sameMode(mm.mode, activeMode));
          if (m?.lab) {
            lab = m.lab;
            break;
          } else if (m?.spectral_data && weightingTable) {
            try {
              lab = spectralToLabASTME308(m.spectral_data, weightingTable);
              if (lab) break;
            } catch {}
          }
        }
        
        // If no 100% tint has the active mode, fall back to searching all tints
        if (!lab) {
          const allTints = [...substrateTints, ...overBlackTints];
          for (const tint of allTints) {
            const m = tint.measurements?.find(mm => sameMode(mm.mode, activeMode));
            if (m?.lab) {
              lab = m.lab;
              break;
            } else if (m?.spectral_data && weightingTable) {
              try {
                lab = spectralToLabASTME308(m.spectral_data, weightingTable);
                if (lab) break;
              } catch {}
            }
          }
        }
      }
    }
    
    // Fall back to default LAB sources
    if (!lab) {
      lab = item.computedLab || item.lab || item.originalObject?.lab || (item.measurements && item.measurements[0]?.lab);
    }

    const hasValidLab = lab && typeof lab.L === 'number' && typeof lab.a === 'number' && typeof lab.b === 'number';
    const isPlaceholder = hasValidLab && lab.L === 50 && lab.a === 0 && lab.b === 0;
    const isZeroLab = hasValidLab && lab.L === 0 && lab.a === 0 && lab.b === 0;

    if (hasValidLab && !isPlaceholder && !isZeroLab) {
      return (
        <div className="flex items-center gap-1 flex-wrap">
          <Badge variant="secondary" className="font-mono text-xs">
            L:{lab.L.toFixed(1)}
          </Badge>
          <Badge variant="secondary" className="font-mono text-xs">
            a:{lab.a.toFixed(1)}
          </Badge>
          <Badge variant="secondary" className="font-mono text-xs">
            b:{lab.b.toFixed(1)}
          </Badge>
        </div>
      );
    }

    // Gather spectral presence across shapes
    const spectralData = item.spectralData || item.spectral_data || 
                         (item.measurements && item.measurements[0]?.spectral_data) ||
                         (mode === 'ink-based-color' && item.originalObject?.substrateTints?.[0]?.spectralData);

    if (spectralData && Object.keys(spectralData).length > 0) {
      const spectralCount = Object.keys(spectralData).length;
      return (
        <div className="text-sm">
          <span className="text-amber-600 font-medium">Computing...</span>
          <div className="text-xs text-muted-foreground">{spectralCount} points</div>
        </div>
      );
    }

    if (isPlaceholder) {
      return <span className="text-muted-foreground text-sm">Placeholder LAB</span>;
    }

    return <span className="text-muted-foreground text-sm">No LAB data</span>;
  };

  const renderSpectralCell = (item) => {
    let spectralData = item.spectralData;
    let hasSpectralData = !!spectralData;
    
    // For ink-based mode, fall back to first underlying tint if combined entry lacks data
    if (mode === 'ink-based-color' && !spectralData && item.originalObject) {
      const firstTint = item.originalObject.substrateTints?.[0] || item.originalObject.overBlackTints?.[0];
      spectralData = firstTint?.spectralData;
      hasSpectralData = !!spectralData;
    }
    
    // For regular color mode
    if (mode === 'color' && !hasSpectralData) {
      hasSpectralData = item.measurements?.some(m => m.spectral_data);
      if (hasSpectralData && !spectralData) {
        spectralData = item.measurements?.[0]?.spectral_data;
      }
    }
    
    const spectralInfo = getSpectralDataInfo(spectralData);
    
    return (
      <Badge variant={hasSpectralData ? "default" : "secondary"}>
        {spectralInfo.display}
      </Badge>
    );
  };

  const isItemSelected = (item) => {
    const id = getItemId(item);
    return selectedIds.has ? selectedIds.has(id) : selectedIds.includes(id);
  };

  const handleItemSelect = (item) => {
    const id = getItemId(item);
    onSelectItem(id);
  };

  const tableHeaders = (
    <TableHeader className="sticky top-0 bg-background/100 z-20 border-b shadow-sm">
      <TableRow>
        <TableHead className="w-12">
          <Checkbox
            checked={allSelected}
            onCheckedChange={onSelectAll}
            data-state={isIndeterminate ? 'indeterminate' : (allSelected ? 'checked' : 'unchecked')}
          />
        </TableHead>
        <TableHead className="w-16">Color</TableHead>
        <TableHead className="w-48">Name</TableHead>
        <TableHead className="w-24">Type</TableHead>
        <TableHead className="w-40">LAB</TableHead>
        <TableHead className="w-32">Spectral</TableHead>
      </TableRow>
    </TableHeader>
  );

  return (
    <div className="flex-1 overflow-hidden">
      <div className="max-h-full overflow-auto">
        <Table className="table-fixed w-full">
          {tableHeaders}
          <TableBody>
            {dataWithComputedLab.map((item, index) => {
              if (!item) return null;
              
              const isSelected = isItemSelected(item);
              
              return (
                <TableRow 
                  key={getItemId(item)}
                >
                <TableCell>
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => handleItemSelect(item)}
                  />
                </TableCell>
                  <TableCell>
                    {renderColorCell(item)}
                  </TableCell>
                  <TableCell>
                    {renderNameCell(item)}
                  </TableCell>
                  <TableCell>
                    {renderObjectTypeCell(item)}
                  </TableCell>
                  <TableCell>
                    {renderLabCell(item)}
                  </TableCell>
                  <TableCell>
                    {renderSpectralCell(item)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default UnifiedCxfTable;