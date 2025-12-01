import React, { useEffect } from 'react';
import { useColorSpectralData } from '@/hooks/useColorSpectralData';

// Lightweight runner component to safely execute the hook and bubble results up
const UseColorSpectralDataRunner = ({
  color,
  activeDataMode,
  printConditionSubstrateSpectral,
  measurementMode,
  onResult,
}) => {
  const result = useColorSpectralData(color, activeDataMode, printConditionSubstrateSpectral, measurementMode);

  useEffect(() => {
    onResult?.(result);
  }, [result, onResult]);

  return null;
};

export default UseColorSpectralDataRunner;
