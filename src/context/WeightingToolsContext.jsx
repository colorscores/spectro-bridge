import React, { createContext, useContext, useState, useEffect } from 'react';
import { useProfile } from '@/context/ProfileContext';

const WeightingToolsContext = createContext();

export const WeightingToolsProvider = ({ children }) => {
  const { profile } = useProfile() || { profile: null };
  const [isEnabled, setIsEnabled] = useState(false);
  
  const isSuperadmin = profile?.role === 'Superadmin';

  // Save to localStorage when enabled state changes
  useEffect(() => {
    if (isSuperadmin) {
      localStorage.setItem('weighting-tools-enabled', isEnabled.toString());
    }
  }, [isEnabled, isSuperadmin]);

  // Reset to false if user is not superadmin
  useEffect(() => {
    if (!isSuperadmin && isEnabled) {
      setIsEnabled(false);
    }
  }, [isSuperadmin, isEnabled]);

  const toggleWeightingTools = () => {
    if (isSuperadmin) {
      setIsEnabled(prev => !prev);
    }
  };

  return (
    <WeightingToolsContext.Provider value={{
      isEnabled: isSuperadmin && isEnabled,
      toggleWeightingTools,
      canAccess: isSuperadmin
    }}>
      {children}
    </WeightingToolsContext.Provider>
  );
};

export const useWeightingTools = () => {
  const context = useContext(WeightingToolsContext);
  if (!context) {
    // Return safe defaults instead of throwing to avoid provider timing crashes
    return {
      isEnabled: false,
      toggleWeightingTools: () => {},
      canAccess: false,
    };
  }
  return context;
};