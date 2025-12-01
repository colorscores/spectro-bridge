import { useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

export const useVirtualizedTable = (
  parentRef,
  data,
  estimateSize = 50,
  overscan = 5
) => {
  const virtualizer = useVirtualizer({
    count: data?.length || 0,
    getScrollElement: () => parentRef?.current,
    estimateSize: () => estimateSize,
    overscan,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  const visibleData = useMemo(() => {
    return virtualItems.map(virtualItem => ({
      index: virtualItem.index,
      item: data[virtualItem.index],
      size: virtualItem.size,
      start: virtualItem.start,
    }));
  }, [virtualItems, data]);

  return {
    virtualizer,
    virtualItems,
    totalSize,
    visibleData,
    scrollToIndex: virtualizer.scrollToIndex,
  };
};