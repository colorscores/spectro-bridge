import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MultiSelect } from '@/components/ui/multi-select';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Plus } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

const operatorLabel = (property) => {
  switch (property) {
    case 'substrate':
      return 'Is';
    case 'inkCount':
      return 'Is';
    case 'calibrationStatus':
      return 'Is';
    default:
      return '';
  }
};

const PrintersFilterPane = ({
  open,
  rows,
  onAddRow,
  onRemoveRow,
  onChangeRow,
  onClear,
  substrateOptions = [],
}) => {
  const renderValueControl = (row) => {
    switch (row.property) {
      case 'substrate': {
        const selected = row.value || [];
        return (
          <div className="min-w-[320px]">
            <MultiSelect
              options={substrateOptions}
              selected={selected}
              onChange={(vals) => onChangeRow(row.id, { value: vals })}
              placeholder="Select substrates..."
            />
          </div>
        );
      }
      case 'inkCount': {
        const min = row.value?.min || '';
        const max = row.value?.max || '';
        return (
          <div className="flex items-center gap-2">
            <Input 
              type="number" 
              value={min} 
              onChange={(e) => onChangeRow(row.id, { value: { min: e.target.value, max } })} 
              className="h-9 w-20" 
              placeholder="Min"
            />
            <span className="text-sm text-muted-foreground">to</span>
            <Input 
              type="number" 
              value={max} 
              onChange={(e) => onChangeRow(row.id, { value: { min, max: e.target.value } })} 
              className="h-9 w-20" 
              placeholder="Max"
            />
          </div>
        );
      }
      case 'calibrationStatus': {
        const status = row.value || '';
        return (
          <div className="min-w-[180px]">
            <Select
              value={status}
              onValueChange={(v) => onChangeRow(row.id, { value: v })}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent className="bg-popover z-[1000]">
                <SelectItem value="calibrated">Calibrated</SelectItem>
                <SelectItem value="uncalibrated">Uncalibrated</SelectItem>
              </SelectContent>
            </Select>
          </div>
        );
      }
      default:
        return null;
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="border-b border-border bg-muted/30 overflow-hidden"
        >
          <div className="p-3">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Button size="sm" variant="secondary" onClick={onAddRow}>
                  <Plus className="mr-1 h-4 w-4" /> Add filter
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" onClick={onClear}>Clear filters</Button>
              </div>
            </div>

            <div className="w-full overflow-auto">
              <table className="w-full text-sm border-separate border-spacing-0">
                {rows.length > 0 && (
                  <thead className="bg-muted/60">
                    <tr className="text-left text-muted-foreground text-xs uppercase tracking-wide">
                      <th className="py-2 pr-2 w-56">Property</th>
                      <th className="py-2 pr-2 w-28"></th>
                      <th className="py-2 pr-2">Values</th>
                      <th className="py-2 pr-2 w-12"></th>
                    </tr>
                  </thead>
                )}
                <tbody className={rows.length > 0 ? "divide-y divide-border border-t border-b border-border" : undefined}>
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-muted-foreground">No filters added.</td>
                    </tr>
                  )}
                  {rows.map((row) => (
                    <tr key={row.id} className="align-middle">
                      <td className="py-3 pr-2">
                        <Select
                          value={row.property || ''}
                          onValueChange={(v) => {
                            let value = null;
                            if (v === 'substrate') value = [];
                            if (v === 'inkCount') value = { min: '', max: '' };
                            if (v === 'calibrationStatus') value = '';
                            onChangeRow(row.id, { property: v, value });
                          }}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Select property" />
                          </SelectTrigger>
                          <SelectContent className="bg-popover z-[1000]">
                            <SelectItem value="substrate">Substrate/Condition</SelectItem>
                            <SelectItem value="inkCount">Number of Inks</SelectItem>
                            <SelectItem value="calibrationStatus">Calibration Status</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="py-3 pr-2 text-muted-foreground">
                        {operatorLabel(row.property)}
                      </td>
                      <td className="py-3 pr-2">
                        {renderValueControl(row)}
                      </td>
                      <td className="py-3 pr-2">
                        <Button variant="ghost" size="icon" onClick={() => onRemoveRow(row.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PrintersFilterPane;