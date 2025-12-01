import React, { createContext, useContext, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

// Simple request cache to prevent duplicate API calls
const requestCache = new Map();

// Debounced cache cleaner
const cleanCache = () => {
  const now = Date.now();
  for (const [key, value] of requestCache.entries()) {
    if (now - value.timestamp > 60000) { // 1 minute cache
      requestCache.delete(key);
    }
  }
};

// Clean cache every 30 seconds
setInterval(cleanCache, 30000);

const RequestCacheContext = createContext();

export const RequestCacheProvider = ({ children }) => {
  const cachedRequest = useCallback(async (key, requestFn, cacheTime = 30000) => {
    const cached = requestCache.get(key);
    
    if (cached && Date.now() - cached.timestamp < cacheTime) {
      return cached.data;
    }
    
    try {
      const data = await requestFn();
      requestCache.set(key, {
        data,
        timestamp: Date.now()
      });
      return data;
    } catch (error) {
      // Don't cache errors
      throw error;
    }
  }, []);

  const clearCache = useCallback((pattern) => {
    if (pattern) {
      for (const key of requestCache.keys()) {
        if (key.includes(pattern)) {
          requestCache.delete(key);
        }
      }
    } else {
      requestCache.clear();
    }
  }, []);

  // Expose clearCache globally for auth cleanup
  React.useEffect(() => {
    window.requestCacheInstance = { clearCache };
    return () => {
      delete window.requestCacheInstance;
    };
  }, [clearCache]);

  return (
    <RequestCacheContext.Provider value={{ cachedRequest, clearCache }}>
      {children}
    </RequestCacheContext.Provider>
  );
};

export const useRequestCache = () => {
  const context = useContext(RequestCacheContext);
  if (!context) {
    throw new Error('useRequestCache must be used within a RequestCacheProvider');
  }
  return context;
};

// Loading boundary component for smoother loading experience
export const LoadingBoundary = ({ children, fallback, delay = 100 }) => {
  const [showFallback, setShowFallback] = useState(false);

  React.useEffect(() => {
    const timer = setTimeout(() => setShowFallback(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  if (showFallback && fallback) {
    return fallback;
  }

  return children;
};

// Default loading components
export const SkeletonLoader = ({ lines = 3, className = "" }) => (
  <div className={`space-y-2 ${className}`}>
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton key={i} className="h-4 w-full" />
    ))}
  </div>
);

export const CardSkeleton = () => (
  <div className="border rounded-lg p-4 space-y-3">
    <Skeleton className="h-6 w-3/4" />
    <Skeleton className="h-4 w-full" />
    <Skeleton className="h-4 w-2/3" />
  </div>
);