import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useProfile } from '@/context/ProfileContext';
import { useToast } from '@/hooks/use-toast';
import { calculateDeltaE } from '@/lib/deltaE';
import { useSpectralCalculations } from '@/hooks/useSpectralCalculations';

const PrintConditionPicker = ({
  selectedPrintConditionId,
  onPrintConditionChange,
  importedSubstrate,
  onSubstrateMismatch,
  canEdit = true
}) => {
  const [printConditions, setPrintConditions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedConditionDetails, setSelectedConditionDetails] = useState(null);
  const [substrateDeltaE, setSubstrateDeltaE] = useState(null);
  const { profile } = useProfile();
const { toast } = useToast();

  // Derive LAB for imported substrate if missing using spectral data
  const { lab: computedImportedLab } = useSpectralCalculations(importedSubstrate?.spectralData || importedSubstrate?.spectral_data);
  const effectiveImportedLab = React.useMemo(() => {
    if (importedSubstrate?.lab && typeof importedSubstrate.lab.L === 'number') return importedSubstrate.lab;
    if (computedImportedLab && typeof computedImportedLab.L === 'number') return computedImportedLab;
    if (
      importedSubstrate &&
      importedSubstrate.lab_l != null &&
      importedSubstrate.lab_a != null &&
      importedSubstrate.lab_b != null
    ) {
      return { L: importedSubstrate.lab_l, a: importedSubstrate.lab_a, b: importedSubstrate.lab_b };
    }
    return null;
  }, [importedSubstrate, computedImportedLab]);
  // Derive LAB for selected print condition substrate (fallback to spectral)
  const { lab: pcComputedLab } = useSpectralCalculations(
    selectedConditionDetails?.spectralData || selectedConditionDetails?.spectral_data
  );

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

  // Fetch available print conditions
  useEffect(() => {
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
  }, [profile?.organization_id, toast]);

  // Fetch selected print condition details
  useEffect(() => {
    const fetchConditionDetails = async () => {
      if (!selectedPrintConditionId) {
        setSelectedConditionDetails(null);
        setSubstrateDeltaE(null);
        onSubstrateMismatch?.(null);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('print_conditions')
          .select('*')
          .eq('id', selectedPrintConditionId)
          .maybeSingle();

        if (error) throw error;
        setSelectedConditionDetails(data || null);
      } catch (error) {
        console.warn('[PrintConditionPicker] print condition fetch failed:', error);
        setSelectedConditionDetails(null);
        setSubstrateDeltaE(null);
        onSubstrateMismatch?.(null);
      }
    };

    fetchConditionDetails();
  }, [selectedPrintConditionId, onSubstrateMismatch, toast]);

  // Compute substrate mismatch once both LABs are available
  useEffect(() => {
    if (!selectedConditionDetails) {
      setSubstrateDeltaE(null);
      return;
    }

    if (effectiveImportedLab && effectivePCSubstrateLab) {
      const deltaE = calculateDeltaE(effectiveImportedLab, effectivePCSubstrateLab, 'dE00');
      setSubstrateDeltaE(deltaE);
      if (deltaE > 1) {
        onSubstrateMismatch?.({ deltaE, importedSubstrate, printCondition: selectedConditionDetails });
      } else {
        onSubstrateMismatch?.(null);
      }
    }
  }, [effectiveImportedLab, effectivePCSubstrateLab, selectedConditionDetails, onSubstrateMismatch, importedSubstrate]);

  const handleCreateNewPrintCondition = () => {
    // Store imported substrate data for transfer to new print condition
    if (importedSubstrate) {
      sessionStorage.setItem('importedSubstrateData', JSON.stringify({
        ...importedSubstrate,
        importedAt: Date.now()
      }));
    }
    // Navigate to create new print condition with substrate pre-populated
    window.open(`/print-conditions/new?fromImportedSubstrate=true`, '_blank');
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Print Condition</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse">
            <div className="h-10 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          Print Condition
          {substrateDeltaE > 1 && (
            <Badge variant="destructive" className="text-xs">
              <AlertTriangle className="w-3 h-3 mr-1" />
              Substrate Mismatch (ΔE: {substrateDeltaE.toFixed(1)})
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <div className="flex-1">
            <Select
              value={selectedPrintConditionId || ''}
              onValueChange={(value) => {
                if (value === 'create-new') {
                  handleCreateNewPrintCondition();
                } else {
                  onPrintConditionChange(value);
                }
              }}
              disabled={!canEdit}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a print condition..." />
              </SelectTrigger>
              <SelectContent>
                {printConditions.map((condition) => (
                  <SelectItem key={condition.id} value={condition.id}>
                    {condition.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {selectedConditionDetails && (
          <div className="space-y-2 text-sm text-muted-foreground border-t pt-4">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs font-medium">Process:</Label>
                <div>{selectedConditionDetails.print_process || 'N/A'}</div>
              </div>
              <div>
                <Label className="text-xs font-medium">Pack Type:</Label>
                <div>{selectedConditionDetails.pack_type || 'N/A'}</div>
              </div>
            </div>
            
            {selectedConditionDetails.lab && (
              <div>
                <Label className="text-xs font-medium">Substrate LAB:</Label>
                <div className="font-mono text-xs">
                  L:{selectedConditionDetails.lab.L?.toFixed(1)} 
                  a:{selectedConditionDetails.lab.a?.toFixed(1)} 
                  b:{selectedConditionDetails.lab.b?.toFixed(1)}
                </div>
              </div>
            )}

            {effectiveImportedLab && (
              <div>
                <Label className="text-xs font-medium">Imported Substrate LAB:</Label>
                <div className="font-mono text-xs">
                  L:{effectiveImportedLab.L?.toFixed(1)} 
                  a:{effectiveImportedLab.a?.toFixed(1)} 
                  b:{effectiveImportedLab.b?.toFixed(1)}
                </div>
              </div>
            )}

            {substrateDeltaE !== null && (
              <div>
                <Label className="text-xs font-medium">Substrate ΔE:</Label>
                <div className={`font-mono text-xs ${substrateDeltaE > 1 ? 'text-red-600 font-medium' : 'text-green-600'}`}>
                  {substrateDeltaE.toFixed(2)}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PrintConditionPicker;