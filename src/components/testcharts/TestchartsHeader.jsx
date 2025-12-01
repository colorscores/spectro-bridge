import React from 'react';
import { Plus, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

const TestchartsHeader = ({ onAddNew, onResetView }) => {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Test Charts</h1>
        <p className="text-muted-foreground">
          Manage test charts used for color calibration and quality control
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          onClick={onResetView}
          className="flex items-center gap-2"
        >
          <RotateCcw className="h-4 w-4" />
          Reset View
        </Button>
        <Button
          onClick={onAddNew}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          New Test Chart
        </Button>
      </div>
    </div>
  );
};

export default TestchartsHeader;