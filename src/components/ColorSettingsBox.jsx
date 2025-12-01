import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { getDeltaEOptions } from '@/lib/constants/deltaEMethods';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { sortMeasurementModes } from '@/lib/utils/measurementUtils';

const ColorSettingsBox = ({ 
  controls, 
  setControls, 
  standards, 
  organizationDefaults,
  qualitySetDefaults,
  availableModes = [],
  labConditions = null,
  onReset,
  className,
  measurementLoaded = true 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const wrapperRef = useRef(null);
  const [overlayPos, setOverlayPos] = useState({ top: 0, right: 0 });
  const { mode, illuminant, observer, table, deltaE } = controls;
  const { illuminants = [], observers = [], astmTables = [], loading } = standards || {};

  // Determine which defaults to use - prioritize quality set defaults
  const activeDefaults = qualitySetDefaults || organizationDefaults;
  const isUsingQualitySetDefaults = !!qualitySetDefaults;

  // Check if we have stored Lab values without spectral data (Lab-only colors)
  const isLabOnly = availableModes.length === 0 && labConditions && 
    (labConditions.illuminant || labConditions.observer || labConditions.table);
  
  // Use strict mode list - no fallback when no modes available

  // Check if current settings differ from active defaults
  const hasChanges = activeDefaults && (
    mode !== (activeDefaults.mode || activeDefaults.default_measurement_mode) ||
    illuminant !== (activeDefaults.illuminant || activeDefaults.default_illuminant) ||
    observer !== (activeDefaults.observer || activeDefaults.default_observer) ||
    table !== (activeDefaults.table || activeDefaults.default_astm_table) ||
    deltaE !== (activeDefaults.deltaE || activeDefaults.default_delta_e || 'dE76')
  );

  // Sync floating overlay position when open
  useEffect(() => {
    if (!isOpen) return;
    const update = () => {
      if (!wrapperRef.current) return;
      const rect = wrapperRef.current.getBoundingClientRect();
      setOverlayPos({ top: rect.top, right: Math.max(0, window.innerWidth - rect.right) });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [isOpen]);

  const handleControlChange = (key, value) => {
    // Validate that mode is available for the color, or no-op if no modes available
    if (key === 'mode') {
      if (availableModes.length === 0) {
        console.warn('No modes available for this color, ignoring mode change');
        return;
      }
      if (!availableModes.includes(value)) {
        console.warn(`Mode ${value} is not available for this color. Available modes:`, availableModes);
        return;
      }
    }
    setControls(prev => ({ ...prev, [key]: value }));
  };

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => {
      setIsOpen(false);
      setIsExiting(false);
    }, 250); // Match animation duration
  };

  const resetToDefaults = () => {
    if (activeDefaults) {
      let validatedTable = activeDefaults.table || activeDefaults.default_astm_table || '5';
      
      // Validate the table exists in available tables
      if (astmTables.length > 0) {
        const isValidTable = astmTables.some(table => 
          table.table_number.toString() === validatedTable
        );
        if (!isValidTable) {
          // Fall back to first available table
          validatedTable = astmTables[0]?.table_number?.toString() || '5';
        }
      }

      // Get the default mode and validate it's available
      let validatedMode = activeDefaults.mode || activeDefaults.default_measurement_mode || 'M1';
      if (availableModes.length > 0 && !availableModes.includes(validatedMode)) {
        // Fall back to lowest available mode
        const modeOrder = ['M0', 'M1', 'M2', 'M3'];
        validatedMode = modeOrder.find(mode => availableModes.includes(mode)) || availableModes[0];
      }
      
      setControls({
        mode: validatedMode,
        illuminant: activeDefaults.illuminant || activeDefaults.default_illuminant || 'D50',
        observer: activeDefaults.observer || activeDefaults.default_observer || '2',
        table: validatedTable,
        deltaE: activeDefaults.deltaE || activeDefaults.default_delta_e || 'dE76'
      });
      
      // Notify parent that reset occurred
      if (onReset) {
        onReset();
      }
    }
  };


  return (
    <motion.div
      ref={wrapperRef}
      className={cn("ml-auto relative flex flex-row-reverse items-center h-9 border rounded-lg bg-card overflow-visible z-10", className)}
      initial={false}
      animate={{
        boxShadow: isOpen ? "0 10px 25px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)" : "none"
      }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      style={{ transformOrigin: "right center" }}
    >
      {/* Content Area */}
      <div className="flex items-center h-9 overflow-hidden">
          {/* Always show compact summary; expanded panel is rendered as overlay */}
          <motion.div
            key="compact"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="px-3 py-1 flex items-center whitespace-nowrap"
          >
            {(
              !measurementLoaded ? (
                <>
                  <span className="text-muted-foreground mr-2 text-sm">Measurement:</span>
                  <span className="text-sm font-medium">no measurement</span>
                </>
              ) : loading ? (
                <>
                  <span className="text-muted-foreground mr-2 text-sm">Measurement:</span>
                  <span className="text-sm font-medium">Loading…</span>
                </>
              ) : (
                <>
                  <span className="text-muted-foreground mr-2 text-sm">Measurement:</span>
                  <span className="text-sm font-medium">{mode} | {illuminant} | {observer}° | Table {table} | {deltaE || 'dE76'}</span>
                  {hasChanges && <span className="text-primary ml-2">*</span>}
                </>
              )
            )}
          </motion.div>
      </div>

      {/* Floating expanded panel (absolute, opens left, right edge fixed) */}
      {createPortal(
        <AnimatePresence>
          {(isOpen || isExiting) && measurementLoaded && !loading && (
            <motion.div
              key="expanded-overlay"
              initial={{ opacity: 0, scaleX: 0 }}
              animate={{ opacity: 1, scaleX: 1 }}
              exit={{ opacity: 0, scaleX: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              style={{ position: 'fixed', top: overlayPos.top, right: overlayPos.right, transformOrigin: 'right center' }}
              className="z-50 bg-card border rounded-lg shadow-lg pl-10 pr-3 py-1 flex items-center gap-6 whitespace-nowrap"
            >
              {/* Inner handle pinned to the left edge of the overlay */}
              <button
                onClick={handleClose}
                aria-label="Close measurement settings"
                className="absolute left-0 top-1/2 -translate-y-1/2 h-9 w-8 flex items-center justify-center bg-muted hover:bg-muted/80 transition-colors border-r rounded-l-lg"
                title="Close measurement settings"
              >
                <ChevronRight className="h-4 w-4" />
              </button>

              <div className="text-sm text-muted-foreground flex-shrink-0">Measurement</div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Label htmlFor="color-mode-select" className="text-xs">Mode</Label>
                  <Select 
                    value={availableModes.length === 0 ? "" : mode} 
                    onValueChange={(val) => handleControlChange('mode', val)}
                    disabled={availableModes.length === 0}
                  >
                    <SelectTrigger id="color-mode-select" className="h-8 w-16 text-xs">
                      <SelectValue placeholder={availableModes.length === 0 ? "No modes" : "Mode"} />
                    </SelectTrigger>
                    <SelectContent className="bg-background border shadow-md z-50">
                      {sortMeasurementModes(availableModes).map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  <Label htmlFor="color-illuminant-select" className="text-xs">Ill.</Label>
                  <Select value={illuminant} onValueChange={(val) => handleControlChange('illuminant', val)} disabled={isLabOnly}>
                    <SelectTrigger id="color-illuminant-select" className="h-8 w-20 text-xs">
                      <SelectValue placeholder="Ill." />
                    </SelectTrigger>
                    <SelectContent>
                      {isLabOnly ? (
                        <SelectItem value={labConditions.illuminant}>{labConditions.illuminant}</SelectItem>
                      ) : (
                        illuminants.map(ill => (
                          <SelectItem key={ill.id} value={ill.name}>{ill.name}</SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  <Label htmlFor="color-observer-select" className="text-xs">Observer.</Label>
                  <Select value={observer} onValueChange={(val) => handleControlChange('observer', val)} disabled={isLabOnly}>
                    <SelectTrigger id="color-observer-select" className="h-8 w-16 text-xs">
                      <SelectValue placeholder="Observer." />
                    </SelectTrigger>
                    <SelectContent>
                      {isLabOnly ? (
                        <SelectItem value={labConditions.observer}>{labConditions.observer}°</SelectItem>
                      ) : (
                        observers.map(obs => (
                          <SelectItem key={obs.id} value={obs.name}>{obs.name}°</SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  <Label htmlFor="color-table-select" className="text-xs">Table</Label>
                  <Select value={table} onValueChange={(val) => handleControlChange('table', val)} disabled={isLabOnly}>
                    <SelectTrigger id="color-table-select" className="h-8 w-16 text-xs">
                      <SelectValue placeholder="Table" />
                    </SelectTrigger>
                    <SelectContent>
                      {isLabOnly ? (
                        <SelectItem value={labConditions.table}>{labConditions.table}</SelectItem>
                      ) : (
                        astmTables
                          .filter((value, index, self) => 
                            index === self.findIndex((t) => t.table_number === value.table_number)
                          )
                          .sort((a, b) => a.table_number - b.table_number)
                          .map(t => (
                            <SelectItem key={t.id} value={String(t.table_number)}>
                              {t.table_number}
                            </SelectItem>
                          ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  <Label htmlFor="color-delta-e-select" className="text-xs">ΔE Method</Label>
                  <Select value={deltaE || 'dE76'} onValueChange={(val) => handleControlChange('deltaE', val)}>
                    <SelectTrigger id="color-delta-e-select" className="h-8 w-28 text-xs">
                      <SelectValue placeholder="ΔE Method" />
                    </SelectTrigger>
                     <SelectContent>
                       {getDeltaEOptions().map(option => (
                         <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                       ))}
                     </SelectContent>
                  </Select>
                </div>
              </div>

              {hasChanges && (
                <div className="flex items-center gap-2">
                  <span className="text-primary">*</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={resetToDefaults}
                    className="h-7 px-2 text-xs"
                    disabled={false}
                    title="Reset to defaults"
                  >
                    Reset
                  </Button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Toggle Button - shows only when closed and measurement exists */}
      {!isOpen && !isExiting && measurementLoaded && !loading && (
        <button
          onClick={() => {
            if (!measurementLoaded || loading) return;
            try {
              if (!isOpen && wrapperRef.current) {
                const rect = wrapperRef.current.getBoundingClientRect();
                setOverlayPos({ top: rect.top, right: Math.max(0, window.innerWidth - rect.right) });
              }
              console.info('ColorSettingsBox: toggle', { open: !isOpen });
            } catch (e) {
              console.error('ColorSettingsBox toggle error', e);
            }
            setIsOpen(!isOpen);
          }}
          aria-expanded={isOpen}
          disabled={!measurementLoaded || loading}
          className={`relative z-50 flex-shrink-0 h-9 w-8 flex items-center justify-center bg-muted transition-colors border-r rounded-l-lg ${(!measurementLoaded || loading) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-muted/80'}`}
          title={isOpen ? 'Close measurement settings' : 'Open measurement settings'}
        >
          <motion.span
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="inline-block"
          >
            <ChevronLeft className="h-4 w-4" />
          </motion.span>
        </button>
      )}
    </motion.div>
  );
};

export default ColorSettingsBox;