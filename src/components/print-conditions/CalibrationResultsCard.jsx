import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertCircle, XCircle, Clock } from 'lucide-react';

const CalibrationResultsCard = ({ 
  calibrationStatus = 'pending',
  measuredValues = [],
  targetValues = [],
  deltaE = null,
  lastCalibrationDate = null
}) => {
  const getStatusIcon = (status) => {
    switch (status) {
      case 'complete':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'in-progress':
        return <Clock className="h-4 w-4 text-blue-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusBadge = (status) => {
    const variants = {
      complete: 'default',
      failed: 'destructive',
      'in-progress': 'secondary',
      pending: 'outline'
    };
    
    const labels = {
      complete: 'Complete',
      failed: 'Failed',
      'in-progress': 'In Progress',
      pending: 'Pending'
    };

    return (
      <Badge variant={variants[status] || 'outline'}>
        {getStatusIcon(status)}
        <span className="ml-1">{labels[status] || 'Unknown'}</span>
      </Badge>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Calibration Results</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Status:</span>
          {getStatusBadge(calibrationStatus)}
        </div>

        {lastCalibrationDate && (
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Last Calibration:</span>
            <span className="text-sm text-muted-foreground">
              {new Date(lastCalibrationDate).toLocaleDateString()}
            </span>
          </div>
        )}

        {deltaE !== null && (
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Average ΔE:</span>
            <span className={`text-sm font-mono ${deltaE <= 1 ? 'text-green-600' : deltaE <= 2 ? 'text-yellow-600' : 'text-red-600'}`}>
              {deltaE.toFixed(2)}
            </span>
          </div>
        )}

        {measuredValues.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Measured Values</h4>
            <div className="max-h-40 overflow-y-auto space-y-1">
              {measuredValues.slice(0, 5).map((value, index) => (
                <div key={index} className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Patch {index + 1}:</span>
                  <span className="font-mono">
                    L*{value.L?.toFixed(1)} a*{value.a?.toFixed(1)} b*{value.b?.toFixed(1)}
                  </span>
                </div>
              ))}
              {measuredValues.length > 5 && (
                <div className="text-xs text-muted-foreground text-center">
                  ... and {measuredValues.length - 5} more patches
                </div>
              )}
            </div>
          </div>
        )}

        {calibrationStatus === 'pending' && (
          <div className="text-sm text-muted-foreground text-center py-4">
            No calibration data available. Run calibration to see results.
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CalibrationResultsCard;