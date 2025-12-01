import React, { createContext, useContext } from 'react';
import { useAppContext } from './AppContext';

export const ColorContext = createContext({
  colors: [],
  colorBooks: [],
  associations: [],
  loading: true,
  error: null,
  refetch: async () => {},
  updateColorOptimistically: () => {},
});

export const ColorProvider = ({ children }) => {
  const { colors, colorBooks, associations, loading, error, refetchColors, updateColorOptimistically } = useAppContext();

  const value = {
    colors,
    colorBooks,
    associations,
    loading,
    error,
    refetch: refetchColors,
    updateColorOptimistically,
  };

  return (
    <ColorContext.Provider value={value}>
      {children}
    </ColorContext.Provider>
  );
};

export const useColors = () => {
  const context = useContext(ColorContext);
  if (context === undefined) {
    console.error('useColors must be used within a ColorProvider. Did you mean to use AppContext?');
    return { colors: [], colorBooks: [], associations: [], loading: false, error: null, refetch: async () => {}, updateColorOptimistically: () => {} };
  }
  return context;
};