import React, { useState, useMemo, memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { calculateDotGainCurve, logSpectralDataDiagnostic } from '@/lib/dotGainCalculations';
import { useIso53DensityTables } from '@/hooks/useIso53DensityTables';

const InkDotGainPlot = ({ wedgeData, selectedWedge, measurementControls, standards }) => {
  const [plotType, setPlotType] = useState('density');
  
  // Load ISO 5-3 density weighting functions
  const { data: iso53Data, isLoading: iso53Loading, error: iso53Error } = useIso53DensityTables('T');
  
  // Check for URL trace parameter
  const shouldTrace = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('traceTVI');

  // Calculate tone value data according to ISO 20654
  const plotData = useMemo(() => {
    // Add early return if no wedgeData to prevent unnecessary calculations
    if (!wedgeData || !Array.isArray(wedgeData) || wedgeData.length === 0) {
      return [];
    }
    
    // Spectral data diagnostic when tracing
    if (shouldTrace) {
      logSpectralDataDiagnostic(wedgeData, 'InkDotGainPlot');
    }
    
    // Debug logging
    console.log('🎯 InkDotGainPlot Debug:', {
      wedgeDataCount: wedgeData.length,
      plotType,
      iso53Available: !!iso53Data?.weightingFunctions,
      iso53Loading,
      iso53Error,
      tracingEnabled: shouldTrace
    });
    
    const toneValueCurve = calculateDotGainCurve(
      wedgeData, 
      plotType, 
      measurementControls, 
      standards, 
      iso53Data?.weightingFunctions
    );
    
    // Debug the calculated curve
    console.log('📊 Calculated tone curve:', toneValueCurve.map(point => ({
      input: point.input,
      output: point.output,
      tvi: point.tvi
    })));
    
    // Validation harness when tracing
    if (shouldTrace && toneValueCurve.length >= 3) {
      const substrate = toneValueCurve.find(p => p.input === 0);
      const solid = toneValueCurve.find(p => p.input === 100);
      const midTone = toneValueCurve.find(p => p.input > 0 && p.input < 100);
      
      console.log('🔍 TVI Validation Harness:', {
        substrate: substrate ? { input: substrate.input, output: substrate.output, tvi: substrate.tvi } : 'missing',
        solid: solid ? { input: solid.input, output: solid.output, tvi: solid.tvi } : 'missing',
        midTone: midTone ? { input: midTone.input, output: midTone.output, tvi: midTone.tvi } : 'missing',
        allZeros: toneValueCurve.every(p => p.output === 0),
        allValid: toneValueCurve.every(p => p.output != null && !isNaN(p.output))
      });
    }
    
    return toneValueCurve.map((point, index) => ({
      input: point.input,
      output: point.output,
      tvi: point.tvi || (point.output - point.input), // Tone Value Increase (TVI)
      isSelected: index === selectedWedge
    }));
  }, [wedgeData, plotType, selectedWedge, measurementControls, standards, iso53Data?.weightingFunctions, shouldTrace]);

  const CustomDot = (props) => {
    const { cx, cy, payload } = props;
    if (payload.isSelected) {
      return <circle cx={cx} cy={cy} r={6} fill="#ef4444" stroke="#fff" strokeWidth={2} />;
    }
    return <circle cx={cx} cy={cy} r={3} fill="#3b82f6" />;
  };

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg">Tone Plot</CardTitle>
        <Select value={plotType} onValueChange={setPlotType}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-background border border-border">
            <SelectItem value="density">Density TV</SelectItem>
            <SelectItem value="colorimetric">Colorimetric TV</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="h-64 p-1">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={plotData} margin={{ top: 5, right: 30, left: 30, bottom: 35 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
            <XAxis 
              dataKey="input"
              type="number"
              domain={[0, 100]}
              ticks={[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]}
              tick={{ fontSize: 12 }} 
              label={{ value: 'Nominal TV (%)', position: 'insideBottom', offset: -10, fontSize: 12 }}
              height={30}
            />
            <YAxis 
              domain={[0, 'dataMax']}
              tick={{ fontSize: 12 }} 
              label={{ value: 'Measured TV (%)', angle: -90, position: 'insideLeft', offset: -5, textAnchor: 'middle', style: { textAnchor: 'middle' }, fontSize: 12 }}
              width={50}
            />
            <Tooltip
              formatter={(value, name) => {
                if (name === 'output') {
                  return [`${value.toFixed(1)}%`, 'Measured TV'];
                }
                return [`${value > 0 ? '+' : ''}${value.toFixed(1)}%`, 'TVI (Tone Value Increase)'];
              }}
              labelFormatter={(label) => `Nominal TV: ${label}%`}
              contentStyle={{
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                border: '1px solid #ccc',
                borderRadius: '4px',
              }}
            />
            {/* Reference line for ideal tone reproduction (1:1) */}
            <ReferenceLine 
              stroke="#666" 
              strokeDasharray="5 5" 
              segment={[{x: 0, y: 0}, {x: 100, y: 100}]}
            />
            {/* Tone value curve */}
            <Line 
              type="monotone" 
              dataKey="output" 
              stroke="#3b82f6" 
              strokeWidth={2}
              dot={<CustomDot />}
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default memo(InkDotGainPlot);