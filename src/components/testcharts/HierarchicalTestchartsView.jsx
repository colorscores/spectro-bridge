import React from 'react';
import { ChevronRight, FileText, Package } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatPatchCount, getChannelName } from '@/utils/colorUtils';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const HierarchicalTestchartsView = ({ 
  testcharts, 
  selectedItems, 
  setSelectedItems, 
  onRowClick, 
  activeId,
  onPatchSetClick 
}) => {
  // Group test charts by patch set
  const groupedTestcharts = React.useMemo(() => {
    const groups = {};
    
    testcharts.forEach(chart => {
      const patchSetInfo = chart.patch_set;
      const key = patchSetInfo ? patchSetInfo.id : 'unassigned';
      
      if (!groups[key]) {
        groups[key] = {
          patchSet: patchSetInfo,
          testCharts: []
        };
      }
      
      groups[key].testCharts.push(chart);
    });
    
    return groups;
  }, [testcharts]);

  const handleSelectItem = (chartId, checked) => {
    setSelectedItems(prev => {
      const newSelected = new Set(prev.testcharts);
      if (checked) {
        newSelected.add(chartId);
      } else {
        newSelected.delete(chartId);
      }
      return { testcharts: newSelected };
    });
  };

  const handleSelectPatchSetGroup = (testCharts, checked) => {
    setSelectedItems(prev => {
      const newSelected = new Set(prev.testcharts);
      testCharts.forEach(chart => {
        if (checked) {
          newSelected.add(chart.id);
        } else {
          newSelected.delete(chart.id);
        }
      });
      return { testcharts: newSelected };
    });
  };

  const handlePatchSetClick = (patchSet) => {
    // Navigate to patch set detail view
    if (onPatchSetClick) {
      onPatchSetClick(patchSet);
    }
  };

  const renderTestChart = (chart) => {
    const isSelected = selectedItems.testcharts.has(chart.id);
    const isActive = activeId === chart.id;

    return (
      <TableRow
        key={chart.id}
        className={cn(
          "border-b-gray-200 hover:bg-muted/50 cursor-pointer",
          isActive && "bg-muted"
        )}
        onClick={() => onRowClick(chart)}
        data-state={isSelected ? 'selected' : ''}
      >
        <TableCell className="w-[50px]" onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={isSelected}
            onCheckedChange={(checked) => handleSelectItem(chart.id, checked)}
          />
        </TableCell>
        <TableCell className="w-[50px]">
          <div className="w-6 h-6 flex items-center justify-center">
            <div className="w-3 h-px bg-border"></div>
          </div>
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-3 ml-6">
            <div className="w-8 h-8 rounded-full border border-muted-foreground/20 flex items-center justify-center bg-muted">
              <FileText className="h-4 w-4 text-muted-foreground" />
            </div>
            <span className="font-medium">{chart.name}</span>
          </div>
        </TableCell>
        <TableCell>{chart.instrument || '-'}</TableCell>
        <TableCell>{chart.patch_size || '-'}</TableCell>
        <TableCell>{chart.page_size || '-'}</TableCell>
        <TableCell>{chart.number_of_pages || '-'}</TableCell>
      </TableRow>
    );
  };

  const renderPatchSetGroup = (key, group) => {
    const { patchSet, testCharts } = group;
    const allSelected = testCharts.every(chart => selectedItems.testcharts.has(chart.id));
    const someSelected = testCharts.some(chart => selectedItems.testcharts.has(chart.id));
    
    return (
      <React.Fragment key={key}>
        {/* Patch Set Header Row */}
        <TableRow
          onClick={() => handlePatchSetClick(patchSet)}
          className="border-b-gray-200 bg-blue-50 hover:bg-blue-100 font-semibold group cursor-pointer"
          data-state={someSelected ? 'selected' : ''}
        >
          <TableCell className="w-[50px]" onClick={(e) => e.stopPropagation()}>
            <Checkbox
              checked={allSelected}
              ref={(el) => {
                if (el) el.indeterminate = someSelected && !allSelected;
              }}
              onCheckedChange={(checked) => handleSelectPatchSetGroup(testCharts, checked)}
            />
          </TableCell>
          <TableCell className="w-[50px] pl-4">
            <div className="flex items-center justify-start w-5 h-5">
              <ChevronRight className="h-4 w-4 transition-transform duration-200 rotate-90" />
            </div>
          </TableCell>
          <TableCell>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full border border-blue-200 flex items-center justify-center bg-blue-100">
                <Package className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-blue-900">
                  {patchSet ? `${patchSet.name} (${formatPatchCount(patchSet.number_of_patches)} ${getChannelName(patchSet.printing_channels)})` : 'Unassigned Test Charts'}
                </span>
              </div>
            </div>
          </TableCell>
          <TableCell>
            <span className="text-gray-500">({testCharts.length} test chart{testCharts.length !== 1 ? 's' : ''})</span>
          </TableCell>
          <TableCell></TableCell>
          <TableCell></TableCell>
          <TableCell></TableCell>
          <TableCell></TableCell>
        </TableRow>
        {/* Test Chart Rows */}
        {testCharts.map(renderTestChart)}
      </React.Fragment>
    );
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12">
            <Checkbox
              checked={testcharts.length > 0 && testcharts.every(chart => selectedItems.testcharts.has(chart.id))}
              ref={(el) => {
                if (el) {
                  const someSelected = selectedItems.testcharts.size > 0 && selectedItems.testcharts.size < testcharts.length;
                  el.indeterminate = someSelected;
                }
              }}
              onCheckedChange={(checked) => {
                if (checked) {
                  const allIds = new Set(testcharts.map(chart => chart.id));
                  setSelectedItems(prev => ({ ...prev, testcharts: allIds }));
                } else {
                  setSelectedItems(prev => ({ ...prev, testcharts: new Set() }));
                }
              }}
            />
          </TableHead>
          <TableHead></TableHead>
          <TableHead>Name</TableHead>
          <TableHead>Instrument</TableHead>
          <TableHead>Patch Size</TableHead>
          <TableHead>Page Size</TableHead>
          <TableHead># of Pages</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {Object.keys(groupedTestcharts).length === 0 ? (
          <TableRow>
            <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
              No test charts found
            </TableCell>
          </TableRow>
        ) : (
          Object.entries(groupedTestcharts).map(([key, group]) => renderPatchSetGroup(key, group))
        )}
      </TableBody>
    </Table>
  );
};

export default HierarchicalTestchartsView;