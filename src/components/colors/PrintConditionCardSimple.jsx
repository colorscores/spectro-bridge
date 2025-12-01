import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useProfile } from '@/context/ProfileContext';
import { useToast } from '@/hooks/use-toast';
import { calculateDeltaE } from '@/lib/deltaE';
import SubstrateMismatchCard from '@/components/inks/SubstrateMismatchCard';
import CardHeader from '@/components/admin/my-company/CardHeader';
// Removed useSpectralCalculations to avoid dispatcher errors
import { storeImportedSubstrateData } from '@/utils/substrateDataTransfer';

const PrintConditionCardSimple = ({
  selectedPrintConditionId,
  onPrintConditionChange,
  canEdit = true,
  importedSubstrate = null, // { lab, colorHex }
  standardType,
  onSubstrateMismatch = null,
  onAdaptToPrintCondition = null,
  onCreateNewPrintCondition = null,
  disableMismatchChecks = false,
  // Edit control props
  isEditMode = false,
  onEdit = null,
  onSave = null,
  onCancel = null,
  saving = false,
  parentConditionDetails = null, // Pre-fetched from parent
  // Performance optimization props
  disableFetch = false, // Prevent fetching when parent provides data
  preloadedPrintCondition = null, // Use preloaded print condition from parent
  preloadedPrintConditions = null, // Use preloaded print conditions list from parent
}) => {
  const [printConditions, setPrintConditions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedConditionDetails, setSelectedConditionDetails] = useState(null);
  const [substrateDeltaE, setSubstrateDeltaE] = useState(null);
  const [substrateAdaptationMode, setSubstrateAdaptationMode] = useState('adapt');
  const [orgDefaults, setOrgDefaults] = useState(null);
  const { profile } = useProfile();
  const { toast } = useToast();

  // Removed spectral-based LAB derivation to avoid dispatcher errors
  const computedImportedLab = null;
  const effectiveImportedLab = React.useMemo(() => {
    if (importedSubstrate?.lab && typeof importedSubstrate.lab.L === 'number') return importedSubstrate.lab;
    if (
      importedSubstrate &&
      importedSubstrate.lab_l != null &&
      importedSubstrate.lab_a != null &&
      importedSubstrate.lab_b != null
    ) {
      return { L: importedSubstrate.lab_l, a: importedSubstrate.lab_a, b: importedSubstrate.lab_b };
    }
    return null;
  }, [importedSubstrate]);

  // Removed spectral-based LAB derivation for selected PC substrate
  const pcComputedLab = null;

  const effectivePCSubstrateLab = React.useMemo(() => {
    const pc = selectedConditionDetails;
    const labObj = pc?.substrate_lab || pc?.lab;
    if (labObj && typeof labObj.L === 'number') return labObj;
    if (pc && pc.lab_l != null && pc.lab_a != null && pc.lab_b != null) {
      return { L: pc.lab_l, a: pc.lab_a, b: pc.lab_b };
    }
    if (pcComputedLab && typeof pcComputedLab.L === 'number') return pcComputedLab;
    return null;
  }, [selectedConditionDetails, pcComputedLab]);

  // Fetch organization defaults
  useEffect(() => {
    const fetchOrgDefaults = async () => {
      if (!profile?.organization_id) return;
      try {
        const { data, error } = await supabase
          .from('organizations')
          .select('default_delta_e')
          .eq('id', profile.organization_id)
          .single();
        if (error) throw error;
        setOrgDefaults(data);
      } catch (error) {
        console.error('Error fetching org defaults:', error);
      }
    };
    fetchOrgDefaults();
  }, [profile?.organization_id]);

  // Fetch available print conditions (skip if preloaded or disabled)
  useEffect(() => {
    if (disableFetch || preloadedPrintConditions) {
      if (preloadedPrintConditions) {
        setPrintConditions(preloadedPrintConditions);
      }
      setLoading(false);
      return;
    }

    const fetchPrintConditions = async () => {
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
        setLoading(false);
      }
    };

    if (profile?.organization_id) {
      fetchPrintConditions();
    }
  }, [profile?.organization_id, toast, disableFetch, preloadedPrintConditions]);

  // Fetch newly created print condition if it's not in the list
  useEffect(() => {
    const fetchMissingPrintCondition = async () => {
      if (!selectedPrintConditionId || printConditions.some(pc => pc.id === selectedPrintConditionId)) {
        return;
      }

      try {
        const { data, error } = await supabase
          .from('print_conditions')
          .select('*')
          .eq('id', selectedPrintConditionId)
          .single();

        if (error) throw error;
        
        // Add the new print condition to the list (dedupe by id to avoid duplicate keys)
        setPrintConditions(prev => {
          const exists = prev.some(pc => pc.id === data.id);
          return exists ? prev : [...prev, data];
        });
      } catch (error) {
        console.error('Error fetching missing print condition:', error);
      }
    };

    fetchMissingPrintCondition();
  }, [selectedPrintConditionId, printConditions]);

  // Fetch selected print condition details (skip if preloaded or disabled)
  useEffect(() => {
    if (disableMismatchChecks) {
      setSubstrateDeltaE(null);
      onSubstrateMismatch?.(null);
      return;
    }
    if (!selectedPrintConditionId || selectedPrintConditionId === 'create-new') {
      setSelectedConditionDetails(null);
      setSubstrateDeltaE(null);
      onSubstrateMismatch?.(null);
      return;
    }

    // Use preloaded print condition if available and matches ID
    if (disableFetch && preloadedPrintCondition?.id === selectedPrintConditionId) {
      setSelectedConditionDetails(preloadedPrintCondition);
      return;
    }

    // Use provided details if they match the selected ID
    if (parentConditionDetails?.id === selectedPrintConditionId) {
      setSelectedConditionDetails(parentConditionDetails);
      return;
    }

    // Skip fetch if disabled
    if (disableFetch) {
      return;
    }

    const fetchConditionDetails = async () => {
      try {
        const { data, error } = await supabase
          .from('print_conditions')
          .select('*')
          .eq('id', selectedPrintConditionId)
          .maybeSingle();

        if (error) throw error;
        setSelectedConditionDetails(data || null);
      } catch (error) {
        console.warn('[PrintConditionCardSimple] print condition fetch failed:', error);
        setSelectedConditionDetails(null);
        setSubstrateDeltaE(null);
        onSubstrateMismatch?.(null);
      }
    };

    fetchConditionDetails();
  }, [selectedPrintConditionId, disableMismatchChecks, parentConditionDetails, disableFetch, preloadedPrintCondition]);

  useEffect(() => {
    if (disableMismatchChecks || selectedPrintConditionId === 'create-new') {
      setSubstrateDeltaE(null);
      onSubstrateMismatch?.(null);
      return;
    }
    if (effectiveImportedLab && effectivePCSubstrateLab) {
      const deltaEMethod = orgDefaults?.default_delta_e || 'dE00';
      const deltaE = calculateDeltaE(effectiveImportedLab, effectivePCSubstrateLab, deltaEMethod);
      setSubstrateDeltaE(deltaE);
      if (deltaE > 1) {
        const mismatchInfo = {
          deltaE,
          importedSubstrate: { ...(importedSubstrate || {}), lab: effectiveImportedLab },
          printCondition: { ...(selectedConditionDetails || {}), lab: effectivePCSubstrateLab }
        };
        onSubstrateMismatch?.(mismatchInfo);
      } else {
        onSubstrateMismatch?.(null);
      }
    } else {
      setSubstrateDeltaE(null);
    }
  }, [effectiveImportedLab, effectivePCSubstrateLab, disableMismatchChecks, onSubstrateMismatch, importedSubstrate, selectedConditionDetails, orgDefaults]);


  const handleCreateNewPrintCondition = () => {
    // Navigate to create new print condition
    window.open('/print-conditions/new?fromInkColor=true', '_blank');
  };
  const handleAdaptSubstrate = async () => {
    if (onAdaptToPrintCondition) {
      await onAdaptToPrintCondition();
    }
  };

  const handleCreateNewCondition = async (name, mismatchInfo) => {
    if (onCreateNewPrintCondition) {
      await onCreateNewPrintCondition(name, mismatchInfo);
    }
  };

  // Don't show print condition picker for master colors
  if (standardType?.toLowerCase() === 'master') {
    return null;
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="animate-pulse space-y-4">
            <div className="h-10 bg-gray-200 rounded"></div>
            <div className="h-10 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Print Condition Settings"
        isEditing={isEditMode}
        showEdit={onEdit && canEdit}
        onEdit={onEdit}
        onSave={onSave}
        onCancel={onCancel}
        saving={saving}
        canSave={true}
        editDisabled={!canEdit}
      />
      <CardContent className="pt-0 space-y-4">
        {/* Print Condition and Ink Curve in same row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Print Condition Selection */}
          <div className="space-y-2">
            <Label htmlFor="print-condition">Print Condition</Label>
            <div className="flex gap-2">
              <div className="flex-1">
                <Select
                  value={selectedPrintConditionId || ''}
                onValueChange={(value) => {
                    if (value === 'none') {
                      onPrintConditionChange(null, null);
                    } else {
                      const record = printConditions.find(pc => pc.id === value) || selectedConditionDetails;
                      onPrintConditionChange(value, record);
                    }
                  }}
                  disabled={!canEdit || !isEditMode}
                >
                  <SelectTrigger id="print-condition">
                    <SelectValue placeholder="Select a print condition..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {Array.from(new Map(printConditions.map(pc => [pc.id, pc])).values()).map((condition) => (
                      <SelectItem key={condition.id} value={condition.id}>
                        {condition.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Ink Curve - Fixed to "As Measured" */}
          <div className="space-y-2">
            <Label htmlFor="ink-curve">Ink Curve</Label>
            <Input
              id="ink-curve"
              value="As Measured"
              readOnly
              disabled
              className="bg-muted text-muted-foreground cursor-not-allowed"
            />
          </div>
        </div>


        {/* Print Condition Details */}
        {selectedConditionDetails && (
          <div className="pt-4 border-t space-y-2">
            <Label className="text-sm font-medium text-muted-foreground">Selected Print Condition Details</Label>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <Label className="text-xs font-medium">Process:</Label>
                <div className="text-muted-foreground">{selectedConditionDetails.print_process || 'N/A'}</div>
              </div>
              <div>
                <Label className="text-xs font-medium">Pack Type:</Label>
                <div className="text-muted-foreground">{selectedConditionDetails.pack_type || 'N/A'}</div>
              </div>
              {effectivePCSubstrateLab && (
                <div>
                  <Label className="text-xs font-medium">Substrate LAB:</Label>
                  <div className="font-mono text-xs text-muted-foreground">
                    L:{effectivePCSubstrateLab.L?.toFixed(1)} 
                    a:{effectivePCSubstrateLab.a?.toFixed(1)} 
                    b:{effectivePCSubstrateLab.b?.toFixed(1)}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>

    </Card>
  );
};

export default PrintConditionCardSimple;