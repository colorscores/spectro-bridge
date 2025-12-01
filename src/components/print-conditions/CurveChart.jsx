import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const CurveChart = ({ selectedInks, curves }) => {
  const inkColors = {
    Yellow: '#FFD700',
    Magenta: '#FF1493', 
    Cyan: '#00BFFF',
    Black: '#000000'
  };

  // Generate curve data based on curve type
  const generateCurveData = (curveType) => {
    const points = [];
    for (let i = 0; i <= 100; i += 5) {
      let output = i;
      
      switch (curveType) {
        case 'ISO A':
          // Slightly compressed highlights and shadows
          output = i < 50 ? i * 0.95 : 50 + (i - 50) * 1.05;
          break;
        case 'ISO B':
          // More aggressive curve
          output = i < 50 ? i * 0.9 : 50 + (i - 50) * 1.1;
          break;
        case 'ISO C':
          // S-curve
          output = 50 + 50 * Math.sin((i - 50) * Math.PI / 100);
          break;
        case 'ISO D':
          // Inverse curve
          output = i < 50 ? i * 1.05 : 50 + (i - 50) * 0.95;
          break;
        case 'G7':
          // G7 curve (simplified)
          output = i + Math.sin(i * Math.PI / 100) * 3;
          break;
        case 'G7+':
          // G7+ curve (simplified)
          output = i + Math.sin(i * Math.PI / 100) * 5;
          break;
        case 'Custom':
          // Linear for now, would be editable
          output = i;
          break;
        default:
          output = i;
      }
      
      points.push({
        input: i,
        output: Math.max(0, Math.min(100, output))
      });
    }
    return points;
  };

  // Combine data for all selected inks
  const chartData = generateCurveData('ISO A').map(point => {
    const dataPoint = { input: point.input };
    
    selectedInks.forEach(ink => {
      const curveData = generateCurveData(curves[ink]);
      const curvePoint = curveData.find(p => p.input === point.input);
      dataPoint[ink] = curvePoint ? curvePoint.output : point.input;
    });
    
    return dataPoint;
  });

  return (
    <div className="space-y-4">
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="input" 
              label={{ value: 'Input %', position: 'insideBottom', offset: -5 }}
            />
            <YAxis 
              label={{ value: 'Output %', angle: -90, position: 'insideLeft' }}
            />
            <Tooltip 
              formatter={(value, name) => [`${value.toFixed(1)}%`, name]}
              labelFormatter={(label) => `Input: ${label}%`}
            />
            <Legend />
            
            {selectedInks.map(ink => (
              <Line
                key={ink}
                type="monotone"
                dataKey={ink}
                stroke={inkColors[ink]}
                strokeWidth={2}
                dot={false}
                name={`${ink} (${curves[ink]})`}
              />
            ))}
            
            {/* Reference line (45-degree line) */}
            <Line
              type="monotone"
              dataKey="input"
              stroke="#cccccc"
              strokeDasharray="5 5"
              strokeWidth={1}
              dot={false}
              name="Linear"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      
      <div className="text-xs text-muted-foreground">
        Dotted line shows linear response (no correction)
      </div>
    </div>
  );
};

export default CurveChart;