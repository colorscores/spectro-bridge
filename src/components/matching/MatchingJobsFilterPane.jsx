import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MultiSelect } from '@/components/ui/multi-select';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Plus } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

const operatorLabel = (property) => {
  switch (property) {
    case 'jobStatus':
      return 'Is';
    case 'matchStatus':
      return 'Includes';
    case 'printerLocation':
      return 'Is';
    case 'matchColors':
      return 'Includes';
    case 'dateShared':
    case 'dueDate':
      return 'Between';
    default:
      return '';
  }
};

const MatchingJobsFilterPane = ({
  open,
  rows,
  onAddRow,
  onRemoveRow,
  onChangeRow,
  onClear,
  printerLocationOptions = [],
  matchColorOptions = [],
  jobStatusOptions = [
    { value: 'New', label: 'New' },
    { value: 'In Progress', label: 'In Progress' },
    { value: 'Overdue', label: 'Overdue' },
    { value: 'Complete', label: 'Complete' },
    { value: 'Re-Match Required', label: 'Re-Match Required' },
    { value: 'Archived', label: 'Archived' }
  ],
  matchStatusOptions = [
    { value: 'New', label: 'New' },
    { value: 'Saved', label: 'Saved' },
    { value: 'Sent for Approval', label: 'Sent for Approval' },
    { value: 'Approved', label: 'Approved' },
    { value: 'Rejected', label: 'Rejected' }
  ]
}) => {
  const renderValueControl = (row) => {
    switch (row.property) {
      case 'jobStatus': {
        const selected = row.value || [];
        return (
          <div className="min-w-[280px]">
            <MultiSelect
              options={jobStatusOptions}
              selected={selected}
              onChange={(vals) => onChangeRow(row.id, { value: vals })}
              placeholder="Select job statuses..."
            />
          </div>
        );
      }
      case 'matchStatus': {
        const selected = row.value || [];
        return (
          <div className="min-w-[300px]">
            <MultiSelect
              options={matchStatusOptions}
              selected={selected}
              onChange={(vals) => onChangeRow(row.id, { value: vals })}
              placeholder="Select match statuses..."
            />
          </div>
        );
      }
      case 'printerLocation': {
        const selectedId = row.value || '';
        return (
          <div className="min-w-[300px]">
            <Select
              value={selectedId}
              onValueChange={(v) => onChangeRow(row.id, { value: v || '' })}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select printer & location" />
              </SelectTrigger>
              <SelectContent className="bg-popover z-[1000]">
                {printerLocationOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );
      }
      case 'matchColors': {
        const selected = row.value || [];
        return (
          <div className="min-w-[320px]">
            <MultiSelect
              options={matchColorOptions}
              selected={selected}
              onChange={(vals) => onChangeRow(row.id, { value: vals })}
              placeholder="Select colors..."
            />
          </div>
        );
      }
      case 'dateShared':
      case 'dueDate': {
        const start = row.value?.start || '';
        const end = row.value?.end || '';
        return (
          <div className="flex items-center gap-2">
            <Input 
              type="date" 
              value={start} 
              onChange={(e) => onChangeRow(row.id, { value: { start: e.target.value, end } })} 
              className="h-9" 
            />
            <span className="text-sm text-muted-foreground">to</span>
            <Input 
              type="date" 
              value={end} 
              onChange={(e) => onChangeRow(row.id, { value: { start, end: e.target.value } })} 
              className="h-9" 
            />
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
            <div className="w-full overflow-x-auto">
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
                            if (v === 'jobStatus') value = [];
                            if (v === 'matchStatus') value = [];
                            if (v === 'printerLocation') value = '';
                            if (v === 'matchColors') value = [];
                            if (v === 'dateShared' || v === 'dueDate') value = { start: '', end: '' };
                            onChangeRow(row.id, { property: v, value });
                          }}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Select property" />
                          </SelectTrigger>
                           <SelectContent className="bg-popover z-[1000]">
                             <SelectItem value="jobStatus">Matching Job Status</SelectItem>
                             <SelectItem value="matchStatus">Individual Match Status</SelectItem>
                             <SelectItem value="printerLocation">Printer & Location</SelectItem>
                             <SelectItem value="matchColors">Match Colors</SelectItem>
                             <SelectItem value="dateShared">Date Shared</SelectItem>
                             <SelectItem value="dueDate">Due Date</SelectItem>
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

export default MatchingJobsFilterPane;