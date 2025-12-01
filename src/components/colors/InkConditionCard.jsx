import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Edit2, Check, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useProfile } from '@/context/ProfileContext';
import { useInksData } from '@/context/InkContext';
import { useToast } from '@/hooks/use-toast';
import { calculateDeltaE } from '@/lib/deltaE';
import { useSearchParams } from 'react-router-dom';

const InkConditionCard = ({ 
  color,
  canEdit = false,
  onColorUpdate = null,
  onTabSwitch = null,
  isEditing = false,
  onEdit = null,
  importedSubstrate = null,
  onSubstrateMismatch = null,
  forcedPrintConditionId = null,
  selectedPrintConditionId = null,
  onSelectedPrintConditionIdChange = null,
  selectedPrintCondition = null,
  onSelectedPrintConditionChange = null,
  editOriginalPrintConditionId = null,
  onCommitSelection = null,
  disableMismatchChecks = false,
}) => {
  const [inkConditionData, setInkConditionData] = useState(null);
  const [printConditions, setPrintConditions] = useState([]);
  const [selectedConditionDetails, setSelectedConditionDetails] = useState(null);
  const [substrateDeltaE, setSubstrateDeltaE] = useState(null);
  const [substrateConditionName, setSubstrateConditionName] = useState(null);
  const [substrateName, setSubstrateName] = useState(null);
  const [showMismatchDialog, setShowMismatchDialog] = useState(false);
  const [mismatchData, setMismatchData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [printConditionsLoading, setPrintConditionsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { profile } = useProfile();
  const { allInks } = useInksData();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();

  // Detect full-add mode from URL parameters
  const isFullAddMode = searchParams.get('mode') === 'full-add';

  // Compute if there are unsaved changes
  const hasUnsavedChanges = isEditing && selectedPrintConditionId !== editOriginalPrintConditionId;

  // Determine if this is an imported ink-based color workflow vs create-from-ink workflow
  // Check for indicators of imported colors (imported_tints suggests this came from import)
  const hasImportedIndicators = color.imported_tints || 
    (selectedPrintConditionId || forcedPrintConditionId);
  
  const isImportedInkBasedColor = Boolean(
    color.from_ink_condition_id && hasImportedIndicators
  );

  // Handle forced print condition ID to auto-configure new conditions
  useEffect(() => {
    if (forcedPrintConditionId && forcedPrintConditionId !== selectedPrintConditionId && onSelectedPrintConditionIdChange) {
      onSelectedPrintConditionIdChange(forcedPrintConditionId);
    }
  }, [forcedPrintConditionId, selectedPrintConditionId, onSelectedPrintConditionIdChange]);

  // Enhanced ink condition fetching that uses context first, then database fallback
  useEffect(() => {
    const fetchInkConditionData = async () => {
      if (!color?.from_ink_condition_id || !profile?.organization_id) {
        setLoading(false);
        return;
      }

      // First try to get ink condition from context (faster, optimistically updated)
      const inkFromContext = allInks.find(ink => 
        ink.conditions?.some(condition => condition.id === color.from_ink_condition_id)
      );
      
      if (inkFromContext) {
        const condition = inkFromContext.conditions.find(c => c.id === color.from_ink_condition_id);
        if (condition) {
          console.log('🚀 Using ink condition from context (optimistic):', condition.name);
          setInkConditionData({
            ...condition,
            inks: { id: inkFromContext.id, name: inkFromContext.name, organization_id: inkFromContext.organization_id }
          });
          setLoading(false);
          return;
        }
      }

      // Fallback to database query if not in context
      try {
        console.log('📡 Fetching ink condition from database (fallback):', color.from_ink_condition_id);
        const { data, error } = await supabase
          .from('ink_conditions')
          .select(`
            *,
            inks!inner(
              id,
              name,
              organization_id
            ),
            substrates!left(
              id,
              name
            )
          `)
          .eq('id', color.from_ink_condition_id)
          .eq('inks.organization_id', profile.organization_id)
          .single();

        if (error) throw error;
        setInkConditionData(data);
        
        // Fetch substrate condition name and substrate name separately if available
        if (data.substrate_condition) {
          console.log('Substrate condition value:', data.substrate_condition, 'Type:', typeof data.substrate_condition);
          
          // Check if substrate_condition is a UUID or a name
          const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.substrate_condition);
          console.log('Is substrate_condition a UUID?', isUUID);
          
          let substrateConditionData;
          let substrateError;
          
          if (isUUID) {
            // Query by ID if it's a UUID
            const result = await supabase
              .from('substrate_conditions')
              .select('id, name, substrate_id')
              .eq('id', data.substrate_condition)
              .maybeSingle();
            substrateConditionData = result.data;
            substrateError = result.error;
          } else {
            // Query by name if it's not a UUID
            const result = await supabase
              .from('substrate_conditions')
              .select('id, name, substrate_id')
              .eq('name', data.substrate_condition)
              .maybeSingle();
            substrateConditionData = result.data;
            substrateError = result.error;
          }
          
          console.log('Substrate condition query result:', substrateConditionData, 'Error:', substrateError);
          
          if (substrateError) {
            console.error('Error fetching substrate condition:', substrateError);
          }
          
          if (substrateConditionData) {
            setSubstrateConditionName(substrateConditionData.name);
            
            // Second query: Get substrate name if substrate_id exists
            if (substrateConditionData.substrate_id) {
              const { data: substrateData, error: substrateNameError } = await supabase
                .from('substrates')
                .select('name')
                .eq('id', substrateConditionData.substrate_id)
                .maybeSingle();
              
              if (substrateNameError) {
                console.error('Error fetching substrate name:', substrateNameError);
              }
              
              if (substrateData) {
                setSubstrateName(substrateData.name);
              }
            }
          } else {
            console.log('Substrate condition not found, setting fallback');
            setSubstrateConditionName('Unknown Condition');
          }
        }
      } catch (error) {
        console.error('Error fetching ink condition data:', error);
        toast({
          title: 'Error',
          description: 'Failed to fetch ink condition details.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchInkConditionData();
  }, [color?.from_ink_condition_id, profile?.organization_id, toast]);

  // Fetch print conditions (for imported ink-based colors)
  useEffect(() => {
    const fetchPrintConditions = async () => {
      if (!isImportedInkBasedColor || !profile?.organization_id) return;

      setPrintConditionsLoading(true);
      try {
        const { data, error } = await supabase
          .from('print_conditions')
          .select('*')
          .eq('organization_id', profile.organization_id)
          .order('name');

        if (error) throw error;
        setPrintConditions(data || []);
      } catch (error) {
        console.error('Error fetching print conditions:', error);
        toast({
          title: 'Error',
          description: 'Failed to fetch print conditions.',
          variant: 'destructive',
        });
      } finally {
        setPrintConditionsLoading(false);
      }
    };

    fetchPrintConditions();
  }, [isImportedInkBasedColor, profile?.organization_id, toast]);

  // Fetch missing print condition if selectedPrintConditionId is not in the list
  useEffect(() => {
    const fetchMissingPrintCondition = async () => {
      if (!selectedPrintConditionId || !isImportedInkBasedColor) return;
      
      // Check if the selected condition is already in our list
      const conditionExists = printConditions.some(pc => pc.id === selectedPrintConditionId);
      if (conditionExists) return;

      try {
        const { data, error } = await supabase
          .from('print_conditions')
          .select('*')
          .eq('id', selectedPrintConditionId)
          .single();

        if (error) throw error;
        
        // Add the missing condition to our list, deduplicating by ID
        setPrintConditions(prev => {
          const existing = prev.find(pc => pc.id === data.id);
          if (existing) return prev;
          return [...prev, data];
        });
        
        // Also update the selected print condition in parent state
        if (onSelectedPrintConditionChange) {
          onSelectedPrintConditionChange(data);
        }
      } catch (error) {
        console.error('Error fetching missing print condition:', error);
      }
    };

    fetchMissingPrintCondition();
  }, [selectedPrintConditionId, printConditions, isImportedInkBasedColor, onSelectedPrintConditionChange]);

  // Fetch selected print condition details and check substrate mismatch
  useEffect(() => {
    const fetchConditionDetails = async () => {
      if (disableMismatchChecks) {
        setSubstrateDeltaE(null);
        setMismatchData(null);
        onSubstrateMismatch?.(null);
        return;
      }

      // Allow mismatch detection in both workflows: imported and full-add mode
      const shouldCheckMismatch = (isImportedInkBasedColor && selectedPrintConditionId) || 
                                 (isFullAddMode && importedSubstrate?.lab && inkConditionData?.substrate_condition);

      if (!shouldCheckMismatch) {
        setSelectedConditionDetails(null);
        setSubstrateDeltaE(null);
        setMismatchData(null);
        onSubstrateMismatch?.(null);
        return;
      }

      try {
        // Handle full-add mode differently - compare imported substrate vs selected substrate condition
        if (isFullAddMode && importedSubstrate?.lab && inkConditionData?.substrate_condition) {
          // Get the selected substrate condition Lab values directly from the ink condition's substrate condition
          const { data: selectedSubstrateCondData } = await supabase
            .from('substrate_conditions')
            .select('l_value, a_value, b_value, id, name')
            .eq('id', inkConditionData.substrate_condition)
            .maybeSingle();
          
          if (selectedSubstrateCondData && selectedSubstrateCondData.l_value != null) {
            const selectedSubstrateLab = {
              L: selectedSubstrateCondData.l_value,
              a: selectedSubstrateCondData.a_value,
              b: selectedSubstrateCondData.b_value
            };
            
            const deltaE = calculateDeltaE(importedSubstrate.lab, selectedSubstrateLab);
            setSubstrateDeltaE(deltaE);
            
            console.log('Full-add substrate mismatch check:', {
              importedSubstrate: importedSubstrate.lab,
              selectedSubstrateCondition: selectedSubstrateLab,
              deltaE
            });
            
            if (deltaE > 1) {
              const mismatchInfo = {
                deltaE,
                importedSubstrate: importedSubstrate,
                substrateCondition: { 
                  id: selectedSubstrateCondData.id,
                  name: selectedSubstrateCondData.name,
                  lab: selectedSubstrateLab 
                }
              };
              setMismatchData(mismatchInfo);
              onSubstrateMismatch?.(mismatchInfo);
            } else {
              setMismatchData(null);
              onSubstrateMismatch?.(null);
            }
          } else {
            setSubstrateDeltaE(null);
            setMismatchData(null);
            onSubstrateMismatch?.(null);
          }
          return;
        }

        // Original logic for imported ink-based colors with print conditions
        const { data, error } = await supabase
          .from('print_conditions')
          .select('*')
          .eq('id', selectedPrintConditionId)
          .maybeSingle();

        if (error) throw error;
        setSelectedConditionDetails(data);

        // If no data returned, clear mismatch state gracefully
        if (!data) {
          setSubstrateDeltaE(null);
          setMismatchData(null);
          onSubstrateMismatch?.(null);
          return;
        }

        // Determine white point source based on mode
        let sourceSubstrate = null;

        if (isFullAddMode && inkConditionData?.substrate_condition) {
          // Full-add mode: use ink condition's substrate condition as white point
          const { data: inkSubstrateCondData } = await supabase
            .from('substrate_conditions')
            .select('l_value, a_value, b_value')
            .eq('id', inkConditionData.substrate_condition)
            .maybeSingle();
          
          if (inkSubstrateCondData && inkSubstrateCondData.l_value != null) {
            sourceSubstrate = {
              lab: {
                L: inkSubstrateCondData.l_value,
                a: inkSubstrateCondData.a_value,
                b: inkSubstrateCondData.b_value
              }
            };
          }
        } else if (importedSubstrate?.lab) {
          // Imported mode: use imported substrate
          sourceSubstrate = importedSubstrate;
        }
        
        // Check for substrate mismatch - get print condition's substrate condition Lab
        if (sourceSubstrate?.lab && data?.substrate_condition) {
          // Fetch print condition's substrate condition Lab values
          const { data: substrateCondData } = await supabase
            .from('substrate_conditions')
            .select('l_value, a_value, b_value')
            .eq('id', data.substrate_condition)
            .maybeSingle();
          
          if (substrateCondData && substrateCondData.l_value != null) {
            const printConditionSubstrateLab = {
              L: substrateCondData.l_value,
              a: substrateCondData.a_value,
              b: substrateCondData.b_value
            };
            const deltaE = calculateDeltaE(sourceSubstrate.lab, printConditionSubstrateLab);
            setSubstrateDeltaE(deltaE);
            
            console.log('Substrate mismatch check:', {
              mode: isFullAddMode ? 'full-add' : 'imported',
              sourceSubstrate: sourceSubstrate.lab,
              printConditionSubstrate: printConditionSubstrateLab,
              deltaE
            });
            
            if (deltaE > 1) {
              const mismatchInfo = {
                deltaE,
                importedSubstrate: sourceSubstrate,
                printCondition: { ...data, lab: printConditionSubstrateLab }
              };
              setMismatchData(mismatchInfo);
              onSubstrateMismatch?.(mismatchInfo);
            } else {
              setMismatchData(null);
              onSubstrateMismatch?.(null);
            }
          } else {
            // No substrate condition Lab - fallback to print condition Lab
            if (data?.lab) {
              const deltaE = calculateDeltaE(sourceSubstrate.lab, data.lab);
              setSubstrateDeltaE(deltaE);
              
              if (deltaE > 1) {
                const mismatchInfo = {
                  deltaE,
                  importedSubstrate: sourceSubstrate,
                  printCondition: data
                };
                setMismatchData(mismatchInfo);
                onSubstrateMismatch?.(mismatchInfo);
              } else {
                setMismatchData(null);
                onSubstrateMismatch?.(null);
              }
            }
          }
        } else {
          // Missing data: clear mismatch and deltaE to avoid flicker
          setSubstrateDeltaE(null);
          setMismatchData(null);
          onSubstrateMismatch?.(null);
        }
      } catch (error) {
        console.warn('[InkConditionCard] print condition fetch failed:', error);
        // Silently clear state to avoid noisy toasts
        setSelectedConditionDetails(null);
        setSubstrateDeltaE(null);
        setMismatchData(null);
        onSubstrateMismatch?.(null);
      }
    };

    fetchConditionDetails();
  }, [selectedPrintConditionId, isImportedInkBasedColor, isFullAddMode, inkConditionData, color, toast, importedSubstrate, disableMismatchChecks]);

  const handlePrintConditionChange = (printConditionId) => {
    if (onSelectedPrintConditionIdChange) {
      onSelectedPrintConditionIdChange(printConditionId);
    }
  };

  const handleShowMismatchDialog = () => {
    console.log('InkConditionCard.handleShowMismatchDialog', { hasMismatchData: !!mismatchData, mismatchData });
    if (mismatchData) {
      setShowMismatchDialog(true);
    }
  };

  const handleCloseMismatchDialog = () => {
    setShowMismatchDialog(false);
  };

  const handleAdaptSubstrate = async () => {
    if (selectedConditionDetails && onColorUpdate) {
      try {
        // Update color with print condition's substrate LAB values
        const updates = {
          lab_l: selectedConditionDetails.lab.L,
          lab_a: selectedConditionDetails.lab.a,
          lab_b: selectedConditionDetails.lab.b,
        };

        await onColorUpdate(updates);
        setShowMismatchDialog(false);
        setSubstrateDeltaE(null);
        setMismatchData(null);
        
        toast({
          title: 'Success',
          description: 'Color adapted to print condition substrate.',
        });
      } catch (error) {
        console.error('Error adapting substrate:', error);
        toast({
          title: 'Error',
          description: 'Failed to adapt substrate.',
          variant: 'destructive',
        });
      }
    }
  };

  const handleCreateNewCondition = async (name, mismatchInfo) => {
    console.log('InkConditionCard.handleCreateNewCondition called', { name, mismatchInfo, hasOnTabSwitch: !!onTabSwitch });
    if (onTabSwitch) {
      // Create a new print condition tab with comprehensive data - DO NOT AUTO-SWITCH
      const newTabId = `new-print-condition-${Date.now()}`;
      const tabData = {
        id: newTabId,
        label: 'Print Condition',
        type: 'new-print-condition',
        isAlert: true, // Mark as alert tab for red styling
        alertColor: 'red',
        prePopulatedData: {
          // Copy all settings from selected print condition, with fallbacks
          print_process: mismatchInfo?.printCondition?.print_process || selectedConditionDetails?.print_process || color?.print_process || null,
          substrate_type_id: mismatchInfo?.printCondition?.substrate_type_id || selectedConditionDetails?.substrate_type_id || null,
          substrate_material_id: mismatchInfo?.printCondition?.substrate_material_id || selectedConditionDetails?.substrate_material_id || null,
          // Normalize and include both keys for compatibility  
          print_side: mismatchInfo?.printCondition?.printing_side || mismatchInfo?.printCondition?.print_side || selectedConditionDetails?.printing_side || selectedConditionDetails?.print_side || color?.print_side || null,
          printing_side: mismatchInfo?.printCondition?.printing_side || mismatchInfo?.printCondition?.print_side || selectedConditionDetails?.printing_side || selectedConditionDetails?.print_side || color?.print_side || null,
          pack_type: mismatchInfo?.printCondition?.pack_type || selectedConditionDetails?.pack_type || null,
          // Extract substrate data from imported color
          substrate_type: color?.substrate_type,
          material_type: color?.material_type,
          // Override with imported substrate data, with fallbacks
          spectral_data: mismatchInfo?.importedSubstrate?.spectral_data || importedSubstrate?.spectral_data || null,
          lab: mismatchInfo?.importedSubstrate?.lab || importedSubstrate?.lab || (color?.lab_l != null && color?.lab_a != null && color?.lab_b != null ? { L: color.lab_l, a: color.lab_a, b: color.lab_b } : null),
          color_hex: mismatchInfo?.importedSubstrate?.colorHex || importedSubstrate?.colorHex || color?.hex || null,
          // Clear fields that should be user-input
          name: '', // BLANK for user input
          version: '',
          // Organization context
          organizationId: color?.organization_id,
          // Mark name as required
          requiredFields: ['name']
        }
      };
      
      console.log('Creating new print condition tab from InkConditionCard:', tabData);
      onTabSwitch(newTabId, tabData, false); // false = don't auto-switch
    } else {
      console.warn('InkConditionCard.handleCreateNewCondition - onTabSwitch missing');
    }
    setShowMismatchDialog(false);
  };


  if (loading || (isImportedInkBasedColor && printConditionsLoading)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {isImportedInkBasedColor ? 'Print Condition Info' : 'Ink Condition Settings'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse">
            <div className="grid grid-cols-6 gap-4">
              {!isImportedInkBasedColor && <div className="col-span-2 h-10 bg-muted rounded"></div>}
              <div className={`${isImportedInkBasedColor ? 'col-span-6' : 'col-span-4'} h-10 bg-muted rounded`}></div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Edit mode handlers
  const handleEdit = () => {
    if (onEdit) onEdit();
  };

  const handleCancel = () => {
    // Revert to the original selection
    if (onSelectedPrintConditionIdChange && editOriginalPrintConditionId !== null) {
      onSelectedPrintConditionIdChange(editOriginalPrintConditionId);
    }
    if (onEdit) onEdit(); // Exit edit mode
  };

  const handleSave = async () => {
    if (!hasUnsavedChanges) return;
    
    setSaving(true);
    try {
      // Commit the current selection as the new baseline
      if (onCommitSelection) {
        await onCommitSelection();
      }
      if (onEdit) onEdit(); // Exit edit mode

      toast({
        title: 'Success',
        description: 'Print condition selection saved.',
      });
    } catch (error) {
      console.error('Error saving:', error);
      toast({
        title: 'Error',
        description: 'Failed to save changes.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  // Track changes to enable save button
  const handlePrintConditionChangeWithTracking = (printConditionId) => {
    handlePrintConditionChange(printConditionId);
  };

  // For imported ink-based colors, show print condition dropdown
  if (isImportedInkBasedColor) {
    return (
      <>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="text-xl font-semibold text-gray-700">Print Condition Info</h3>
            {canEdit && (
              <div className="flex gap-2">
                {!isEditing ? (
                  <button
                    type="button"
                    onClick={handleEdit}
                    className="w-8 h-8 rounded-full bg-blue-500 hover:bg-blue-600 text-white flex items-center justify-center transition-colors"
                    title="Edit this section"
                    aria-label="Edit this section"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handleCancel}
                      disabled={saving}
                      className="w-8 h-8 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-colors"
                      title="Cancel changes"
                      aria-label="Cancel changes"
                    >
                      <X className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={!hasUnsavedChanges || saving}
                      className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                        hasUnsavedChanges 
                          ? 'bg-green-500 hover:bg-green-600 text-white' 
                          : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      }`}
                      title="Save changes"
                      aria-label="Save changes"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>
            )}
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Print Condition Selection */}
              <div className="space-y-2">
                <Label htmlFor="print-condition">Print Condition Name</Label>
                <Select
                  value={selectedPrintConditionId || ''}
                  onValueChange={handlePrintConditionChangeWithTracking}
                  disabled={!isEditing}
                >
                  <SelectTrigger id="print-condition">
                    <SelectValue placeholder="Select a print condition..." />
                  </SelectTrigger>

                  <SelectContent>
                    {printConditions.map((condition) => (
                      <SelectItem key={condition.id} value={condition.id}>
                        {condition.name}{condition.version ? ` - Version ${condition.version}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Substrate Mismatch Badge */}
              {typeof substrateDeltaE === 'number' && substrateDeltaE > 1 && (
                <div className="flex items-center gap-2">
                  <Badge variant="destructive" className="text-xs">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    Substrate Mismatch (ΔE: {substrateDeltaE.toFixed(1)})
                  </Badge>
                </div>
              )}

              {/* Print Condition Details */}
              {selectedConditionDetails && (
                <div className="pt-4 border-t space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">Selected Print Condition Details</Label>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <Label className="text-xs font-medium">Process:</Label>
                      <div className="text-muted-foreground">{selectedConditionDetails.print_process || 'N/A'}</div>
                    </div>
                    <div>
                      <Label className="text-xs font-medium">Pack Type:</Label>
                      <div className="text-muted-foreground">{selectedConditionDetails.pack_type || 'N/A'}</div>
                    </div>
                    {selectedConditionDetails.lab && (
                      <div className="col-span-2">
                        <Label className="text-xs font-medium">Print Condition Substrate LAB:</Label>
                        <div className="font-mono text-xs text-muted-foreground">
                          L:{selectedConditionDetails.lab.L?.toFixed(1)} 
                          a:{selectedConditionDetails.lab.a?.toFixed(1)} 
                          b:{selectedConditionDetails.lab.b?.toFixed(1)}
                        </div>
                      </div>
                    )}
                    
                    {/* Show imported substrate comparison if available */}
                    {color?.lab_l !== null && color?.lab_a !== null && color?.lab_b !== null && substrateDeltaE !== null && (
                      <div className="col-span-2 pt-2 border-t">
                        <Label className="text-xs font-medium">Imported Substrate LAB:</Label>
                        <div className="font-mono text-xs text-muted-foreground">
                          L:{color.lab_l?.toFixed(1)} 
                          a:{color.lab_a?.toFixed(1)} 
                          b:{color.lab_b?.toFixed(1)}
                        </div>
                         <div className="text-xs text-muted-foreground mt-1">
                           ΔE: {substrateDeltaE.toFixed(1)} 
                           {typeof substrateDeltaE === 'number' && substrateDeltaE > 1 && <span className="text-amber-600 ml-1">(Significant difference)</span>}
                         </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

      </>
    );
  }

  // For create-from-ink colors, show traditional ink condition info
  if (!inkConditionData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Ink Condition Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            No ink condition data found
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
          <CardHeader>
            <CardTitle className="text-lg">Ink Condition Settings</CardTitle>
          </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Row 1: Ink Condition Name and Version */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="condition-name">Ink Condition Name</Label>
              <Input
                id="condition-name"
                value={inkConditionData.name || ''}
                disabled
                className="bg-muted"
              />
            </div>
            <div>
              <Label htmlFor="version">Version</Label>
              <Input
                id="version"
                value={inkConditionData.version || ''}
                disabled
                className="bg-muted"
              />
            </div>
          </div>

          {/* Row 2: Substrate, Substrate Condition, and Ink Curve */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="substrate">Substrate</Label>
              <Input
                id="substrate"
                value={substrateName || inkConditionData.substrates?.name || 'N/A'}
                disabled
                className="bg-muted"
              />
            </div>
            <div>
              <Label htmlFor="substrate-condition">Substrate Condition</Label>
              <Input
                id="substrate-condition"
                value={substrateConditionName || 'N/A'}
                disabled
                className="bg-muted"
              />
            </div>
            <div>
              <Label htmlFor="ink-curve">Ink Curve</Label>
              <Input
                id="ink-curve"
                value={(() => {
                  const curve = inkConditionData.ink_curve;
                  switch (curve) {
                    case 'as_measured': return 'As Measured';
                    case 'linearized': return 'Linearized';
                    case 'optimized': return 'Optimized';
                    default: return curve || 'As Measured';
                  }
                })()}
                disabled
                className="bg-muted"
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default InkConditionCard;