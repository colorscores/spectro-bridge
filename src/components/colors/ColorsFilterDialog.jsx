import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MultiSelect } from '@/components/ui/multi-select';
import { supabase } from '@/lib/customSupabaseClient';

const defaultFilters = {
  tagIds: [],
  standardType: 'all', // 'all' | 'master' | 'dependent'
  printConditionId: null,
};

const ColorsFilterDialog = ({
  isOpen,
  onOpenChange,
  initialFilters = defaultFilters,
  tagsOptions = [], // [{ value, label }]
  onApply,
  onClear,
}) => {
  const [localFilters, setLocalFilters] = useState(initialFilters);
  const [printConditions, setPrintConditions] = useState([]);
  const [loadingPC, setLoadingPC] = useState(false);

  useEffect(() => {
    setLocalFilters(initialFilters);
  }, [initialFilters, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    // Load print conditions when dialog opens
    const loadPrintConditions = async () => {
      setLoadingPC(true);
      const { data, error } = await supabase
        .from('print_conditions')
        .select('id, name')
        .order('name', { ascending: true });
      if (!error && Array.isArray(data)) {
        setPrintConditions(data);
      }
      setLoadingPC(false);
    };
    loadPrintConditions();
  }, [isOpen]);

  const pcOptions = useMemo(
    () => (printConditions || []).map(pc => ({ value: pc.id, label: pc.name })),
    [printConditions]
  );

  const handleApply = () => onApply?.(localFilters);
  const handleClear = () => onClear?.();

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Filter Colors</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-2">
            <Label>Tags</Label>
            <MultiSelect
              options={tagsOptions}
              selected={localFilters.tagIds}
              onChange={(vals) => setLocalFilters(prev => ({ ...prev, tagIds: vals }))}
              placeholder="Select tags"
            />
          </div>

          <div className="space-y-2">
            <Label>Standard Type</Label>
            <RadioGroup
              value={localFilters.standardType}
              onValueChange={(val) => setLocalFilters(prev => ({ ...prev, standardType: val }))}
              className="grid grid-cols-3 gap-2"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem id="std-all" value="all" />
                <Label htmlFor="std-all">All</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem id="std-master" value="master" />
                <Label htmlFor="std-master">Master</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem id="std-dependent" value="dependent" />
                <Label htmlFor="std-dependent">Dependent</Label>
              </div>
            </RadioGroup>
          </div>

          {localFilters.standardType === 'dependent' && (
            <div className="space-y-2">
              <Label>Print Condition (optional)</Label>
              <Select
                value={localFilters.printConditionId || 'any'}
                onValueChange={(val) => setLocalFilters(prev => ({ ...prev, printConditionId: val === 'any' ? null : val }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={loadingPC ? 'Loading…' : 'Select a print condition'} />
                </SelectTrigger>
                <SelectContent className="z-[1000] bg-background">
                  <SelectItem value="any">Any</SelectItem>
                  {pcOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter className="mt-6">
          <Button variant="ghost" onClick={handleClear}>Clear All</Button>
          <Button onClick={handleApply}>Apply Filters</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ColorsFilterDialog;
