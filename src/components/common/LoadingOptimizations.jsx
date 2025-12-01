import React, { memo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

// Optimized loading skeletons with proper memoization
export const ColorCardSkeleton = memo(() => (
  <div className="rounded-lg border p-4 space-y-3">
    <div className="flex items-center space-x-3">
      <Skeleton className="w-12 h-12 rounded-md" />
      <div className="space-y-1 flex-1">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
    <div className="space-y-2">
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-2/3" />
    </div>
  </div>
));

ColorCardSkeleton.displayName = 'ColorCardSkeleton';

export const ColorMatchSkeleton = memo(() => (
  <div className="flex items-center space-x-4 p-3 rounded-lg border">
    <Skeleton className="w-8 h-8 rounded-full" />
    <div className="flex-1 space-y-2">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
    </div>
    <div className="text-right space-y-1">
      <Skeleton className="h-3 w-12 ml-auto" />
      <Skeleton className="h-3 w-8 ml-auto" />
    </div>
  </div>
));

ColorMatchSkeleton.displayName = 'ColorMatchSkeleton';

export const InkConditionSkeleton = memo(() => (
  <div className="space-y-4">
    <div className="flex items-center justify-between">
      <Skeleton className="h-6 w-1/3" />
      <Skeleton className="h-8 w-20" />
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Skeleton className="h-64 w-full" />
      <Skeleton className="h-64 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  </div>
));

InkConditionSkeleton.displayName = 'InkConditionSkeleton';

// Progressive loading component for better UX
export const ProgressiveLoader = memo(({ 
  isLoading, 
  skeleton, 
  children, 
  delay = 200,
  fallback = null 
}) => {
  const [showSkeleton, setShowSkeleton] = React.useState(false);

  React.useEffect(() => {
    if (!isLoading) {
      setShowSkeleton(false);
      return;
    }

    const timer = setTimeout(() => {
      setShowSkeleton(true);
    }, delay);

    return () => clearTimeout(timer);
  }, [isLoading, delay]);

  if (!isLoading) return children;
  if (!showSkeleton) return fallback;
  return skeleton;
});

ProgressiveLoader.displayName = 'ProgressiveLoader';