import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

const LoadingSkeleton = () => (
  <div className="p-6 h-full">
    <Skeleton className="h-10 w-1/3 mb-6" />
    <div className="flex gap-8 h-full">
      <div className="flex-grow">
        <div className="flex gap-2 mb-6">
          <Skeleton className="h-10 w-36" />
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="grid grid-cols-2 flex-grow">
          <Skeleton className="h-96 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
      <aside className="w-80 flex-shrink-0">
        <Skeleton className="h-full w-full" />
      </aside>
    </div>
  </div>
);

export default LoadingSkeleton;