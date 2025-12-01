import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MultiSelect } from '@/components/ui/multi-select';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Trash2, Plus, ChevronDown, ChevronUp } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

// FilterPane component renders a slide-down area with dynamic filter rows
// Props:
// - open: boolean
// - rows: Array<{ id: string, property: string, operator: string, value: any }>
// - onAddRow: () => void
// - onRemoveRow: (id: string) => void
// - onChangeRow: (id: string, patch: Partial<any>) => void
// - onClear: () => void
// - tagOptions: { value: string, label: string }[]
// - printConditionOptions: { value: string, label: string }[]
// - measurementOptions: { value: string, label: string }[]
// - partnerLocationOptions: { value: string, label: string }[] (for brand users)
// - brandOrgOptions: { value: string, label: string }[] (for partner users)
// - isBrandOrg: boolean
// - isPartnerOrg: boolean

const getOperatorOptions = (property) => {
  switch (property) {
    case 'standardType':
      return [
        { value: 'is', label: 'Is' },
        { value: 'isNot', label: 'Is Not' }
      ];
    case 'tags':
    case 'measurementMode':
    case 'sharedTo':
    case 'owner':
      return [
        { value: 'includes', label: 'Includes' },
        { value: 'excludes', label: 'Excludes' }
      ];
    case 'createdDate':
    case 'updatedDate':
      return [
        { value: 'between', label: 'Between' },
        { value: 'on', label: 'On' },
        { value: 'before', label: 'Before' },
        { value: 'after', label: 'After' }
      ];
    default:
      return [];
  }
};

const getDefaultOperator = (property) => {
  switch (property) {
    case 'standardType':
      return 'is';
    case 'tags':
    case 'measurementMode':
    case 'sharedTo':
    case 'owner':
      return 'includes';
    case 'createdDate':
    case 'updatedDate':
      return 'between';
    default:
      return '';
  }
};

const ColorsFilterPane = ({
  open,
  rows,
  onAddRow,
  onRemoveRow,
  onChangeRow,
  onClear,
  tagOptions = [],
  printConditionOptions = [],
  measurementOptions = [
    { value: 'M0', label: 'M0' },
    { value: 'M1', label: 'M1' },
    { value: 'M2', label: 'M2' },
    { value: 'M3', label: 'M3' },
  ],
  partnerLocationOptions = [],
  brandOrgOptions = [],
  isBrandOrg = false,
  isPartnerOrg = false,
}) => {
  const renderValueControl = (row) => {
    switch (row.property) {
      case 'standardType': {
        const type = row.value?.type || '';
        const pcId = row.value?.printConditionId || null;
        return (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <RadioGroup
                  className="flex items-center gap-4"
                  value={type}
                  onValueChange={(v) => onChangeRow(row.id, { value: { type: v, printConditionId: v === 'dependent' ? pcId : null } })}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem id={`std-master-${row.id}`} value="master" />
                    <label htmlFor={`std-master-${row.id}`} className="text-sm">Master</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem id={`std-dependent-${row.id}`} value="dependent" />
                    <label htmlFor={`std-dependent-${row.id}`} className="text-sm">Dependent</label>
                  </div>
                </RadioGroup>
              </div>
            </div>
            {type === 'dependent' && (
              <div className="min-w-[260px]">
                <Select
                  value={pcId || ''}
                  onValueChange={(v) => onChangeRow(row.id, { value: { type, printConditionId: v || null } })}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select print condition" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-[1000]">
                    {printConditionOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        );
      }
      case 'tags': {
        const selected = row.value || [];
        return (
          <div className="min-w-[320px]">
            <MultiSelect
              options={tagOptions}
              selected={selected}
              onChange={(vals) => onChangeRow(row.id, { value: vals })}
              placeholder="Select tags..."
            />
          </div>
        );
      }
      case 'measurementMode': {
        const selected = row.value || [];
        return (
          <div className="min-w-[280px]">
            <MultiSelect
              options={measurementOptions}
              selected={selected}
              onChange={(vals) => onChangeRow(row.id, { value: vals })}
              placeholder="Select modes..."
            />
          </div>
        );
      }
      case 'sharedTo': {
        const selected = row.value || [];
        return (
          <div className="min-w-[320px]">
            <MultiSelect
              options={partnerLocationOptions}
              selected={selected}
              onChange={(vals) => onChangeRow(row.id, { value: vals })}
              placeholder="Select partners..."
            />
          </div>
        );
      }
      case 'owner': {
        const selected = Array.isArray(row.value) ? row.value : [];
        return (
          <div className="min-w-[320px]">
            <MultiSelect
              options={brandOrgOptions}
              selected={selected}
              onChange={(vals) => onChangeRow(row.id, { value: vals })}
              placeholder="Select brand organizations..."
            />
          </div>
        );
      }
      case 'createdDate':
      case 'updatedDate': {
        const start = row.value?.start || '';
        const end = row.value?.end || '';
        return (
          <div className="flex items-center gap-2">
            <Input type="date" value={start} onChange={(e) => onChangeRow(row.id, { value: { start: e.target.value, end } })} className="h-9" />
            <span className="text-sm text-muted-foreground">to</span>
            <Input type="date" value={end} onChange={(e) => onChangeRow(row.id, { value: { start, end: e.target.value } })} className="h-9" />
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
                      <th className="py-2 pr-2 w-28">Operator</th>
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
                             const operator = getDefaultOperator(v);
                             if (v === 'standardType') value = { type: '' };
                             if (v === 'tags') value = [];
                             if (v === 'measurementMode') value = [];
                             if (v === 'sharedTo') value = [];
                             if (v === 'owner') value = [];
                             if (v === 'createdDate' || v === 'updatedDate') value = { start: '', end: '' };
                             onChangeRow(row.id, { property: v, operator, value });
                           }}
                        >
                          <SelectTrigger className="h-9 focus:ring-0 focus:ring-offset-0">
                            <SelectValue placeholder="Select property" />
                          </SelectTrigger>
                          <SelectContent className="bg-popover z-[1000]">
                            <SelectItem value="standardType">Standard Type</SelectItem>
                            <SelectItem value="tags">Tags</SelectItem>
                            <SelectItem value="measurementMode">Measurement Mode</SelectItem>
                            {isBrandOrg && <SelectItem value="sharedTo">Shared to</SelectItem>}
                            {isPartnerOrg && <SelectItem value="owner">Owner</SelectItem>}
                            <SelectItem value="createdDate">Created On Date</SelectItem>
                            <SelectItem value="updatedDate">Last Edited Date</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                       <td className="py-3 pr-2">
                         <Select
                           value={row.operator || getDefaultOperator(row.property)}
                           onValueChange={(v) => onChangeRow(row.id, { operator: v })}
                         >
                           <SelectTrigger className="h-9 w-28 focus:ring-0 focus:ring-offset-0">
                             <SelectValue />
                           </SelectTrigger>
                           <SelectContent className="bg-popover z-[1000]">
                             {getOperatorOptions(row.property).map(opt => (
                               <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                             ))}
                           </SelectContent>
                         </Select>
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

export default ColorsFilterPane;
