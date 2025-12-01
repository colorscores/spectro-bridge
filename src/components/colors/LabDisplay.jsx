import React from 'react';
import { Card, CardContent } from '@/components/ui/card';

const LabDisplay = ({ lab, ch }) => {
  return (
    <Card className="h-full">
        <CardContent className="p-4 flex flex-col justify-center h-full space-y-4">
            <div className="flex items-center gap-2 justify-center flex-wrap">
              <span className="text-sm text-muted-foreground">L:</span>
              <span className="font-mono text-lg font-medium">{lab?.L?.toFixed(1) ?? '—'}</span>
              <span className="text-sm text-muted-foreground">a:</span>
              <span className="font-mono text-lg font-medium">{lab?.a?.toFixed(1) ?? '—'}</span>
              <span className="text-sm text-muted-foreground">b:</span>
              <span className="font-mono text-lg font-medium">{lab?.b?.toFixed(1) ?? '—'}</span>
            </div>
            
            <div className="flex items-center gap-2 justify-center flex-wrap text-sm">
              <span className="text-muted-foreground">C*:</span>
              <span className="font-mono font-medium">{ch?.C?.toFixed(2) ?? '—'}</span>
              <span className="text-muted-foreground">h*:</span>
              <span className="font-mono font-medium">{ch?.h?.toFixed(2) ?? '—'}°</span>
            </div>
        </CardContent>
    </Card>
  );
};

export default LabDisplay;