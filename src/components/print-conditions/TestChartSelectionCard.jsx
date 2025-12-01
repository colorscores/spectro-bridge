import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useTestchartsData } from '@/context/TestchartsContext';

const TestChartSelectionCard = ({ 
  selectedTestChart,
  onTestChartChange,
  characterizationInkCount = 4,
  canEdit = false 
}) => {
  const { testcharts, loading } = useTestchartsData();

  // Filter test charts that match the criteria
  const calibrationTestCharts = testcharts.filter(chart => 
    chart.type === 'calibration' && 
    chart.channels === characterizationInkCount
  );

  const selectedChart = testcharts.find(chart => chart.id === selectedTestChart);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Test Chart Selection</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="testchart-select">
            Select Test Chart (Calibration, {characterizationInkCount} channels)
          </Label>
          <Select 
            value={selectedTestChart || ""} 
            onValueChange={onTestChartChange}
            disabled={!canEdit || loading}
          >
            <SelectTrigger id="testchart-select">
              <SelectValue placeholder={loading ? "Loading test charts..." : "Select a test chart"} />
            </SelectTrigger>
            <SelectContent>
              {calibrationTestCharts.map((chart) => (
                <SelectItem key={chart.id} value={chart.id}>
                  {chart.name} ({chart.patch_count} patches)
                </SelectItem>
              ))}
              {calibrationTestCharts.length === 0 && !loading && (
                <SelectItem value="none" disabled>
                  No calibration test charts available with {characterizationInkCount} channels
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>

        {selectedChart && (
          <div className="mt-4 p-4 bg-muted rounded-lg">
            <h4 className="font-medium mb-2">Test Chart Preview</h4>
            <div className="space-y-1 text-sm text-muted-foreground">
              <div><strong>Name:</strong> {selectedChart.name}</div>
              <div><strong>Patches:</strong> {selectedChart.patch_count}</div>
              <div><strong>Channels:</strong> {selectedChart.channels}</div>
              <div><strong>Page Size:</strong> {selectedChart.page_size}</div>
              <div><strong>Patch Size:</strong> {selectedChart.patch_size}</div>
              {selectedChart.instrument && (
                <div><strong>Instrument:</strong> {selectedChart.instrument}</div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TestChartSelectionCard;