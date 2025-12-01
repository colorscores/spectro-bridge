import React, { useState } from 'react';
import CalibrationMethodCard from './CalibrationMethodCard';
import TestChartSelectionCard from './TestChartSelectionCard';
import CalibrationResultsCard from './CalibrationResultsCard';

const CalibrationTab = ({ condition, onConditionChange, canEdit = false }) => {
  // Initialize calibration state from condition or defaults
  const [calibrationMethods, setCalibrationMethods] = useState(
    condition?.calibration?.methods || {
      solids: false,
      overPrints: false,
      curves: false,
      substrate: false
    }
  );
  
  const [allowInkDensityAdjustment, setAllowInkDensityAdjustment] = useState(
    condition?.calibration?.allowInkDensityAdjustment || false
  );
  
  const [selectedTestChart, setSelectedTestChart] = useState(
    condition?.calibration?.testChartId || null
  );

  // Mock characterization ink count - should come from condition data
  const characterizationInkCount = condition?.characterization?.inks?.length || 4;

  // Mock calibration results - should come from actual calibration data
  const calibrationResults = {
    status: condition?.calibration?.status || 'pending',
    measuredValues: condition?.calibration?.measuredValues || [],
    targetValues: condition?.calibration?.targetValues || [],
    deltaE: condition?.calibration?.deltaE || null,
    lastCalibrationDate: condition?.calibration?.lastCalibrationDate || null
  };

  const handleMethodsChange = (newMethods) => {
    setCalibrationMethods(newMethods);
    if (onConditionChange) {
      onConditionChange({
        ...condition,
        calibration: {
          ...condition?.calibration,
          methods: newMethods
        }
      });
    }
  };

  const handleInkDensityChange = (allow) => {
    setAllowInkDensityAdjustment(allow);
    if (onConditionChange) {
      onConditionChange({
        ...condition,
        calibration: {
          ...condition?.calibration,
          allowInkDensityAdjustment: allow
        }
      });
    }
  };

  const handleTestChartChange = (chartId) => {
    setSelectedTestChart(chartId);
    if (onConditionChange) {
      onConditionChange({
        ...condition,
        calibration: {
          ...condition?.calibration,
          testChartId: chartId
        }
      });
    }
  };

  return (
    <div className="space-y-6">
      <CalibrationMethodCard
        methods={calibrationMethods}
        allowInkDensityAdjustment={allowInkDensityAdjustment}
        onMethodsChange={handleMethodsChange}
        onInkDensityChange={handleInkDensityChange}
        canEdit={canEdit}
      />

      <TestChartSelectionCard
        selectedTestChart={selectedTestChart}
        onTestChartChange={handleTestChartChange}
        characterizationInkCount={characterizationInkCount}
        canEdit={canEdit}
      />

      <CalibrationResultsCard
        calibrationStatus={calibrationResults.status}
        measuredValues={calibrationResults.measuredValues}
        targetValues={calibrationResults.targetValues}
        deltaE={calibrationResults.deltaE}
        lastCalibrationDate={calibrationResults.lastCalibrationDate}
      />
    </div>
  );
};

export default CalibrationTab;