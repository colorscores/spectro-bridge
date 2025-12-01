import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Plus } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useProfile } from '@/context/ProfileContext';
import { useToast } from '@/hooks/use-toast';
import { calculateDeltaE } from '@/lib/deltaE';

const PrintConditionCard = ({ 
  color, 
  canEdit = false,
  onPrintConditionChange,
  onSubstrateMismatch,
  importedSubstrate 
}) => {
  const [printConditions, setPrintConditions] = useState([]);
  const [printProcesses, setPrintProcesses] = useState([]);
  const [packTypes, setPackTypes] = useState([]);
  const [substrateTypes, setSubstrateTypes] = useState([]);
  const [substrateMaterials, setSubstrateMaterials] = useState([]);
  const [selectedPrintCondition, setSelectedPrintCondition] = useState(null);
  const [selectedPrintConditionId, setSelectedPrintConditionId] = useState('');
  const [substrateDeltaE, setSubstrateDeltaE] = useState(null);
  const [loading, setLoading] = useState(true);
  const { profile } = useProfile();
  const { toast } = useToast();

  // Fetch all dropdown data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [
          printConditionsRes,
          printProcessesRes,
          packTypesRes,
          substrateTypesRes,
          substrateMaterialsRes
        ] = await Promise.all([
          supabase
            .from('print_conditions')
            .select('*')
            .eq('organization_id', profile?.organization_id)
            .order('name'),
          supabase
            .from('print_processes')
            .select('*')
            .order('name'),
          supabase
            .from('pack_types')
            .select('*')
            .order('name'),
          supabase
            .from('substrate_types')
            .select('id, name')
            .order('name'),
          supabase
            .from('substrate_materials')
            .select('id, name, substrate_type_id')
            .order('name')
        ]);

        if (printConditionsRes.error) throw printConditionsRes.error;
        if (printProcessesRes.error) throw printProcessesRes.error;
        if (packTypesRes.error) throw packTypesRes.error;
        if (substrateTypesRes.error) throw substrateTypesRes.error;
        if (substrateMaterialsRes.error) throw substrateMaterialsRes.error;

        setPrintConditions(printConditionsRes.data || []);
        setPrintProcesses(printProcessesRes.data || []);
        setPackTypes(packTypesRes.data || []);
        setSubstrateTypes(substrateTypesRes.data || []);
        setSubstrateMaterials(substrateMaterialsRes.data || []);
      } catch (error) {
        console.error('Error fetching dropdown data:', error);
        toast({
          title: 'Error',
          description: 'Failed to fetch print condition data.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    if (profile?.organization_id) {
      fetchData();
    }
  }, [profile?.organization_id, toast]);

  // Handle print condition selection and substrate mismatch detection
  const handlePrintConditionSelect = async (printConditionId) => {
    setSelectedPrintConditionId(printConditionId);

    if (!printConditionId) {
      setSelectedPrintCondition(null);
      setSubstrateDeltaE(null);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('print_conditions')
        .select('*')
        .eq('id', printConditionId)
        .maybeSingle();

      if (error) throw error;
      setSelectedPrintCondition(data);

      if (!data) {
        setSubstrateDeltaE(null);
        onSubstrateMismatch?.(null);
        return;
      }

      // Check substrate mismatch if we have imported substrate
      if (importedSubstrate?.lab && data?.lab) {
        const deltaE = calculateDeltaE(importedSubstrate.lab, data.lab, 'dE00');
        setSubstrateDeltaE(deltaE);

        // Trigger mismatch handling if deltaE > 1
        if (deltaE > 1 && onSubstrateMismatch) {
          onSubstrateMismatch({
            deltaE,
            importedSubstrate,
            printCondition: data
          });
        } else if (deltaE <= 1) {
          onSubstrateMismatch?.(null);
        }
      }

      // Notify parent component
      if (onPrintConditionChange) {
        onPrintConditionChange(printConditionId, data);
      }
    } catch (error) {
      console.warn('[PrintConditionCard] print condition fetch failed:', error);
      setSelectedPrintCondition(null);
      setSubstrateDeltaE(null);
      onSubstrateMismatch?.(null);
    }
  };

  const handleCreateNewPrintCondition = () => {
    window.open(`/print-conditions/new?fromImportedSubstrate=true`, '_blank');
  };

  const getSubstrateTypeName = (id) => {
    const type = substrateTypes.find(t => t.id === id);
    return type?.name || '';
  };

  const getSubstrateMaterialName = (id) => {
    const material = substrateMaterials.find(m => m.id === id);
    return material?.name || '';
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Print Condition Info</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-10 bg-gray-200 rounded"></div>
            <div className="grid grid-cols-4 gap-4">
              <div className="h-10 bg-gray-200 rounded"></div>
              <div className="h-10 bg-gray-200 rounded"></div>
              <div className="h-10 bg-gray-200 rounded"></div>
              <div className="h-10 bg-gray-200 rounded"></div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          Print Condition Info
          {substrateDeltaE > 1 && (
            <Badge variant="destructive" className="text-xs">
              <AlertTriangle className="w-3 h-3 mr-1" />
              Substrate Mismatch (ΔE: {substrateDeltaE.toFixed(1)})
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Print Condition Details - Grid Layout */}
        <div className="space-y-4">
          {/* First row: Print Condition Name, Print Process */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="print-condition-name">Print Condition Name</Label>
              <Select
                value={selectedPrintConditionId}
                onValueChange={handlePrintConditionSelect}
                disabled={!canEdit}
              >
                <SelectTrigger className="focus:ring-0 focus:ring-offset-0 focus:border-border data-[state=open]:ring-0 data-[state=open]:ring-offset-0">
                  <SelectValue placeholder="Select Print Condition" />
                </SelectTrigger>
                <SelectContent className="bg-background z-[100] border shadow-lg">
                  {printConditions.map((condition) => (
                    <SelectItem key={condition.id} value={condition.id}>
                      {condition.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="print-process">Print Process</Label>
              <Select disabled value={selectedPrintCondition?.print_process || ''}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Print Process" />
                </SelectTrigger>
                <SelectContent className="bg-white z-[100] border shadow-lg">
                  {printProcesses.map((process) => (
                    <SelectItem key={process.id} value={process.name}>
                      {process.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Second row: Substrate Type, Material Type, Print Side, Pack Type */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="substrate-type">Substrate Type</Label>
              <Select disabled value={selectedPrintCondition?.substrate_type_id || ''}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Substrate Type" />
                </SelectTrigger>
                <SelectContent className="bg-white z-[100] border shadow-lg">
                  {substrateTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="material-type">Material Type</Label>
              <Select disabled value={selectedPrintCondition?.substrate_material_id || ''}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Material Type" />
                </SelectTrigger>
                <SelectContent className="bg-white z-[100] border shadow-lg">
                  {substrateMaterials
                    .filter((m) => m.substrate_type_id === selectedPrintCondition?.substrate_type_id)
                    .map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="print-side">Print Side</Label>
              <Select disabled value={selectedPrintCondition?.printing_side || ''}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Print Side" />
                </SelectTrigger>
                <SelectContent className="bg-white z-[100] border shadow-lg">
                  <SelectItem value="Surface">Surface</SelectItem>
                  <SelectItem value="Reverse">Reverse</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="pack-type">Pack Type</Label>
              <Select disabled value={selectedPrintCondition?.pack_type || ''}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Pack Type" />
                </SelectTrigger>
                <SelectContent className="bg-white z-[100] border shadow-lg">
                  {packTypes.map((packType) => (
                    <SelectItem key={packType.id} value={packType.name}>
                      {packType.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default PrintConditionCard;