import React, { createContext, useContext, useState, useEffect, useCallback, useRef, startTransition } from 'react';
import { useAppContext } from './AppContext';
import { computeColorsView } from '@/hooks/useMemoizedColors';

const ColorViewsContext = createContext({
  getViewData: () => null,
  isReady: false,
  isComputing: false,
});

export const ColorViewsProvider = ({ children }) => {
  const { colors, colorBooks, associations } = useAppContext();
  const [precomputedViews, setPrecomputedViews] = useState({
    flat: null,
    book: null,
    dependent: null,
  });
  const [isComputing, setIsComputing] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const computationRef = useRef(false);
  const lastComputedLengthRef = useRef(0);
  const lastComputedSignatureRef = useRef('');
  // Compute all views when data changes
  useEffect(() => {
    // Skip if already computing
    if (computationRef.current) return;
    
    const hasColors = Array.isArray(colors) && colors.length > 0;
    if (!hasColors) return;
    
    // Build a lightweight signature that changes when color names/updated_at/tags change
    const signature =
      (colors || []).map(c => {
        const tagIds = (c.tags || []).map(t => t.id).sort().join(',');
        return `${c.id}:${c.updated_at || ''}:${c.name || ''}:${tagIds}`;
      }).join('|') +
      `|B:${(colorBooks || []).length}|A:${(associations || []).length}`;
    
    // Skip if already computed for this signature
    if (isReady && lastComputedSignatureRef.current === signature) {
      console.log('🎨 ColorViewsContext: Skip recompute - signature unchanged');
      return;
    }
    
    computationRef.current = true;
    setIsComputing(true);
    setIsReady(false);
    
    console.log('🎨 ColorViewsContext: Starting background view computation for', colors.length, 'colors');
    const startTime = performance.now();

    // Use requestIdleCallback to avoid blocking main thread
    const scheduleComputation = (callback) => {
      if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(callback);
      } else {
        setTimeout(callback, 0);
      }
    };

    // Compute flat view (simplest)
    scheduleComputation(() => {
      const flatView = computeColorsView(colors, colorBooks, 'flat', colors, associations);
      
      // Compute book view
      scheduleComputation(() => {
        const bookView = computeColorsView(colors, colorBooks, 'book', colors, associations);
        
        // Compute dependent view
        scheduleComputation(() => {
          const dependentView = computeColorsView(colors, colorBooks, 'dependent', colors, associations);
          
          // Store all computed views
          setPrecomputedViews({
            flat: Object.freeze(flatView),
            book: Object.freeze(bookView),
            dependent: Object.freeze(dependentView),
          });
          
          setIsComputing(false);
          setIsReady(true);
          lastComputedLengthRef.current = colors.length;
          lastComputedSignatureRef.current = signature;
          computationRef.current = false;
          
          const endTime = performance.now();
          console.log(`✅ ColorViewsContext: All views computed in ${(endTime - startTime).toFixed(2)}ms`);
          
          // Dispatch event for BackgroundPreloader
          window.dispatchEvent(new CustomEvent('color-views-ready'));
        });
      });
    });
  }, [colors, colorBooks, associations]);

  // Reset precomputed views when colors become empty (natural cascade from auth changes)
  useEffect(() => {
    const hasColors = Array.isArray(colors) && colors.length > 0;
    if (!hasColors && isReady) {
      console.log('🧹 ColorViewsContext: Resetting views (colors empty)');
      startTransition(() => {
        setPrecomputedViews({ flat: null, book: null, dependent: null });
        setIsComputing(false);
        setIsReady(false);
        lastComputedSignatureRef.current = '';
      });
    }
  }, [Array.isArray(colors) ? colors.length : 0, isReady]);

  const getViewData = useCallback((viewMode) => {
    return precomputedViews[viewMode] || null;
  }, [precomputedViews]);

  const value = {
    getViewData,
    isReady,
    isComputing,
  };

  return (
    <ColorViewsContext.Provider value={value}>
      {children}
    </ColorViewsContext.Provider>
  );
};

export const useColorViews = () => {
  const context = useContext(ColorViewsContext);
  if (context === undefined) {
    throw new Error('useColorViews must be used within a ColorViewsProvider');
  }
  return context;
};
