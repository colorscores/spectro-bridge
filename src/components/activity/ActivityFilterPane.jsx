import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const ActivityFilterPane = ({ 
  show, 
  filterRows, 
  onAddFilter, 
  onRemoveFilter, 
  onChangeFilter, 
  onClearFilters,
  filterOptions 
}) => {
  const operatorLabel = (property) => {
    switch (property) {
      case 'activity':
      case 'type':
        return 'Is';
      case 'user':
      case 'company':
      case 'receiver':
        return 'Includes';
      case 'date':
        return 'Between';
      default:
        return 'Is';
    }
  };

  const getOperatorOptions = (property) => {
    switch (property) {
      case 'activity':
      case 'type':
        return [
          { value: 'is', label: 'Is' },
          { value: 'is not', label: 'Is Not' }
        ];
      case 'user':
      case 'company':
      case 'receiver':
        return [
          { value: 'includes', label: 'Includes' },
          { value: 'excludes', label: 'Excludes' }
        ];
      case 'date':
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

  const renderValueControl = (row) => {
    if (!row.property) {
      return (
        <div className="text-sm text-muted-foreground italic">
          Select a property first
        </div>
      );
    }

    if (row.property === 'date') {
      return (
        <div className="flex gap-2 items-center">
          <Input
            type="date"
            value={row.startDate || ''}
            onChange={(e) => onChangeFilter(row.id, 'startDate', e.target.value)}
            className="h-8"
          />
          
          {row.operator === 'between' && (
            <>
              <span className="text-sm text-muted-foreground">to</span>
              <Input
                type="date"
                value={row.endDate || ''}
                onChange={(e) => onChangeFilter(row.id, 'endDate', e.target.value)}
                className="h-8"
              />
            </>
          )}
        </div>
      );
    }

    // Multi-select for other properties
    const options = filterOptions[row.property] || [];
    const selectedValues = row.values || [];

    return (
      <div className="flex flex-wrap gap-2">
        <Select
          value=""
          onValueChange={(value) => {
            if (!selectedValues.includes(value)) {
              onChangeFilter(row.id, 'values', [...selectedValues, value]);
            }
          }}
        >
          <SelectTrigger className="h-8 w-[200px]">
            <SelectValue placeholder={`Select ${row.property}...`} />
          </SelectTrigger>
          <SelectContent>
            {options.map(option => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selectedValues.map(value => (
          <div
            key={value}
            className="flex items-center gap-1 bg-primary/10 text-primary px-2 py-1 rounded-md text-sm"
          >
            <span>{value}</span>
            <button
              onClick={() => {
                onChangeFilter(
                  row.id,
                  'values',
                  selectedValues.filter(v => v !== value)
                );
              }}
              className="hover:bg-primary/20 rounded-sm p-0.5"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
    );
  };

  return (
    <AnimatePresence>
      {show && (
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
                <Button size="sm" variant="secondary" onClick={onAddFilter}>
                  <Plus className="mr-1 h-4 w-4" /> Add filter
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" onClick={onClearFilters}>
                  Clear filters
                </Button>
              </div>
            </div>

            <div className="w-full overflow-auto">
              <table className="w-full text-sm border-separate border-spacing-0">
                {filterRows.length > 0 && (
                  <thead className="bg-muted/60">
                    <tr className="text-left text-muted-foreground text-xs uppercase tracking-wide">
                      <th className="py-2 pr-2 w-56">Property</th>
                      <th className="py-2 pr-2 w-28">Operator</th>
                      <th className="py-2 pr-2">Values</th>
                      <th className="py-2 pr-2 w-12"></th>
                    </tr>
                  </thead>
                )}
                <tbody className={filterRows.length > 0 ? "divide-y divide-border border-t border-b border-border" : undefined}>
                  {filterRows.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-muted-foreground">No filters added.</td>
                    </tr>
                  )}
                  {filterRows.map(row => (
                    <tr key={row.id} className="align-middle">
                      <td className="py-3 pr-2">
                        <Select
                          value={row.property}
                          onValueChange={(value) => onChangeFilter(row.id, 'property', value)}
                        >
                          <SelectTrigger className="h-9 focus:ring-0 focus:ring-offset-0">
                            <SelectValue placeholder="Select property" />
                          </SelectTrigger>
                          <SelectContent className="bg-popover z-[1000]">
                            <SelectItem value="activity">Activity</SelectItem>
                            <SelectItem value="user">User</SelectItem>
                            <SelectItem value="company">Company</SelectItem>
                            <SelectItem value="receiver">Receiver</SelectItem>
                            <SelectItem value="date">Date</SelectItem>
                            <SelectItem value="type">Type</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="py-3 pr-2">
                        <Select
                          value={row.operator}
                          onValueChange={(value) => onChangeFilter(row.id, 'operator', value)}
                          disabled={!row.property}
                        >
                          <SelectTrigger className="h-9 w-28 focus:ring-0 focus:ring-offset-0">
                            <SelectValue placeholder="Operator..." />
                          </SelectTrigger>
                          <SelectContent className="bg-popover z-[1000]">
                            {getOperatorOptions(row.property).map(op => (
                              <SelectItem key={op.value} value={op.value}>
                                {op.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="py-3 pr-2">
                        {renderValueControl(row)}
                      </td>
                      <td className="py-3 pr-2">
                        <Button variant="ghost" size="icon" onClick={() => onRemoveFilter(row.id)}>
                          <X className="h-4 w-4" />
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

export default ActivityFilterPane;
