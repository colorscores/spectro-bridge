import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useProfile } from '@/context/ProfileContext';
import { calculateDeltaE } from '@/lib/deltaE';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { AlertTriangle } from 'lucide-react';
import { spectralToLabASTME308 } from '@/lib/colorUtils';
import { useInkConditionColorBackfill } from '@/hooks/useInkConditionColorBackfill';

export default function InkConditionDetailsCard({
  inkConditionId,
  importedSubstrate,
  onSubstrateMismatch,
  onAdaptToPrintCondition,
  onCreateNewPrintCondition,
  canEdit = false
}) {
  const { profile } = useProfile();
  const { triggerColorBackfill, isBackfilling: isColorBackfilling } = useInkConditionColorBackfill();
  const [inkCondition, setInkCondition] = useState(null);
  const [printConditions, setPrintConditions] = useState([]);
  const [selectedPrintConditionId, setSelectedPrintConditionId] = useState('');
  const [selectedConditionDetails, setSelectedConditionDetails] = useState(null);
  const [substrateDeltaE, setSubstrateDeltaE] = useState(null);
  const [substrateAdaptationMode, setSubstrateAdaptationMode] = useState('adapt');
  const [isProcessing, setIsProcessing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [substrateConditionName, setSubstrateConditionName] = useState('');
  const lastDeltaRef = useRef(null);
  const lastMismatchRef = useRef(null);

  // Fast LAB calculation for imported substrate
  const effectiveImportedLab = useMemo(() => {
    if (importedSubstrate?.lab && typeof importedSubstrate.lab.L === 'number') return importedSubstrate.lab;
    if (
      importedSubstrate &&
      importedSubstrate.lab_l != null &&
      importedSubstrate.lab_a != null &&
      importedSubstrate.lab_b != null
    ) {
      return { L: importedSubstrate.lab_l, a: importedSubstrate.lab_a, b: importedSubstrate.lab_b };
    }
    // Only compute from spectral if absolutely necessary
    if (importedSubstrate?.spectral_data) {
      try {
        return spectralToLabASTME308(importedSubstrate.spectral_data);
      } catch (error) {
        console.warn('Failed to compute LAB from spectral data:', error);
      }
    }
    return null;
  }, [importedSubstrate]);


  // Fetch ink condition details with substrate condition name
  useEffect(() => {
    const fetchInkCondition = async () => {
      if (!inkConditionId || !profile?.organization_id) return;

      try {
        // Fetch ink condition with minimal data
        const { data, error } = await supabase
          .from('ink_conditions')
          .select(`
            id, name, version, ink_curve, substrate_condition, substrate_id,
            inks!inner (
              name,
              organization_id
            )
          `)
          .eq('id', inkConditionId)
          .eq('inks.organization_id', profile.organization_id)
          .maybeSingle();

        if (error) throw error;
        
        // Handle case when ink condition is not found
        if (!data) {
          setInkCondition(null);
          setLoading(false);
          return;
        }
        
        setInkCondition(data);

        // Fetch substrate condition name separately if needed
        if (data.substrate_condition) {
          const { data: substrateData, error: substrateError } = await supabase
            .from('substrate_conditions')
            .select(`
              name,
              substrates (name)
            `)
            .eq('id', data.substrate_condition)
            .maybeSingle();
          
          if (substrateError) {
            console.warn('Failed to fetch substrate condition details:', substrateError);
            setSubstrateConditionName('Unknown Substrate');
          } else if (substrateData) {
            const substrateName = substrateData.substrates?.name || 'Unknown Substrate';
            const conditionName = substrateData.name || 'Unknown Condition';
            setSubstrateConditionName(`${substrateName} - ${conditionName}`);
          }
        }
      } catch (error) {
        console.error('Error fetching ink condition:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchInkCondition();
  }, [inkConditionId, profile?.organization_id]);

  // Fetch available print conditions only when needed
  useEffect(() => {
    const fetchPrintConditions = async () => {
      if (!profile?.organization_id || !canEdit) return;

      try {
        const { data, error } = await supabase
          .from('print_conditions')
          .select('id, name')
          .eq('organization_id', profile.organization_id)
          .order('name');

        if (error) throw error;
        setPrintConditions(data || []);
      } catch (error) {
        console.error('Error fetching print conditions:', error);
      }
    };

    fetchPrintConditions();
  }, [profile?.organization_id, canEdit]);

  // Fetch selected print condition details and check for substrate mismatch
  useEffect(() => {
    const fetchConditionDetails = async () => {
      if (!selectedPrintConditionId) {
        setSelectedConditionDetails(null);
        setSubstrateDeltaE(null);
        // Clear mismatch once when unselecting
        if (lastMismatchRef.current) {
          onSubstrateMismatch?.(null);
          lastMismatchRef.current = false;
          lastDeltaRef.current = null;
        }
        return;
      }

      try {
        const { data, error } = await supabase
          .from('print_conditions')
          .select(`
            id, name, process, pack_type,
            substrate_conditions (
              name,
              l_value,
              a_value,
              b_value
            )
          `)
          .eq('id', selectedPrintConditionId)
          .single();

        if (error) throw error;
        setSelectedConditionDetails(data);

        // Check for substrate mismatch if importedSubstrate is provided
        if (effectiveImportedLab && data.substrate_conditions) {
          const conditionLab = {
            L: data.substrate_conditions.l_value,
            a: data.substrate_conditions.a_value,
            b: data.substrate_conditions.b_value
          };

          const deltaE = calculateDeltaE(effectiveImportedLab, conditionLab);
          setSubstrateDeltaE(deltaE);

          const mismatch = deltaE > 1;
          const deltaChanged =
            lastDeltaRef.current == null || Math.abs(deltaE - (lastDeltaRef.current || 0)) > 0.01;

          if (mismatch !== lastMismatchRef.current || (mismatch && deltaChanged)) {
            if (mismatch) {
              onSubstrateMismatch?.({ deltaE, importedSubstrate, printCondition: data });
            } else {
              onSubstrateMismatch?.(null);
            }
            lastMismatchRef.current = mismatch;
            lastDeltaRef.current = mismatch ? deltaE : 0;
          }
        }
      } catch (error) {
        console.error('Error fetching print condition details:', error);
      }
    };

    fetchConditionDetails();
  }, [selectedPrintConditionId, effectiveImportedLab]);

  const handlePrintConditionChange = (value) => {
    setSelectedPrintConditionId(value);
  };

  const handleSaveMismatch = async () => {
    if (!selectedPrintConditionId) return;
    
    setIsProcessing(true);
    try {
      if (substrateAdaptationMode === 'adapt') {
        await onAdaptToPrintCondition?.(selectedPrintConditionId);
      } else {
        // For creating new, we pass the selected condition details
        await onCreateNewPrintCondition?.(selectedConditionDetails);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">Loading ink condition details...</div>
        </CardContent>
      </Card>
    );
  }

  if (!inkCondition) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">Ink condition not found</div>
        </CardContent>
      </Card>
    );
  }

  const curveDisplayName = (() => {
    switch (inkCondition.ink_curve) {
      case 'as_measured': return 'As Measured';
      case 'linearized': return 'Linearized';
      case 'optimized': return 'Optimized';
      default: return inkCondition.ink_curve || 'As Measured';
    }
  })();


  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Ink Condition Info</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Ink Condition Details - Grid Layout */}
          <div className="space-y-4">
            {/* First row: Condition Name and Version */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                <Label htmlFor="condition-name">Ink Condition Name</Label>
                <Input
                  id="condition-name"
                  value={inkCondition.name}
                  disabled
                  className="font-medium"
                />
              </div>
              <div className="lg:col-span-1">
                <Label htmlFor="version">Version</Label>
                <Input
                  id="version"
                  value={inkCondition.version || ''}
                  disabled
                />
              </div>
            </div>

            {/* Second row: Substrate & Condition and Ink Curve */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="substrate-condition">Substrate & Condition</Label>
                <Input
                  id="substrate-condition"
                  value={substrateConditionName || 'Loading...'}
                  disabled
                  className="font-medium"
                />
              </div>
              <div>
                <Label htmlFor="ink-curve">Ink Curve</Label>
                <Select value={inkCondition.ink_curve || 'as_measured'} disabled>
                  <SelectTrigger id="ink-curve">
                    <SelectValue>{curveDisplayName}</SelectValue>
                  </SelectTrigger>
                </Select>
              </div>
            </div>
          </div>

          {/* Debug Tools - Color Fix Button */}
          <div className="border-t pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Debug Tools</p>
                <p className="text-xs text-muted-foreground">Fix color calculation and substrate association</p>
              </div>
              <Button
                onClick={() => triggerColorBackfill(inkConditionId)}
                disabled={isColorBackfilling}
                size="sm"
                variant="outline"
              >
                {isColorBackfilling ? "Recalculating..." : "Fix Color Display"}
              </Button>
            </div>
          </div>

          {/* Print Condition Selection */}
          {canEdit && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Compare with Print Condition</label>
                <Select value={selectedPrintConditionId} onValueChange={handlePrintConditionChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select print condition..." />
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

              {/* Substrate Mismatch Card */}
              {substrateDeltaE !== null && substrateDeltaE > 1 && (
                <Card className="border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 space-y-3">
                        <div>
                          <h4 className="font-medium text-yellow-800 dark:text-yellow-200">
                            Substrate Mismatch Detected
                          </h4>
                          <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                            The imported substrate differs from the print condition substrate (ΔE: {substrateDeltaE.toFixed(2)}).
                          </p>
                        </div>
                        
                        <RadioGroup 
                          value={substrateAdaptationMode} 
                          onValueChange={setSubstrateAdaptationMode}
                          className="space-y-2"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="adapt" id="adapt" />
                            <Label htmlFor="adapt" className="text-sm font-normal cursor-pointer">
                              Adapt to print condition substrate
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="new" id="new" />
                            <Label htmlFor="new" className="text-sm font-normal cursor-pointer">
                              Create new print condition
                            </Label>
                          </div>
                        </RadioGroup>

                        <Button 
                          onClick={handleSaveMismatch}
                          disabled={isProcessing}
                          className="w-full"
                          size="sm"
                        >
                          {isProcessing ? 'Processing...' : 
                           substrateAdaptationMode === 'adapt' ? 'Adapt Substrate' : 'Create New Print Condition'}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Selected Print Condition Details */}
              {selectedConditionDetails && (
                <div className="pt-4 border-t">
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Print Condition Details</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Process:</span>
                        <div>{selectedConditionDetails.process}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Pack Type:</span>
                        <div>{selectedConditionDetails.pack_type}</div>
                      </div>
                    </div>
                    {selectedConditionDetails.substrate_conditions && (
                      <div>
                        <span className="text-muted-foreground">Substrate:</span>
                        <div className="font-medium">{selectedConditionDetails.substrate_conditions.name}</div>
                        <div className="text-xs text-muted-foreground">
                          L*: {selectedConditionDetails.substrate_conditions.l_value?.toFixed(2)} | 
                          a*: {selectedConditionDetails.substrate_conditions.a_value?.toFixed(2)} | 
                          b*: {selectedConditionDetails.substrate_conditions.b_value?.toFixed(2)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

    </>
  );
}