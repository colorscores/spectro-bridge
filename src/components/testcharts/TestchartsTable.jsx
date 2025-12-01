import React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const TestchartsTable = ({
  testcharts,
  selectedItems,
  setSelectedItems,
  onRowClick,
  activeId
}) => {
  const handleSelectAll = (checked) => {
    if (checked) {
      const allIds = new Set(testcharts.map(chart => chart.id));
      setSelectedItems(prev => ({ ...prev, testcharts: allIds }));
    } else {
      setSelectedItems(prev => ({ ...prev, testcharts: new Set() }));
    }
  };

  const handleSelectItem = (chartId, checked) => {
    setSelectedItems(prev => {
      const newSelected = new Set(prev.testcharts);
      if (checked) {
        newSelected.add(chartId);
      } else {
        newSelected.delete(chartId);
      }
      return { ...prev, testcharts: newSelected };
    });
  };

  const allSelected = testcharts.length > 0 && selectedItems.testcharts.size === testcharts.length;
  const someSelected = selectedItems.testcharts.size > 0 && selectedItems.testcharts.size < testcharts.length;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12">
            <Checkbox
              checked={allSelected}
              ref={(el) => {
                if (el) el.indeterminate = someSelected;
              }}
              onCheckedChange={handleSelectAll}
            />
          </TableHead>
          <TableHead>Test Chart Name</TableHead>
          <TableHead>Patch Set</TableHead>
          <TableHead>Printing Channels</TableHead>
          <TableHead>Number of Patches</TableHead>
          <TableHead>Number of Pages</TableHead>
          <TableHead>Page Size</TableHead>
          <TableHead>Instrument</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {testcharts.length === 0 ? (
          <TableRow>
            <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
              No test charts found
            </TableCell>
          </TableRow>
        ) : (
          testcharts.map((chart) => (
            <TableRow
              key={chart.id}
              className={`cursor-pointer hover:bg-muted/50 ${
                activeId === chart.id ? 'bg-muted' : ''
              }`}
              onClick={() => onRowClick(chart)}
            >
              <TableCell onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={selectedItems.testcharts.has(chart.id)}
                  onCheckedChange={(checked) => handleSelectItem(chart.id, checked)}
                />
              </TableCell>
              <TableCell className="font-medium">{chart.name}</TableCell>
              <TableCell>
                <span className="text-primary cursor-pointer hover:underline">
                  {chart.patch_set?.name || 'No patch set'}
                </span>
              </TableCell>
              <TableCell>{chart.printing_channels || '-'}</TableCell>
              <TableCell>{chart.number_of_patches || '-'}</TableCell>
              <TableCell>{chart.number_of_pages || '-'}</TableCell>
              <TableCell>{chart.page_size || '-'}</TableCell>
              <TableCell>{chart.instrument || '-'}</TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
};

export default TestchartsTable;